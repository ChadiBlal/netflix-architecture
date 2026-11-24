-- ============================================================
-- Netflix data layer - Cassandra schema (keyspace netflix_ops)
-- Run: cqlsh -f 01-schema.cql
--
-- Rules followed:
--   * One table per query (query-first modeling)
--   * No joins, no foreign keys: ids come from PostgreSQL
--   * Every partition is bounded (bucketed by day or month)
-- ============================================================

-- DEV (1 node): replication factor 1.
-- 3-node cluster: change 'datacenter1': 1 to 'datacenter1': 3.
CREATE KEYSPACE IF NOT EXISTS netflix_ops
  WITH replication = {'class': 'NetworkTopologyStrategy', 'datacenter1': 1}
  AND durable_writes = true;

USE netflix_ops;

-- ------------------------------------------------------------
-- 1) viewing_progress : latest position per profile and title
--    Serves: "Continue Watching" row and the Resume button
--    Partition = one profile (bounded: a profile watches
--    hundreds of titles, not millions)
--    Written with USING TIMESTAMP = event time, so a late
--    Kafka message can never overwrite a newer position.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS viewing_progress (
    profile_id       bigint,
    title_id         bigint,
    episode_id       bigint,      -- last episode watched (null for movies)
    pct              double,      -- 0-100, what the frontend sends
    position_seconds int,
    duration_seconds int,
    completed        boolean,     -- true when pct >= 95
    last_watched_at  timestamp,
    PRIMARY KEY ((profile_id), title_id)
) WITH comment = 'Latest progress per profile and title';

-- ------------------------------------------------------------
-- 2) viewing_history : one row per profile, title and day
--    Serves: "Viewing activity" page, newest first, paged by month
--    Partition = (profile, month): at most ~30 days x few titles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS viewing_history (
    profile_id      bigint,
    month_bucket    text,         -- 'YYYY-MM'
    watched_on      date,
    title_id        bigint,
    episode_id      bigint,
    pct             double,
    completed       boolean,
    last_watched_at timestamp,
    device          text,
    PRIMARY KEY ((profile_id, month_bucket), watched_on, title_id)
) WITH CLUSTERING ORDER BY (watched_on DESC, title_id ASC)
  AND comment = 'Viewing history, newest first';

-- ------------------------------------------------------------
-- 3) playback_events : raw progress events (time series)
--    Serves: debugging, analytics export, replay
--    Partition = (profile, day): ~1 event / 5 s => < 6000 rows/day
--    Retention: 90 days via TTL, TWC compaction drops whole
--    SSTables when the window expires.
--    Primary key has no random id: replaying the same Kafka
--    message rewrites the same row (idempotent).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS playback_events (
    profile_id       bigint,
    day              date,
    event_ts         timestamp,
    title_id         bigint,
    event_type       text,        -- progress | start | stop | finish
    pct              double,
    position_seconds int,
    device           text,
    PRIMARY KEY ((profile_id, day), event_ts, title_id)
) WITH CLUSTERING ORDER BY (event_ts DESC, title_id ASC)
  AND default_time_to_live = 7776000          -- 90 days
  AND compaction = {
      'class': 'TimeWindowCompactionStrategy',
      'compaction_window_unit': 'DAYS',
      'compaction_window_size': 1}
  AND comment = 'Raw playback events, 90 days';

-- ------------------------------------------------------------
-- 4) user_activity : searches, My List changes, opened details
--    Serves: personalization inputs and analytics
--    Partition = (profile, day). Retention: 180 days.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_activity (
    profile_id    bigint,
    day           date,
    activity_ts   timestamp,
    activity_type text,           -- search | add_to_list | remove_from_list | open_details
    title_id      bigint,
    details       map<text, text>,
    PRIMARY KEY ((profile_id, day), activity_ts, activity_type)
) WITH CLUSTERING ORDER BY (activity_ts DESC, activity_type ASC)
  AND default_time_to_live = 15552000         -- 180 days
  AND compaction = {
      'class': 'TimeWindowCompactionStrategy',
      'compaction_window_unit': 'DAYS',
      'compaction_window_size': 1}
  AND comment = 'User activity, 180 days';

-- ------------------------------------------------------------
-- 5) title_daily_stats : views per title and day (counters)
--    Serves: "popular titles" and admin dashboards
--    Counter tables cannot hold other column types and cannot
--    use TTL. Counters are not idempotent: a retry can count
--    twice, so use them for statistics only, never for billing.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS title_daily_stats (
    title_id    bigint,
    day         date,
    views       counter,
    completions counter,
    PRIMARY KEY ((title_id), day)
) WITH CLUSTERING ORDER BY (day DESC)
  AND comment = 'Daily view counters per title';
