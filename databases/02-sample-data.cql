-- Sample data. Run after 01-schema.cql: cqlsh -f 02-sample-data.cql
-- ids match the PostgreSQL seed: profiles 1-3, titles 1-18.

USE netflix_ops;

-- ---------- viewing_progress ----------
-- profile 1 (Sara): one in progress, one almost done, one finished
INSERT INTO viewing_progress (profile_id, title_id, episode_id, pct, position_seconds, duration_seconds, completed, last_watched_at)
VALUES (1, 3, null, 37.5, 2700, 7200, false, '2026-11-14 21:05:11+0000');
INSERT INTO viewing_progress (profile_id, title_id, episode_id, pct, position_seconds, duration_seconds, completed, last_watched_at)
VALUES (1, 7, null, 80.0, 5760, 7200, false, '2026-11-13 20:40:00+0000');
INSERT INTO viewing_progress (profile_id, title_id, episode_id, pct, position_seconds, duration_seconds, completed, last_watched_at)
VALUES (1, 12, null, 97.0, 5820, 6000, true, '2026-11-10 22:15:30+0000');

-- profile 2
INSERT INTO viewing_progress (profile_id, title_id, episode_id, pct, position_seconds, duration_seconds, completed, last_watched_at)
VALUES (2, 3, null, 12.0, 864, 7200, false, '2026-11-14 18:00:00+0000');
INSERT INTO viewing_progress (profile_id, title_id, episode_id, pct, position_seconds, duration_seconds, completed, last_watched_at)
VALUES (2, 5, null, 55.0, 2970, 5400, false, '2026-11-12 19:30:00+0000');

-- profile 3
INSERT INTO viewing_progress (profile_id, title_id, episode_id, pct, position_seconds, duration_seconds, completed, last_watched_at)
VALUES (3, 1, null, 96.5, 5790, 6000, true, '2026-11-11 21:00:00+0000');

-- ---------- viewing_history (profile 1, November 2026) ----------
INSERT INTO viewing_history (profile_id, month_bucket, watched_on, title_id, episode_id, pct, completed, last_watched_at, device)
VALUES (1, '2026-11', '2026-11-14', 3, null, 37.5, false, '2026-11-14 21:05:11+0000', 'web');
INSERT INTO viewing_history (profile_id, month_bucket, watched_on, title_id, episode_id, pct, completed, last_watched_at, device)
VALUES (1, '2026-11', '2026-11-13', 7, null, 80.0, false, '2026-11-13 20:40:00+0000', 'mobile');
INSERT INTO viewing_history (profile_id, month_bucket, watched_on, title_id, episode_id, pct, completed, last_watched_at, device)
VALUES (1, '2026-11', '2026-11-10', 12, null, 97.0, true, '2026-11-10 22:15:30+0000', 'web');
INSERT INTO viewing_history (profile_id, month_bucket, watched_on, title_id, episode_id, pct, completed, last_watched_at, device)
VALUES (1, '2026-11', '2026-11-02', 5, null, 100.0, true, '2026-11-02 21:30:00+0000', 'tv');
-- an older month, to test paging backwards
INSERT INTO viewing_history (profile_id, month_bucket, watched_on, title_id, episode_id, pct, completed, last_watched_at, device)
VALUES (1, '2026-10', '2026-10-28', 9, null, 100.0, true, '2026-10-28 20:00:00+0000', 'web');

-- ---------- playback_events (profile 1, 14 Nov 2026) ----------
INSERT INTO playback_events (profile_id, day, event_ts, title_id, event_type, pct, position_seconds, device)
VALUES (1, '2026-11-14', '2026-11-14 20:30:00+0000', 3, 'start', 0.0, 0, 'web');
INSERT INTO playback_events (profile_id, day, event_ts, title_id, event_type, pct, position_seconds, device)
VALUES (1, '2026-11-14', '2026-11-14 20:45:05+0000', 3, 'progress', 12.5, 900, 'web');
INSERT INTO playback_events (profile_id, day, event_ts, title_id, event_type, pct, position_seconds, device)
VALUES (1, '2026-11-14', '2026-11-14 21:00:10+0000', 3, 'progress', 31.0, 2232, 'web');
INSERT INTO playback_events (profile_id, day, event_ts, title_id, event_type, pct, position_seconds, device)
VALUES (1, '2026-11-14', '2026-11-14 21:05:11+0000', 3, 'stop', 37.5, 2700, 'web');

-- ---------- user_activity (profile 1, 14 Nov 2026) ----------
INSERT INTO user_activity (profile_id, day, activity_ts, activity_type, title_id, details)
VALUES (1, '2026-11-14', '2026-11-14 20:10:00+0000', 'search', null, {'query': 'space'});
INSERT INTO user_activity (profile_id, day, activity_ts, activity_type, title_id, details)
VALUES (1, '2026-11-14', '2026-11-14 20:12:30+0000', 'open_details', 3, {'source': 'search'});
INSERT INTO user_activity (profile_id, day, activity_ts, activity_type, title_id, details)
VALUES (1, '2026-11-14', '2026-11-14 20:13:00+0000', 'add_to_list', 3, {});

-- ---------- title_daily_stats (counters use UPDATE, not INSERT) ----------
UPDATE title_daily_stats SET views = views + 120, completions = completions + 45 WHERE title_id = 3 AND day = '2026-11-14';
UPDATE title_daily_stats SET views = views + 98,  completions = completions + 30 WHERE title_id = 3 AND day = '2026-11-13';
UPDATE title_daily_stats SET views = views + 64,  completions = completions + 21 WHERE title_id = 7 AND day = '2026-11-14';
