-- Main queries. Run in cqlsh to test: cqlsh -f 03-queries.cql
-- In the backend these are PREPARED statements: replace values by ?.
-- Every query below hits ONE partition (no scatter-gather).

USE netflix_ops;

-- ===== Q1. Continue Watching row  (GET /api/continue-watching)
-- Consistency: LOCAL_QUORUM (the user must see the position just saved)
-- Backend then keeps rows with completed = false and pct > 0,
-- sorts by last_watched_at desc, and joins title data from PostgreSQL.
CONSISTENCY LOCAL_QUORUM;
SELECT title_id, episode_id, pct, position_seconds, completed, last_watched_at
FROM viewing_progress
WHERE profile_id = 1;

-- ===== Q2. Resume position of one title (Resume button)
SELECT pct, position_seconds, duration_seconds, last_watched_at
FROM viewing_progress
WHERE profile_id = 1 AND title_id = 3;

-- ===== Q3. Save progress (POST /api/playback/progress, done by the Flink job)
-- USING TIMESTAMP = event time in microseconds, so an older event
-- replayed late cannot overwrite a newer position.
-- Consistency: LOCAL_QUORUM. Naturally idempotent (same key = same row).
INSERT INTO viewing_progress (profile_id, title_id, pct, position_seconds, duration_seconds, completed, last_watched_at)
VALUES (1, 3, 40.0, 2880, 7200, false, '2026-11-14 21:10:00+0000')
USING TIMESTAMP 1794690600000000;

-- ===== Q4. Viewing history, newest first, one month per page
-- Consistency: LOCAL_ONE (a slightly stale history page is acceptable)
CONSISTENCY LOCAL_ONE;
SELECT watched_on, title_id, pct, completed, device
FROM viewing_history
WHERE profile_id = 1 AND month_bucket = '2026-11'
LIMIT 20;

-- Next page = previous month (the backend decrements month_bucket
-- until it has enough rows)
SELECT watched_on, title_id, pct, completed, device
FROM viewing_history
WHERE profile_id = 1 AND month_bucket = '2026-10'
LIMIT 20;

-- ===== Q5. Record a history entry (same key per day = update)
CONSISTENCY LOCAL_QUORUM;
INSERT INTO viewing_history (profile_id, month_bucket, watched_on, title_id, pct, completed, last_watched_at, device)
VALUES (1, '2026-11', '2026-11-14', 3, 40.0, false, '2026-11-14 21:10:00+0000', 'web');

-- ===== Q6. Raw events of one profile on one day (debug / analytics)
CONSISTENCY LOCAL_ONE;
SELECT event_ts, title_id, event_type, pct, position_seconds
FROM playback_events
WHERE profile_id = 1 AND day = '2026-11-14'
LIMIT 100;

-- Time range inside a day (clustering key range)
SELECT event_ts, event_type, pct
FROM playback_events
WHERE profile_id = 1 AND day = '2026-11-14'
  AND event_ts >= '2026-11-14 21:00:00+0000'
  AND event_ts <= '2026-11-14 21:30:00+0000';

-- ===== Q7. Write one event. Consistency LOCAL_ONE: losing one
-- progress tick is harmless, speed matters more.
INSERT INTO playback_events (profile_id, day, event_ts, title_id, event_type, pct, position_seconds, device)
VALUES (1, '2026-11-14', '2026-11-14 21:10:00+0000', 3, 'progress', 40.0, 2880, 'web');

-- ===== Q8. User activity of one day, and a write
SELECT activity_ts, activity_type, title_id, details
FROM user_activity
WHERE profile_id = 1 AND day = '2026-11-14';

INSERT INTO user_activity (profile_id, day, activity_ts, activity_type, title_id, details)
VALUES (1, '2026-11-14', '2026-11-14 21:20:00+0000', 'search', null, {'query': 'drama'});

-- ===== Q9. Count a view, and read the last 7 days of a title
UPDATE title_daily_stats SET views = views + 1 WHERE title_id = 3 AND day = '2026-11-14';

SELECT day, views, completions
FROM title_daily_stats
WHERE title_id = 3 AND day >= '2026-11-08';

-- ===== Q10. Delete a profile's progress (when the profile is deleted in PostgreSQL)
-- Whole-partition delete = one tombstone. History, events and activity
-- are bucketed, so a cleanup job deletes them bucket by bucket (or lets
-- the TTL remove events and activity).
-- DELETE FROM viewing_progress WHERE profile_id = 3;
-- DELETE FROM viewing_history  WHERE profile_id = 3 AND month_bucket = '2026-11';
