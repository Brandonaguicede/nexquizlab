import { metrics } from '@opentelemetry/api';
/** Game instruments recorded at the transport edge. Attributes are fixed enums: never user or session identifiers. */
const meter = metrics.getMeter('nexquiz-game', '1.0.0');
export const answerOutcomes = meter.createCounter('nexquiz_answers', { description: 'Answer submissions by outcome (accepted, duplicate or rejection code)' });
export const liveConnections = meter.createUpDownCounter('nexquiz_live_connections', { description: 'Authenticated Socket.IO connections currently open' });
export const liveEvents = meter.createCounter('nexquiz_live_events', { description: 'Realtime events published, by type' });
