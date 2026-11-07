import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { LocalImageStorage, uploadRoot } from '../src/infrastructure/local-image.storage';
describe('bounded persistent local image storage', () => {
 let directory: string;
 const storage = new LocalImageStorage();
 beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), 'nexquiz-image-')); process.env.IMAGE_STORAGE_PATH = directory; await storage.initialize(); });
 afterAll(async () => { delete process.env.IMAGE_STORAGE_PATH; await rm(directory, { recursive: true, force: true }); });
 it.each(['jpeg','png','webp'] as const)('fully decodes %s and produces persistent metadata-free WebP', async format => {
  const input = join(uploadRoot(), randomUUID());
  await sharp({ create: { width: 16, height: 16, channels: 3, background: 'green' } }).toFormat(format).withMetadata().toFile(input);
  const id = randomUUID(); await storage.save(id, input);
  const bytes = await readFile(join(directory, id + '.webp'));
  const metadata = await sharp(bytes).metadata();
  expect(metadata.format).toBe('webp'); expect(metadata.exif).toBeUndefined();
  const reopened = new LocalImageStorage(); let count = 0;
  for await (const part of await reopened.open(id)) count += part.length;
  expect(count).toBe(bytes.length);
  await storage.remove(id); await storage.remove(id);
 });
 it.each(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>', 'fake png bytes', ''])('rejects unsupported or corrupt actual content', async content => {
  const input = join(uploadRoot(), randomUUID()), id = randomUUID(); await writeFile(input, content);
  await expect(storage.save(id, input)).rejects.toThrow();
  expect(await readdir(directory)).not.toContain(id + '.webp');
 });
 it('rejects decompression bombs before rendering pixels', async () => {
  const input = join(uploadRoot(), randomUUID());
  await sharp({ create: { width: 4001, height: 4000, channels: 3, background: 'white' } }).png().toFile(input);
  await expect(storage.save(randomUUID(), input)).rejects.toThrow();
 });
 it('copies an image to an independent identifier and rejects missing sources', async () => {
  const input = join(uploadRoot(), randomUUID()), source = randomUUID(), target = randomUUID();
  await sharp({ create: { width: 4, height: 4, channels: 3, background: 'red' } }).png().toFile(input);
  await storage.save(source, input);
  await storage.copy(source, target);
  await storage.remove(source);
  expect((await sharp(await readFile(join(directory, target + '.webp'))).metadata()).format).toBe('webp');
  await expect(storage.copy(source, randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(storage.copy(target, target)).rejects.toMatchObject({ code: 'CONFLICT' });
  await storage.remove(target);
 });
 it('never derives filesystem paths from unsafe identifiers', async () => { await expect(storage.remove('../outside')).rejects.toThrow(); });
 it('collects expired temporary files', async () => { await storage.cleanTemporary(new Date(Date.now()+1000)); expect(await readdir(uploadRoot())).toEqual([]); });
});
