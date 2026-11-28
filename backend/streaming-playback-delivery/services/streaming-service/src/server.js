const config = require('./config');
const app = require('./app');
const { redis } = require('./redis');
const kafka = require('./kafka');
const cassandra = require('./cassandra');

let server;
async function start() {
  // Fail fast rather than accepting playback requests without event delivery/storage.
  await Promise.all([kafka.connect(), cassandra.connect()]);
  await redis.ping();
  server = app.listen(config.port, () => console.log(`[streaming-playback-service] listening on :${config.port}`));
}
async function shutdown() {
  console.log('[streaming-playback-service] shutting down');
  if (server) await new Promise(resolve => server.close(resolve));
  await Promise.allSettled([kafka.disconnect(), cassandra.disconnect()]);
  redis.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
start().catch(err => {
  console.error('[streaming-playback-service] startup failed:', err);
  process.exit(1);
});
