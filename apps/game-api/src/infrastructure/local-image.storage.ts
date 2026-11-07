import { constants, createReadStream } from 'node:fs';
import { copyFile, link, mkdir, readdir, rename, stat, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { ImageStorage } from '../application/image-storage.port';
import { QuizError } from '../domain/quiz';
// Uploaded source files must be unlinkable immediately, including on Windows.
sharp.cache({ files: 0 });
const imageRoot = () => resolve(process.env.IMAGE_STORAGE_PATH || (process.env.NODE_ENV === 'production' ? '/app/images' : resolve(process.cwd(), 'images')));
export const uploadRoot = () => join(imageRoot(), 'temporary');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Node file-system error code (ENOENT, EEXIST…), if any. */
const errorCode = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
async function removeFile(path: string) {
 try { await unlink(path); } catch (error) { if (errorCode(error) !== 'ENOENT') throw error; }
}
export class LocalImageStorage extends ImageStorage {
 private path(id: string) {
  if (!UUID.test(id)) throw new QuizError('INVALID_INPUT', 'Invalid image identifier');
  return join(imageRoot(), id + '.webp');
 }
 async initialize() { await mkdir(uploadRoot(), { recursive: true, mode: 0o700 }); }
 async save(id: string, temporaryPath: string) {
  const target = this.path(id), staging = join(uploadRoot(), id + '.webp');
  try {
   const image = sharp(temporaryPath, { limitInputPixels: 16_000_000, failOn: 'warning', animated: false });
   const metadata = await image.metadata();
   if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image');
   await image.rotate().webp({ quality: 85 }).toFile(staging);
   await rename(staging, target);
  } catch (error) {
   await removeFile(staging);
   // Disk faults are server errors; anything else means the upload itself was not a usable image.
   if (['ENOSPC', 'EACCES', 'EROFS'].includes(errorCode(error) ?? '')) throw error;
   throw new QuizError('INVALID_IMAGE', 'Use a valid JPEG, PNG or WebP image up to 16 megapixels, without animation');
  }
 }
 async copy(sourceId: string, targetId: string) {
  const source = this.path(sourceId), target = this.path(targetId), staging = join(uploadRoot(), targetId + '.webp');
  try {
   await copyFile(source, staging, constants.COPYFILE_EXCL);
   // link (unlike rename) refuses to replace an existing image atomically.
   await link(staging, target);
  } catch (error) {
   if (errorCode(error) === 'ENOENT') throw new QuizError('NOT_FOUND', 'Resource not found');
   if (errorCode(error) === 'EEXIST') throw new QuizError('CONFLICT', 'Image already exists');
   throw error;
  } finally { await removeFile(staging); }
 }
 async remove(id: string) { await removeFile(this.path(id)); }
 async open(id: string) {
  const path = this.path(id);
  try { await stat(path); } catch (error) {
   if (errorCode(error) === 'ENOENT') throw new QuizError('NOT_FOUND', 'Resource not found');
   throw error;
  }
  return createReadStream(path);
 }
 async cleanTemporary(before: Date) {
  for (const file of await readdir(uploadRoot(), { withFileTypes: true })) {
   if (!file.isFile()) continue;
   const path = join(uploadRoot(), file.name);
   try { if ((await stat(path)).mtime < before) await removeFile(path); }
   catch (error) { if (errorCode(error) !== 'ENOENT') throw error; }
  }
 }
}
