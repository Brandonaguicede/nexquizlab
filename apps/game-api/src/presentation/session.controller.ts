import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, StreamableFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Readable } from 'node:stream';
import { ManageSessions } from '../application/manage-sessions';
import { PlaySessions } from '../application/play-sessions';
import { GameError } from '../domain/game';
import { answerOutcomes } from './game-metrics';
import { IdentityGuard, TeacherGuard } from './identity.controller';
import { NoStoreInterceptor } from './no-store.interceptor';
import { AnswerAcceptedDto, AnswerDto, CreateSessionDto, HistoryPageDto, HistoryQueryDto, JoinedDto, JoinSessionDto, ResultsDto, SessionCreatedDto, SessionStateDto } from './session.dto';
type PlayerRequest = Request & { identity: { userId: string; name?: string; role?: 'TEACHER' | 'STUDENT' } };
type HostCommand = 'start' | 'close' | 'next' | 'finish' | 'cancel';
const Id = () => Param('id', new ParseUUIDPipe({ version: '4' }));
@ApiTags('Game sessions') @ApiBearerAuth() @UseGuards(IdentityGuard)
@ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
@ApiResponse({ status: 403, description: 'FORBIDDEN: not the host, or not a participant when answering' })
@ApiResponse({ status: 404, description: 'NOT_FOUND / ROOM_NOT_FOUND: missing, or unrelated to the caller' })
@ApiResponse({ status: 409, description: 'EMPTY_QUIZ, ROOM_STARTED, ROOM_FULL, INVALID_STATE or ANSWER_WINDOW_CLOSED' })
@UseInterceptors(NoStoreInterceptor) @Controller('sessions')
export class SessionController {
 constructor(private readonly host: ManageSessions, private readonly play: PlaySessions) {}
 /** Host commands answer with the caller's refreshed state, the same body as GET /sessions/:id. */
 private async command(name: HostCommand, id: string, req: PlayerRequest) { if (req.identity.role !== 'TEACHER') throw new GameError('FORBIDDEN', 'Solo el profesor controla la sala.'); await this.host[name](id, req.identity.userId); return this.play.state(id, req.identity.userId); }
 @Post() @UseGuards(TeacherGuard) @ApiResponse({ status: 201, type: SessionCreatedDto })
 @ApiOperation({ summary: 'Open a room from an owned quiz', description: 'Copies questions, answers, order and images into an immutable snapshot. Returns a six-character join code.' })
 async create(@Req() req: PlayerRequest, @Body() input: CreateSessionDto) {
  const session = await this.host.create(req.identity.userId, input);
  return { id: session.id, code: session.code, status: session.status, title: session.title, questionCount: session.questionCount, questionSeconds: session.questionSeconds, maxParticipants: session.maxParticipants };
 }
 @Get() @ApiResponse({ status: 200, type: HistoryPageDto })
 @ApiOperation({ summary: 'Finished sessions of the caller', description: 'role=host: sessions you hosted. role=participant (default): sessions you played, with your score and rank. Newest first; never includes sessions of other users.' })
 history(@Req() req: PlayerRequest, @Query() query: HistoryQueryDto) { return this.play.history(req.identity.userId, query.role, query.page, query.pageSize); }
 @Post('join') @HttpCode(200) @ApiResponse({ status: 200, type: JoinedDto })
 @ApiOperation({ summary: 'Join a room by code', description: 'New participants only in LOBBY. Existing participants rejoin in any live state (reconnection) without duplicating participation. Display name comes from the JWT name claim.' })
 join(@Req() req: PlayerRequest, @Body() input: JoinSessionDto) { if (req.identity.role !== 'STUDENT') throw new GameError('FORBIDDEN', 'Entra con una cuenta de estudiante para participar. El profesor controla la sala desde su panel.'); return this.play.join(input.code, req.identity.userId, req.identity.name); }
 @Get(':id') @ApiResponse({ status: 200, type: SessionStateDto })
 @ApiOperation({ summary: 'Current state for the caller', description: 'Authoritative snapshot used after (re)connecting. correctAnswer and counts appear only once the question closes.' })
 state(@Req() req: PlayerRequest, @Id() id: string) { return this.play.state(id, req.identity.userId); }
 @Post(':id/start') @HttpCode(200) @ApiResponse({ status: 200, type: SessionStateDto }) @ApiOperation({ summary: 'Host: start and open the first question' })
 start(@Req() req: PlayerRequest, @Id() id: string) { return this.command('start', id, req); }
 @Post(':id/close') @HttpCode(200) @ApiResponse({ status: 200, type: SessionStateDto }) @ApiOperation({ summary: 'Host: close the open question early and reveal it', description: 'No-op when the timer already closed it.' })
 close(@Req() req: PlayerRequest, @Id() id: string) { return this.command('close', id, req); }
 @Post(':id/next') @HttpCode(200) @ApiResponse({ status: 200, type: SessionStateDto }) @ApiOperation({ summary: 'Host: open the next question, or finish after the last one', description: 'Only after the current question is closed.' })
 next(@Req() req: PlayerRequest, @Id() id: string) { return this.command('next', id, req); }
 @Post(':id/finish') @HttpCode(200) @ApiResponse({ status: 200, type: SessionStateDto }) @ApiOperation({ summary: 'Host: finish early and persist the ranking' })
 finish(@Req() req: PlayerRequest, @Id() id: string) { return this.command('finish', id, req); }
 @Post(':id/cancel') @HttpCode(200) @ApiResponse({ status: 200, type: SessionStateDto }) @ApiOperation({ summary: 'Host: cancel without results' })
 cancel(@Req() req: PlayerRequest, @Id() id: string) { return this.command('cancel', id, req); }
 @Post(':id/answers') @HttpCode(200) @ApiResponse({ status: 200, type: AnswerAcceptedDto })
 @ApiOperation({ summary: 'Participant: answer the open question', description: 'One answer per participant and question, enforced by a unique index. Resubmissions return the first answer with duplicate=true. Answers after the server deadline are rejected with ANSWER_WINDOW_CLOSED. The response never reveals correctness.' })
 async answer(@Req() req: PlayerRequest, @Id() id: string, @Body() input: AnswerDto) {
  try {
   if (req.identity.role !== 'STUDENT') throw new GameError('FORBIDDEN', 'Solo los estudiantes pueden responder.');
   const accepted = await this.play.answer(id, req.identity.userId, input.gameQuestionId, input.value);
   answerOutcomes.add(1, { outcome: accepted.duplicate ? 'duplicate' : 'accepted' });
   return accepted;
  } catch (error) { answerOutcomes.add(1, { outcome: error instanceof GameError ? error.code.toLowerCase() : 'error' }); throw error; }
 }
 @Get(':id/results') @ApiResponse({ status: 200, type: ResultsDto }) @ApiOperation({ summary: 'Persisted ranking of a finished session', description: 'Host and participants only; 409 INVALID_STATE before FINISHED.' })
 results(@Req() req: PlayerRequest, @Id() id: string) { return this.play.results(id, req.identity.userId); }
 @Get(':id/questions/:gameQuestionId/image')
 @ApiResponse({ status: 200, content: { 'image/webp': { schema: { type: 'string', format: 'binary' } } } })
 @ApiOperation({ summary: 'Snapshot image of a question', description: 'Host always; participants once the question has been opened. Bearer required: fetch as Blob.' })
 async image(@Req() req: PlayerRequest, @Id() id: string, @Param('gameQuestionId', new ParseUUIDPipe({ version: '4' })) gameQuestionId: string) {
  return new StreamableFile(Readable.from(await this.play.image(id, req.identity.userId, gameQuestionId)), { type: 'image/webp', disposition: 'inline' });
 }
}
