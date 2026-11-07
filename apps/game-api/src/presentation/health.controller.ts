import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { CheckHealth } from '../application/check-health';
class HealthDto {
  @ApiProperty({ enum: ['ok','unavailable'] }) status!: string;
  @ApiProperty({ example: 'nexquiz-game-api' }) service!: string;
}
@ApiTags('Health')
@Controller('health')
export class HealthController {
 constructor(private readonly check: CheckHealth) {}
 @Get('live') @ApiOkResponse({ type: HealthDto })
 live() { return { status: 'ok', service: 'nexquiz-game-api' }; }
 @Get('ready') @ApiOkResponse({ type: HealthDto }) @ApiServiceUnavailableResponse({ description: 'Database unavailable' })
 async ready() { const status = await this.check.execute(); if (!status.available) throw new ServiceUnavailableException(status.toJSON()); return status.toJSON(); }
}
