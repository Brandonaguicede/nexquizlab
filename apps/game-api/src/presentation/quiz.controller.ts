import { QuizResponseDto, QuizDetailResponseDto, QuizPageResponseDto, QuestionResponseDto } from './quiz-response.dto';
import { NoStoreInterceptor } from './no-store.interceptor';
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ManageQuizzes } from '../application/manage-quizzes';
import { IdentityGuard, TeacherGuard } from './identity.controller';
import { QuestionDto, QuizDto, QuizPageDto, ReorderDto, UpdateQuestionDto, UpdateQuizDto } from './quiz.dto';
export type OwnedRequest = Request & { identity: { userId: string } };
@ApiTags('Quizzes') @ApiBearerAuth() @UseGuards(IdentityGuard, TeacherGuard)
@ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
@ApiResponse({ status: 404, description: 'Resource missing, deleted or owned by another user' })
@ApiResponse({ status: 400, description: 'Invalid DTO, UUID or unknown property' })
@ApiResponse({ status: 409, description: 'Concurrent change, invalid order or question limit reached' })
@UseInterceptors(NoStoreInterceptor) @Controller('quizzes')
export class QuizController {
 constructor(private readonly quizzes: ManageQuizzes) {}
 @Get() @ApiResponse({ status: 200, type: QuizPageResponseDto }) @ApiOperation({ summary: 'List own quizzes', description: 'Paginated {items,total,page,pageSize}; items include id,title,description,createdAt,updatedAt,questionCount. Ordered by updatedAt descending, id ascending.' })
 list(@Req() req: OwnedRequest, @Query() page: QuizPageDto) { return this.quizzes.list(req.identity.userId, page.page, page.pageSize); }
 @Post() @ApiResponse({ status: 201, type: QuizResponseDto }) @ApiOperation({ summary: 'Create own quiz', description: 'Owner comes exclusively from JWT subject. Returns {id,title,description,createdAt,updatedAt}.' }) @ApiResponse({ status: 201, description: 'Quiz created' })
 create(@Req() req: OwnedRequest, @Body() input: QuizDto) { return this.quizzes.create(req.identity.userId, input); }
 @Get(':id') @ApiResponse({ status: 200, type: QuizDetailResponseDto }) @ApiOperation({ summary: 'Get own quiz and ordered questions', description: 'Quiz fields plus questions: [{id,quizId,prompt,correctAnswer,position,imageId,createdAt,updatedAt}]. imageId resolves through authenticated GET /api/v1/images/:id.' })
 detail(@Req() req: OwnedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.quizzes.detail(req.identity.userId, id); }
 @Patch(':id') @ApiResponse({ status: 200, type: QuizResponseDto }) @ApiOperation({ summary: 'Edit title or description' })
 update(@Req() req: OwnedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateQuizDto) { return this.quizzes.update(req.identity.userId, id, input); }
 @Delete(':id') @HttpCode(204) @ApiOperation({ summary: 'Soft-delete quiz and questions', description: 'Idempotent for own tombstones; preserves future historical references. Images are detached for recoverable cleanup.' })
 remove(@Req() req: OwnedRequest, @Param('id', ParseUUIDPipe) id: string) { return this.quizzes.remove(req.identity.userId, id); }
 @Post(':id/questions') @ApiResponse({ status: 201, type: QuestionResponseDto }) @ApiOperation({ summary: 'Append true/false question', description: 'At most 200 active questions. Returns question with zero-based position.' }) @ApiResponse({ status: 201, description: 'Question created' })
 addQuestion(@Req() req: OwnedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: QuestionDto) { return this.quizzes.addQuestion(req.identity.userId, id, input); }
 @Patch(':id/questions/reorder') @ApiResponse({ status: 200, type: QuizDetailResponseDto }) @ApiOperation({ summary: 'Atomically reorder complete question permutation', description: 'A stale permutation is rejected with 409. Returns quiz detail.' })
 reorder(@Req() req: OwnedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() input: ReorderDto) { return this.quizzes.reorder(req.identity.userId, id, input.questionIds); }
 @Patch(':id/questions/:questionId') @ApiResponse({ status: 200, type: QuestionResponseDto }) @ApiOperation({ summary: 'Edit prompt or boolean answer' })
 updateQuestion(@Req() req: OwnedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('questionId', ParseUUIDPipe) questionId: string, @Body() input: UpdateQuestionDto) { return this.quizzes.updateQuestion(req.identity.userId, id, questionId, input); }
 @Delete(':id/questions/:questionId') @HttpCode(204) @ApiOperation({ summary: 'Delete question and compact positions atomically' })
 removeQuestion(@Req() req: OwnedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('questionId', ParseUUIDPipe) questionId: string) { return this.quizzes.removeQuestion(req.identity.userId, id, questionId); }
}
