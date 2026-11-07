import { ServiceStatus } from '../domain/service-status';
import { HealthPort } from './health.port';
export class CheckHealth {
  constructor(private readonly database: HealthPort) {}
  async execute() { return new ServiceStatus('nexquiz-auth-api', await this.database.ping()); }
}
