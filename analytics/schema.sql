-- Anonymous aggregate site events; no user ID, IP, cookies or raw search strings.
-- Deploy ONLY after backup and explicit schema migration on REG.RU.
CREATE TABLE IF NOT EXISTS numi_analytics_daily (
  day_utc DATE NOT NULL,
  event_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  section VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  item VARCHAR(72) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  campaign VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (day_utc,event_type,section,item,campaign),
  KEY ix_numi_analytics_section (section,day_utc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
