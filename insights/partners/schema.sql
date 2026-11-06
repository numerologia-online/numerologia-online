-- Partner attribution, isolated from the existing analytics, login and order tables.
-- Apply only after a database backup and preflight. All times are UTC.
CREATE TABLE IF NOT EXISTS numi_partner_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  label VARCHAR(80) NOT NULL,
  rate_bps SMALLINT UNSIGNED NOT NULL DEFAULT 2500,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_partner_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS numi_partner_tokens (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  partner_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  KEY ix_partner_token_expiry (expires_at),
  KEY ix_partner_token_partner (partner_id),
  CONSTRAINT fk_partner_token_partner FOREIGN KEY (partner_id)
    REFERENCES numi_partner_codes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS numi_partner_clicks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  partner_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  clicked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_partner_clicks_by_day (clicked_at,partner_id),
  KEY ix_partner_clicks_partner_day (partner_id,clicked_at),
  CONSTRAINT fk_partner_clicks_partner FOREIGN KEY (partner_id)
    REFERENCES numi_partner_codes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS numi_partner_accounts (
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  partner_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  bound_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  KEY ix_partner_accounts_partner (partner_id,bound_at),
  CONSTRAINT fk_partner_accounts_account FOREIGN KEY (account_id)
    REFERENCES numi_accounts(id),
  CONSTRAINT fk_partner_accounts_partner FOREIGN KEY (partner_id)
    REFERENCES numi_partner_codes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
