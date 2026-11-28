require('dotenv').config();
const env = process.env;
const isProd = env.NODE_ENV === 'production';
if (isProd && (!env.JWT_SECRET || env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production');
}
module.exports = {
  isProd,
  port: Number(env.PORT || 5002),
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
  redisUrl: env.REDIS_URL || 'redis://localhost:6379',
  kafkaBrokers: (env.KAFKA_BROKERS || 'localhost:9092').split(',').map(x => x.trim()).filter(Boolean),
  kafkaClientId: env.KAFKA_CLIENT_ID || 'streaming-playback-service',
  kafkaTopic: env.KAFKA_TOPIC || 'playback.events',
  cassandraContactPoints: (env.CASSANDRA_CONTACT_POINTS || 'localhost').split(',').map(x => x.trim()),
  cassandraLocalDatacenter: env.CASSANDRA_LOCAL_DATACENTER || 'datacenter1',
  cassandraKeyspace: env.CASSANDRA_KEYSPACE || 'netflix_playback',
  mediaRoot: require('path').resolve(env.MEDIA_ROOT || './media'),
  playbackSessionTtlSeconds: Number(env.PLAYBACK_SESSION_TTL_SECONDS || 21600),
  progressMinIntervalSeconds: Number(env.PROGRESS_MIN_INTERVAL_SECONDS || 5),
  corsOrigins: (env.CORS_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean)
};
