import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ManageImages } from '../application/manage-images';
import { LocalImageStorage } from './local-image.storage';
export class ImageMaintenance implements OnModuleInit, OnModuleDestroy {
 private timer?: ReturnType<typeof setInterval>;
 private pending?: Promise<void>;
 private readonly logger = new Logger('ImageMaintenance');
 constructor(private readonly images: ManageImages, private readonly storage: LocalImageStorage) {}
 async onModuleInit() {
  await this.storage.initialize();
  await this.run();
  this.timer = setInterval(() => { void this.run(); }, 60000);
  this.timer.unref();
 }
 private run() {
  return this.pending ??= this.images.collect().catch(() => { this.logger.warn('Image cleanup deferred; durable records retained for retry'); }).finally(() => { this.pending = undefined; });
 }
 async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.pending; }
}
