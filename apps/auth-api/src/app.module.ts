import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health.module';
import { AuthModule } from './modules/auth.module';
@Module({ imports: [HealthModule, AuthModule] })
export class AppModule {}
