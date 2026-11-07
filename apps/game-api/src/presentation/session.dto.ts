import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { GAME_LIMITS } from '../domain/game';
export class CreateSessionDto {
 @ApiProperty({ format: 'uuid', description: 'Owned quiz with at least one question' }) @IsUUID('4') quizId!: string;
 @ApiPropertyOptional({ minimum: GAME_LIMITS.questionSeconds.min, maximum: GAME_LIMITS.questionSeconds.max, default: GAME_LIMITS.questionSeconds.default }) @IsOptional() @IsInt() @Min(GAME_LIMITS.questionSeconds.min) @Max(GAME_LIMITS.questionSeconds.max) questionSeconds?: number;
 @ApiPropertyOptional({ minimum: 1, description: 'Capped by GAME_MAX_PARTICIPANTS' }) @IsOptional() @IsInt() @Min(1) @Max(GAME_LIMITS.maxParticipants.max) maxParticipants?: number;
}
export class JoinSessionDto {
 @ApiProperty({ minLength: 6, maxLength: 6, example: 'K7P3QX', description: 'Case-insensitive room code' }) @IsString() @Length(6, 12) code!: string;
}
export class AnswerDto {
 @ApiProperty({ format: 'uuid' }) @IsUUID('4') gameQuestionId!: string;
 @ApiProperty({ type: Boolean, description: 'true = Verdadero, false = Falso' }) @IsBoolean() value!: boolean;
}
export class SessionCreatedDto {
 @ApiProperty({ format: 'uuid' }) id!: string;
 @ApiProperty({ example: 'K7P3QX' }) code!: string;
 @ApiProperty({ enum: ['LOBBY'] }) status!: string;
 @ApiProperty() title!: string;
 @ApiProperty() questionCount!: number;
 @ApiProperty() questionSeconds!: number;
 @ApiProperty() maxParticipants!: number;
}
export class JoinedDto {
 @ApiProperty({ format: 'uuid' }) sessionId!: string;
 @ApiProperty({ format: 'uuid' }) participantId!: string;
 @ApiProperty() displayName!: string;
 @ApiProperty({ enum: ['LOBBY', 'QUESTION_OPEN', 'QUESTION_CLOSED'] }) status!: string;
 @ApiProperty({ description: 'true when the user was already a participant (reconnection)' }) rejoined!: boolean;
}
export class AnswerAcceptedDto {
 @ApiProperty({ format: 'uuid' }) gameQuestionId!: string;
 @ApiProperty({ description: 'Stored value; on duplicates it is the first submission' }) value!: boolean;
 @ApiProperty({ type: String, format: 'date-time' }) receivedAt!: Date;
 @ApiProperty({ description: 'true when an answer already existed; the score never changes twice' }) duplicate!: boolean;
}
class CountsDto { @ApiProperty() true!: number; @ApiProperty() false!: number; @ApiProperty() none!: number; }
class CurrentQuestionDto {
 @ApiProperty({ format: 'uuid' }) id!: string;
 @ApiProperty({ minimum: 0 }) position!: number;
 @ApiProperty() total!: number;
 @ApiProperty() prompt!: string;
 @ApiProperty({ description: 'Fetch with GET /sessions/:id/questions/:gameQuestionId/image' }) hasImage!: boolean;
 @ApiProperty({ type: String, format: 'date-time' }) openedAt!: Date;
 @ApiProperty({ type: String, format: 'date-time', description: 'Server deadline; render the countdown against serverNow' }) deadline!: Date;
 @ApiProperty({ description: 'Answers received so far' }) answered!: number;
 @ApiPropertyOptional({ description: 'Only after the question closes' }) correctAnswer?: boolean;
 @ApiPropertyOptional({ type: CountsDto, description: 'Only after the question closes' }) counts?: CountsDto;
}
class OwnAnswerDto { @ApiProperty() value!: boolean; @ApiPropertyOptional({ description: 'Only after the question closes' }) correct?: boolean; }
class MeDto {
 @ApiProperty({ format: 'uuid' }) participantId!: string;
 @ApiProperty() displayName!: string;
 @ApiProperty({ description: 'Excludes the open question until it closes' }) score!: number;
 @ApiProperty({ type: OwnAnswerDto, nullable: true }) answer!: OwnAnswerDto | null;
}
class ParticipantDto { @ApiProperty({ format: 'uuid' }) id!: string; @ApiProperty() displayName!: string; }
export class StandingDto {
 @ApiProperty({ format: 'uuid' }) participantId!: string;
 @ApiProperty() displayName!: string;
 @ApiProperty({ description: 'One point per correct answer' }) score!: number;
 @ApiProperty() correctCount!: number;
 @ApiProperty({ description: 'Competition rank; ties share it (1, 1, 3)' }) rank!: number;
}
export class SessionStateDto {
 @ApiProperty({ format: 'uuid' }) id!: string;
 @ApiProperty() code!: string;
 @ApiProperty() title!: string;
 @ApiProperty({ enum: ['LOBBY', 'QUESTION_OPEN', 'QUESTION_CLOSED', 'FINISHED', 'CANCELLED'] }) status!: string;
 @ApiProperty({ enum: ['host', 'participant'] }) role!: string;
 @ApiProperty({ description: 'Increases on every state change; discard older realtime events' }) version!: number;
 @ApiProperty({ type: String, format: 'date-time' }) serverNow!: Date;
 @ApiProperty() questionCount!: number;
 @ApiProperty() questionSeconds!: number;
 @ApiProperty() maxParticipants!: number;
 @ApiProperty() participantCount!: number;
 @ApiProperty({ type: CurrentQuestionDto, nullable: true }) currentQuestion!: CurrentQuestionDto | null;
 @ApiPropertyOptional({ type: MeDto, description: 'Participants only' }) me?: MeDto;
 @ApiPropertyOptional({ type: [ParticipantDto], description: 'Host only' }) participants?: ParticipantDto[];
 @ApiPropertyOptional({ type: [StandingDto], description: 'FINISHED only' }) ranking?: StandingDto[];
}
export class ResultsDto {
 @ApiProperty({ format: 'uuid' }) sessionId!: string;
 @ApiProperty() title!: string;
 @ApiProperty({ type: String, format: 'date-time' }) finishedAt!: Date;
 @ApiProperty() questionCount!: number;
 @ApiProperty({ type: [StandingDto] }) ranking!: StandingDto[];
}
export class HistoryQueryDto {
 @ApiPropertyOptional({ enum: ['host', 'participant'], default: 'participant', description: 'Sessions you hosted, or sessions you played' }) @IsOptional() @IsIn(['host', 'participant']) role: 'host' | 'participant' = 'participant';
 @ApiPropertyOptional({ default: 1, minimum: 1 }) @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
 @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 }) @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 10;
}
class HistoryItemDto {
 @ApiProperty({ format: 'uuid' }) sessionId!: string;
 @ApiProperty() title!: string;
 @ApiProperty() code!: string;
 @ApiProperty({ type: String, format: 'date-time' }) finishedAt!: Date;
 @ApiProperty() questionCount!: number;
 @ApiProperty() participantCount!: number;
 @ApiPropertyOptional({ description: 'role=participant only: your score' }) score?: number;
 @ApiPropertyOptional({ description: 'role=participant only: your rank' }) rank?: number;
}
export class HistoryPageDto {
 @ApiProperty({ type: [HistoryItemDto] }) items!: HistoryItemDto[];
 @ApiProperty() total!: number;
 @ApiProperty() page!: number;
 @ApiProperty() pageSize!: number;
}
