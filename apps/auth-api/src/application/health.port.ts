export const HEALTH_PORT = Symbol('HEALTH_PORT');
export interface HealthPort { ping(): Promise<boolean>; }
