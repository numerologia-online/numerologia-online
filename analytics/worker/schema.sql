-- Apply to a dedicated Cloudflare D1 database before deploying analytics Worker.
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  item TEXT NOT NULL DEFAULT '',
  section TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'direct',
  session TEXT NOT NULL DEFAULT '',
  amount_kopecks INTEGER NOT NULL DEFAULT 0,
  event_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS analytics_paid_id ON analytics_events(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS analytics_event_created ON analytics_events(event,created_at);
CREATE INDEX IF NOT EXISTS analytics_item_event ON analytics_events(item,event);
