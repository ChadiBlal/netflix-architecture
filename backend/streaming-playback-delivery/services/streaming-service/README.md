# Streaming & Playback Service

Node.js 20 + Express service for the second backend in the project architecture.

- HTTP API: `http://localhost:5002/api/streaming/**`
- Through Zuul: `http://localhost:8080/api/streaming/**` (requires a Zuul route)
- JWT: verifies the exact HS256 access token issued by Account & Billing Service.
- Redis: reads the shared `entitlement:<userId>` cache; uses `playback:active:<userId>`,
  `playback:session:<sessionId>` and `continue-watching:<userId>`.
- Kafka: publishes JSON playback events to `playback.events`.
- Flink: expected to consume `playback.events`, process events, and write them to Cassandra.
- Cassandra: playback history read model in `netflix_playback.playback_events_by_user_month`.
- Media: local MP4/HLS files under `MEDIA_ROOT/<videoId>/`.

## Important architecture boundary

The Account Service is authoritative for subscriptions and user identity. This service does not
create users, issue JWTs, charge payments, or write billing records. It reuses the account service's
JWT secret and Redis entitlement key. If the entitlement key is absent, it calls the Account
Service's `GET /api/users/me/entitlement` using the user's access token and caches the result.

The provided Account Service stores a 15-minute access token and deny-list keys in Redis. This
service checks the same `deny:<jti>` and `deny:sid:<sid>` keys.

Kafka events are durable pipeline inputs. Cassandra history is populated asynchronously by Flink,
not directly by this API. The Flink job itself is a separate pipeline responsibility and is not
included in this Node.js backend.

## Run locally

1. Start PostgreSQL, Redis, Kafka, Cassandra and Flink using the project root compose file.
2. Install and configure Account Service as described in `services/account-service/README.md`.
3. Create the Cassandra schema:

```bash
docker exec -i netflix_cassandra cqlsh < services/streaming-service/cassandra/schema.cql
```

4. Configure the service:

```bash
cd services/streaming-service
cp .env.example .env
npm install
npm start
```

For local execution, set `JWT_SECRET` to the exact same value used by Account Service.
Set `ACCOUNT_SERVICE_URL=http://localhost:5001` if the Account Service runs on the host.

## Media layout

For video ID `movie-001`, use:

```text
media/
  movie-001/
    video.mp4
  movie-002/
    index.m3u8
    segment-000.ts
    segment-001.ts
```

MP4 endpoint:
`GET /api/streaming/videos/movie-001/stream?sessionId=<playbackSessionId>`

HLS endpoint:
`GET /api/streaming/videos/movie-002/hls/index.m3u8?sessionId=<playbackSessionId>`

HLS manifests must reference relative segment paths. Each segment is requested through the same
protected `/hls/<asset>` endpoint. The media itself is not bundled; provide licensed video files
in the media directory or mount an external media volume.

## API

All routes below require `Authorization: Bearer <accessToken>`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/streaming/playback/sessions` | Start playback; body `{ "videoId": "movie-001", "profileId": "<uuid>", "durationSeconds": 3600 }` |
| POST | `/api/streaming/playback/sessions/:sessionId/progress` | Progress heartbeat; body `{ "positionSeconds": 120, "durationSeconds": 3600, "type": "progress" }` |
| POST | `/api/streaming/playback/sessions/:sessionId/activity` | `play`, `pause`, `resume`, `seek`, `heartbeat` activity |
| POST | `/api/streaming/playback/sessions/:sessionId/stop` | Stop or finish playback |
| GET | `/api/streaming/playback/continue-watching` | Current user's cached continue-watching list |
| GET | `/api/streaming/playback/history?month=2026-11&limit=30` | Cassandra history for one UTC month |
| GET | `/api/streaming/videos/:videoId/stream?sessionId=<uuid>` | Protected MP4 byte-range stream |
| GET | `/api/streaming/videos/:videoId/hls/:asset?sessionId=<uuid>` | Protected HLS manifest/segment |

Start response includes `session.playbackSessionId`; use it for progress, activity, stop and stream requests.
The API enforces `maxStreams` using an atomic Redis operation. A playback session expires after
`PLAYBACK_SESSION_TTL_SECONDS` unless heartbeats refresh it.

Progress updates are throttled to `PROGRESS_MIN_INTERVAL_SECONDS` when type is `progress`.
Send a progress heartbeat every 10–15 seconds from the player, plus explicit pause/seek/resume
events. Do not send a request on every rendered video frame.

## Kafka event contract

Topic: `playback.events`. Key: `userId`. Value is JSON:

```json
{
  "eventId": "uuid",
  "eventType": "progress",
  "userId": "uuid",
  "profileId": "uuid",
  "videoId": "movie-001",
  "playbackSessionId": "uuid",
  "positionSeconds": 120,
  "durationSeconds": 3600,
  "device": "browser user-agent",
  "occurredAt": "2026-11-27T12:00:00.000Z",
  "schemaVersion": 1
}
```

Flink should parse this contract, derive `month_bucket` from `occurredAt` in UTC, and sink each
event into `playback_events_by_user_month`. The Cassandra schema is in `cassandra/schema.cql`.

## Zuul route

Add a route mapping `/api/streaming/**` to the streaming container on port 5002.
For a Zuul 1 properties configuration, the equivalent is:

```properties
zuul.routes.streaming.path=/api/streaming/**
zuul.routes.streaming.url=http://streaming-service:5002
zuul.strip-prefix=false
```

Do not change the existing `/api/users/**` route. The provided compose archive references
`./zuul-real`, but that source directory was not included in the uploaded ZIP, so its exact
configuration file could not be edited here.

## Environment

See `.env.example`. In Docker Compose the internal hostnames are `redis`, `kafka`,
`cassandra`, and `account-service`. In local host mode use `localhost`.
