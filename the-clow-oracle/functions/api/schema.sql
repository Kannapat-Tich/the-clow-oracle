-- THE CLOW — Cloudflare D1 Schema for Data Science Analytics
-- Run once on Cloudflare D1:
-- wrangler d1 execute the-clow-analytics --file=functions/api/schema.sql

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,         -- page_view | spread_start | card_draw | card_reveal | summary_view | summary_share
  session_id TEXT NOT NULL,         -- anonymous random session UUID (no PII / no IP / no user question)
  spread_id TEXT,                   -- daily_single | love_cross | general_six
  spread_name TEXT,
  card_id TEXT,                     -- e.g. the_windy
  card_name TEXT,                   -- e.g. THE WINDY
  pos_index INTEGER,                -- 1..6
  ai_mode TEXT,                     -- live | demo | fallback_synthesis
  viewport_w INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_spread ON analytics_events(spread_id);
CREATE INDEX IF NOT EXISTS idx_events_card ON analytics_events(card_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON analytics_events(created_at);
