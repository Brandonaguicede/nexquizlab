import { NoStoreInterceptor } from './no-store.interceptor';
import { BadRequestException, Controller, Delete, Get, Param, ParseUUIDPipe, PayloadTooLargeException, Post, Req, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { ManageImages } from '../application/manage-images';
import { QUIZ_LIMITS } from '../domain/quiz';
import { IdentityGuard, TeacherGuard } from './identity.controller';
import { OwnedRequest } from './quiz.controller';
@ApiTags('Images') @ApiBearerAuth() @UseGuards(IdentityGuard, TeacherGuard)
@ApiResponse({ status: 401, description: 'Missing or invalid JWT' })
@ApiResponse({ status: 404, description: 'Missing, detached or foreign resource' })
@ApiResponse({ status: 400, description: 'Invalid content, UUID, animation or more than 16 megapixels' })
@UseInterceptors(NoStoreInterceptor) @Controller()
export class ImageController {
 constructor(private readonly images: ManageImages) {}
 @Post('quizzes/:id/questions/:questionId/image') @UseInterceptors(FileInterceptor('file'))
 @ApiConsumes('multipart/form-data') @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
 @ApiOperation({ summary: 'Upload or replace question image', description: 'One JPEG/PNG/WebP <=5 MiB (5242880 bytes), actual decoding, <=16 MP, no animation. Disk buffered and normalized to metadata-free WebP. Returns updated question with imageId.' })
 @ApiResponse({ status: 201, description: 'Image attached' }) @ApiResponse({ status: 413, description: 'File exceeds 5 MiB' })
 async upload(@Req() req: OwnedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('questionId', ParseUUIDPipe) questionId: string, @UploadedFile() file?: Express.Multer.File) {
  if (!file) throw new BadRequestException('Select one image in multipart field file');
  try {
   if (file.size > QUIZ_LIMITS.imageBytes) throw new PayloadTooLargeException('Image exceeds 5 MiB');
   return await this.images.upload(req.identity.userId, id, questionId, file.path);
  }
  finally { await unlink(file.path).catch(() => { /* stale temporary files are collected */ }); }
 }
 @Delete('quizzes/:id/questions/:questionId/image') @ApiOperation({ summary: 'Remove question image idempotently', description: 'Returns updated question. Detached files are durably queued for cleanup.' })
 remove(@Req() req: OwnedRequest, @Param('id', ParseUUIDPipe) id: string, @Param('questionId', ParseUUIDPipe) questionId: string) { return this.images.remove(req.identity.userId, id, questionId); }
 @Get('images/:imageId') @ApiOperation({ summary: 'Stream owned active image', description: 'Bearer required; use the API origin or /game proxy, never a hardcoded localhost URL. Returns image/webp.' })
 @ApiResponse({ status: 200, content: { 'image/webp': { schema: { type: 'string', format: 'binary' } } } })
 async read(@Req() req: OwnedRequest, @Param('imageId', ParseUUIDPipe) imageId: string) { return new StreamableFile(Readable.from(await this.images.read(req.identity.userId, imageId)), { type: 'image/webp', disposition: 'inline' }); }
}
