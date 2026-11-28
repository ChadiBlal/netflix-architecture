# Handoff — Streaming & Playback Backend

## Delivered

- Express API with JWT validation compatible with Account & Billing Service.
- Account profile ownership validation for optional profileId.
- Entitlement check using shared Redis key with Account Service API fallback.
- Atomic Redis concurrency limit based on subscription maxStreams.
- Playback session lifecycle: start, heartbeat/progress, activity, stop/end.
- Continue-watching state in Redis.
- Protected MP4 byte-range streaming.
- Protected HLS manifest and segment delivery.
- Kafka event producer publishing `playback.events`.
- Cassandra playback-history read endpoint and CQL table schema for the Flink sink.
- Dockerfile and root Compose integration for both Node backends, PostgreSQL, Redis, Kafka,
  Cassandra, Flink and the existing Zuul gateway build target.

## Contracts used

- JWT: HS256, `sub` is user UUID, same JWT_SECRET as Account Service.
- Shared entitlement: Redis key `entitlement:<userId>`.
- Account profile endpoint: `GET /api/users/me/profiles`.
- Account entitlement endpoint: `GET /api/users/me/entitlement`.
- Kafka topic: `playback.events`.
- Cassandra table: `netflix_playback.playback_events_by_user_month`.

## Required action from the project lead / integration owner

1. Add `/api/streaming/**` to the existing Zuul configuration using
   `zuul-streaming-route.properties`.
2. Confirm the Flink job consumes `playback.events`, maps event fields and writes the Cassandra
   table described in `services/streaming-service/cassandra/schema.cql`.
3. Provide video assets or the team's media origin. This backend currently serves local MP4/HLS
   files from `media/<videoId>/`.
4. Set the same strong JWT_SECRET for Account and Streaming services.
5. Run the stack and execute the smoke requests in the Streaming Service README.

## Validation performed here

- `node --check` passed for all 12 Streaming Service JavaScript files.
- `docker-compose.yml` parsed successfully as YAML and contains 11 services.
- A live Docker build and end-to-end test could not be run in this environment.

## Known scope boundaries

Flink job code, real video assets, DRM, transcoding, CDN delivery and Zuul source/configuration are
not present in the supplied files. The backend exposes the interfaces required to integrate those
components; it does not pretend those external pieces have been deployed or tested.
