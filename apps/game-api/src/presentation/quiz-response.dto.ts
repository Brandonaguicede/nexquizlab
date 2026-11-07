import { ApiProperty } from '@nestjs/swagger';
export class QuizResponseDto {
 @ApiProperty({ format: 'uuid' }) id!: string;
 @ApiProperty() title!: string;
 @ApiProperty() description!: string;
 @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
 @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}
export class QuestionResponseDto {
 @ApiProperty({ format: 'uuid' }) id!: string;
 @ApiProperty({ format: 'uuid' }) quizId!: string;
 @ApiProperty() prompt!: string;
 @ApiProperty() correctAnswer!: boolean;
 @ApiProperty({ minimum: 0 }) position!: number;
 @ApiProperty({ type: String, format: 'uuid', nullable: true }) imageId!: string | null;
 @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
 @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}
export class QuizDetailResponseDto extends QuizResponseDto {
 @ApiProperty({ type: [QuestionResponseDto] }) questions!: QuestionResponseDto[];
}
export class QuizListItemDto extends QuizResponseDto {
 @ApiProperty({ minimum: 0 }) questionCount!: number;
}
export class QuizPageResponseDto {
 @ApiProperty({ type: [QuizListItemDto] }) items!: QuizListItemDto[];
 @ApiProperty() total!: number;
 @ApiProperty() page!: number;
 @ApiProperty() pageSize!: number;
}
