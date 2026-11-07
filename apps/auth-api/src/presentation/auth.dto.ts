import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
export class LoginDto {
 @ApiProperty({ maxLength: 254, example: 'teacher@example.com' })
 @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
 @IsEmail() @MaxLength(254) email!: string;
 @ApiProperty({ minLength: 12, maxLength: 128, writeOnly: true, format: 'password' })
 @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
export class RegisterDto extends LoginDto {
 @ApiProperty({ enum: ['STUDENT'], default: 'STUDENT', description: 'Public registration creates student accounts only.' })
 @IsOptional() @IsIn(['STUDENT']) role?: 'STUDENT';
 @ApiProperty({ minLength: 1, maxLength: 100, example: 'Ana' })
 @IsString() @MinLength(1) @MaxLength(100) displayName!: string;
}
export class ProfileDto {
 @ApiProperty({ enum: ['TEACHER', 'STUDENT'] }) role!: string;
 @ApiProperty({ format: 'uuid' }) id!: string;
 @ApiProperty() email!: string;
 @ApiProperty() displayName!: string;
 @ApiProperty({ format: 'date-time' }) createdAt!: string;
}
export class SessionDto {
 @ApiProperty({ type: ProfileDto }) user!: ProfileDto;
 @ApiProperty() accessToken!: string;
 @ApiProperty({ enum: ['Bearer'] }) tokenType!: string;
 @ApiProperty({ example: 300 }) expiresIn!: number;
}
export class AuthErrorDto {
 @ApiProperty() statusCode!: number;
 @ApiProperty() code!: string;
 @ApiProperty() message!: string;
}
