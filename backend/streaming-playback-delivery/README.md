# Netflix-style Streaming Platform — Backend Integration

This delivery contains the existing Account & Billing backend from the supplied ZIP, the new
Streaming & Playback backend, the shared database/cache/event infrastructure, and an integrated
Docker Compose file.

## Project tree

```text
.
├── docker-compose.yml
├── databases/
│   └── postgresql_schema.sql
├── services/
│   ├── account-service/          # Existing backend supplied by the project
│   └── streaming-service/        # New backend implementation
│       ├── src/
│       ├── cassandra/schema.cql
│       ├── Dockerfile
│       └── README.md
├── media/                        # Put licensed video assets here
└── zuul-streaming-route.properties
```

## Start the stack

Requirements: Docker Desktop / Docker Engine with Compose v2.

1. Ensure the existing `zuul-real/` directory (the gateway source referenced by the uploaded
   compose file) is beside `docker-compose.yml`.
2. Create a `.env` in the project root:

```dotenv
POSTGRES_PASSWORD=choose-a-local-db-password
JWT_SECRET=replace-with-one-long-random-secret-at-least-32-characters
CORS_ORIGINS=http://localhost:3000,http://localhost:5500
```

3. Copy the gateway route properties from `zuul-streaming-route.properties` into the real Zuul
   configuration. Keep the existing Account Service route.
4. Run:

```bash
docker compose up --build
```

Services:
- Zuul: `http://localhost:8080`
- Account Service direct (container-internal): `http://account-service:5001`
- Streaming Service direct: `http://localhost:5002`
- Flink dashboard: `http://localhost:8081`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Kafka: `localhost:9092`
- Cassandra: `localhost:9042`

The root compose file initializes PostgreSQL on the first database volume creation and initializes
the Cassandra playback keyspace/table with `cassandra-init`. If you already have a persistent
PostgreSQL volume, Docker will not re-run the init SQL; apply the schema manually if needed.

## Verify

```bash
curl http://localhost:5002/health
curl http://localhost:8080/api/users/health
```

Register or log in through Account Service to obtain an access token. Use the same token for
Streaming Service. First subscribe to one of the demo plans; playback start checks entitlement.

See `services/streaming-service/README.md` for API examples, media layout, event contract and
Flink-to-Cassandra responsibilities.

## Scope and honest integration notes

- The Node.js Streaming & Playback API is implemented in this delivery.
- Account Service is included from the uploaded project ZIP, unchanged at application-source level.
  Dockerfiles are added for both services.
- The supplied `docker-compose.yml` did not include PostgreSQL or Redis; they are added here.
- The uploaded ZIP did not include the `zuul-real/` source directory. The compose file retains the
  gateway build reference, and the new streaming route is supplied as a properties snippet. You
  must merge it into your actual gateway configuration.
- Flink itself is present in Compose, but the Flink processing job is not part of this Node.js
  backend assignment. The backend publishes `playback.events`; a Flink job must consume that topic
  and sink the event rows to the supplied Cassandra table for history queries to return data.
- Actual licensed video files are not supplied. Place MP4/HLS assets under `media/<videoId>/`.
- This is a project/demo implementation, not a production DRM platform. Production deployment needs
  TLS, secret management, authenticated service-to-service networking, media origin/CDN, DRM,
  monitoring, backups, and a multi-node Kafka/Cassandra design.
