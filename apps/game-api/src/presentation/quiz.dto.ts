import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { QUIZ_LIMITS } from '../domain/quiz';
export class QuizDto {
 @ApiProperty({ maxLength: 160 }) @IsString() @Matches(/\S/) @MaxLength(QUIZ_LIMITS.title) title!: string;
 @ApiPropertyOptional({ maxLength: 2000 }) @ValidateIf((_object, value: unknown) => value !== undefined) @IsString() @MaxLength(QUIZ_LIMITS.description) description?: string;
}
export class UpdateQuizDto extends PartialType(QuizDto, { skipNullProperties: false }) {}
export class QuestionDto {
 @ApiProperty({ maxLength: 2000 }) @IsString() @Matches(/\S/) @MaxLength(QUIZ_LIMITS.prompt) prompt!: string;
 @ApiProperty({ type: Boolean }) @IsBoolean() correctAnswer!: boolean;
}
export class UpdateQuestionDto extends PartialType(QuestionDto, { skipNullProperties: false }) {}
export class ReorderDto {
 @ApiProperty({ type: [String], maxItems: 200, description: 'Complete permutation of current question UUIDs; index is zero-based position' })
 @IsArray() @ArrayMaxSize(QUIZ_LIMITS.questions) @ArrayUnique() @IsUUID('4', { each: true }) questionIds!: string[];
}
export class QuizPageDto {
 @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 1000000 }) @Type(() => Number) @IsInt() @Min(1) @Max(1000000) page = 1;
 @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 }) @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 10;
}
