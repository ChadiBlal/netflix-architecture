# Netflix System Architecture Project

Database Systems (DBS) project, ENSIASD (DEIS), Prof. S. EL-ATEIF, academic year 2026-2027.

An educational, Netflix-inspired platform that shows how different database and data-engineering technologies work together (polyglot persistence). It is **not** a copy of Netflix's production infrastructure: the goal is to demonstrate selected architectural principles with a working prototype, with the focus on the **data layer**.

## Architecture

```
                       +--> Account Service (5001) ----> PostgreSQL
Browser --> Zuul (8080)|                        \------> Redis (sessions, optional)
                       +--> Playback & Catalogue Service (5002) --> PostgreSQL (catalogue)
                                         |  \--> Redis (playback position)
                                         |  \--> Local MP4 files (video delivery)
                                         v
                                       Kafka --> Flink --> Cassandra (viewing history)
```

- **Transactional path (ACID):** registration, authentication, subscriptions, catalogue metadata -> PostgreSQL.
- **High-velocity path (BASE):** playback progress events -> Kafka -> Flink -> Cassandra.
- **Cache:** Redis keeps the latest playback position for the "Continue Watching" row. Continue Watching reads Redis first and falls back to Cassandra.
- **Video delivery** is a separate path: Browser -> Zuul -> Playback Service -> local MP4 file (HTTP Range requests, no transcoding).

### Technologies

| Technology | Purpose | Runs |
|---|---|---|
| HTML, CSS, Vanilla JavaScript | Frontend | Browser |
| Netflix Zuul (Java) | API Gateway | Docker |
| Node.js + Express | Two backend microservices | Windows (native) |
| PostgreSQL | Relational database | Windows (native) |
| Redis | In-memory cache | Windows (native) |
| Apache Kafka (+ ZooKeeper) | Event streaming | Docker |
| Apache Flink | Stream processing | Docker |
| Apache Cassandra | Persistent viewing history | Docker |
| Python (Faker) | Data generation scripts | Windows (native) |

### Gateway routes

| Request path | Forwarded to |
|---|---|
| `/api/users/**` | Account Service (port 5001) |
| `/api/catalog/**` | Playback & Catalogue Service (port 5002) |
| `/api/playback/**` | Playback & Catalogue Service (port 5002) |
| `/videos/**` | Playback & Catalogue Service (port 5002) |

The path is forwarded **unchanged**, so the Express routes must be written with the same `/api/...` paths.

### Ports

| Component | Address |
|---|---|
| Zuul API Gateway | `localhost:8080` |
| Account Service | `localhost:5001` |
| Playback & Catalogue Service | `localhost:5002` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |
| Kafka (from Windows, topic `playback-events`) | `localhost:9092` |
| Kafka (from inside Docker, e.g. Flink) | `kafka:19092` |
| Cassandra | `localhost:9042` |
| Flink dashboard | `localhost:8081` |

## Project Structure

```
netflix-architecture/
├── docker-compose.yml        # Kafka, ZooKeeper, Cassandra, Flink, Zuul
├── .env.example              # Optional settings for docker compose
├── zuul-real/                # Zuul gateway (Dockerfile + routing overrides)
│   ├── Dockerfile
│   └── overrides/
├── services/
│   ├── account-service/      # Node.js + Express, port 5001
│   └── playback-service/     # Node.js + Express, port 5002
├── frontend/                 # HTML / CSS / JavaScript
├── flink-job/                # Flink job: Kafka -> Cassandra
├── databases/
│   ├── postgresql_schema.sql
│   ├── cassandra_schema.cql
│   └── redis_config.conf
├── queries/
│   ├── postgresql_queries.sql
│   ├── cassandra_queries.cql
│   └── redis_commands.txt
├── scripts/                  # Data generation (Python + Faker)
│   ├── generate_users.py
│   ├── generate_videos.py
│   ├── generate_history.py
│   └── requirements.txt
├── docs/                     # Architecture and schema diagrams
├── presentations/            # Notes for presentations 1 to 4
├── reports/                  # Final report
├── samples/                  # Sample data
├── screenshots/              # Screenshots of the running system
├── INSTALLATION.md           # Full installation guide
├── AI_PROMPTS.md             # AI usage disclosure (UI code prompts and references)
├── README.md
└── .gitignore
```

Some of these files and folders are added as the project progresses.

## Getting Started

Full step-by-step instructions are in [INSTALLATION.md](INSTALLATION.md). In short:

1. **Install** PostgreSQL, Redis, Docker Desktop and Node.js (INSTALLATION.md, Parts 1 to 3).
2. **Clone** the repository:
   ```bash
   git clone https://github.com/ChadiBlal/netflix-architecture.git
   cd netflix-architecture
   ```
3. **Start PostgreSQL and Redis** (both run natively on Windows).
4. **Start the Docker infrastructure** (Docker Desktop must be running):
   ```bash
   docker compose up -d --build
   ```
   The first run takes several minutes because the Zuul gateway is built from source.
5. **Check it works:**
   - Flink dashboard: http://localhost:8081
   - Zuul health check: http://localhost:8080/healthcheck
6. **Start the two Node.js services** (ports 5001 and 5002), then open the frontend.

To stop the Docker services: `docker compose down` (data is kept). Use `docker compose down -v` only if you want to delete the data.

## Notes for the Team

- The Node.js services run on Windows, outside Docker. Zuul (inside Docker) reaches them through `host.docker.internal`. If requests through port 8080 fail, check that the service is running and that Windows Firewall allows Node.js.
- Video files (MP4) are **not** committed to the repository because they are large. Each team member keeps them in a local media folder.
- Never commit passwords or `.env` files. Use `.env.example` for templates.
- Everything related to the database layer (schemas, queries, indexing, optimization) is written by the team without AI assistance, as required by the course. AI use for the UI is listed in `AI_PROMPTS.md`.
