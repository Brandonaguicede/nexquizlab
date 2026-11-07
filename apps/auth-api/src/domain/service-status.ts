export class ServiceStatus {
  constructor(readonly service: string, readonly available: boolean) {
    if (!service.trim()) throw new Error('Service name is required');
  }
  toJSON() { return { status: this.available ? 'ok' : 'unavailable', service: this.service }; }
}
