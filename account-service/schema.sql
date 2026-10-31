-- Account and purchase ownership schema for REG.RU MySQL/MariaDB.
-- Does not modify existing bot users, Telegram profiles or tables.
-- Run transactionally where supported; back up database before application.
CREATE TABLE IF NOT EXISTS numi_accounts (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  email VARCHAR(191) NULL,
  password_hash VARCHAR(255) NULL,
  display_name VARCHAR(80) NOT NULL DEFAULT 'Пользователь',
  email_verified_at DATETIME NULL,
  birth_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_numi_account_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS numi_identities (
  provider VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  provider_user_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, provider_user_id),
  KEY ix_numi_identity_account (account_id),
  CONSTRAINT fk_numi_identity_owner FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS numi_sessions (
  session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NULL,
  KEY ix_numi_sessions_account (account_id),
  KEY ix_numi_sessions_expiry (expires_at),
  CONSTRAINT fk_numi_sessions_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS numi_tokens (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  purpose ENUM('verify_email','reset_password') NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_numi_tokens_account_purpose (account_id,purpose),
  CONSTRAINT fk_numi_tokens_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS numi_auth_attempts (
  bucket_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_numi_attempts_bucket (bucket_hash,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS numi_orders (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  product_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  resource_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  amount_kopeks INT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'RUB',
  provider VARCHAR(50) NULL,
  provider_payment_id VARCHAR(191) NULL,
  status ENUM('pending','paid','refunded','cancelled') NOT NULL DEFAULT 'pending',
  verified_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_numi_payment (provider,provider_payment_id),
  KEY ix_numi_orders_account (account_id,status),
  CONSTRAINT fk_numi_orders_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS numi_entitlements (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  product_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  resource_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status ENUM('active','revoked') NOT NULL DEFAULT 'active',
  expires_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_numi_entitlement_order (order_id),
  KEY ix_numi_entitlement_account_resource (account_id,product_code,resource_id,status),
  CONSTRAINT fk_numi_entitlement_account FOREIGN KEY(account_id) REFERENCES numi_accounts(id),
  CONSTRAINT fk_numi_entitlement_order FOREIGN KEY(order_id) REFERENCES numi_orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User-controlled privacy of the "Saved" list. Does not modify purchases,
-- payment state or entitlements. Also created idempotently by the API if needed.
CREATE TABLE IF NOT EXISTS numi_saved_hidden (
  entitlement_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  hidden_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_numi_saved_hidden_entitlement
    FOREIGN KEY (entitlement_id) REFERENCES numi_entitlements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Strictly sandboxed owner-only checkout rehearsal. NOT a real order or entitlement.
CREATE TABLE IF NOT EXISTS numi_test_purchases (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  product_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  resource_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  title VARCHAR(180) NOT NULL,
  test_answer TEXT NOT NULL,
  hidden_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ix_numi_test_purchases_account(account_id,hidden_at,created_at),
  CONSTRAINT fk_numi_test_purchases_owner FOREIGN KEY(account_id) REFERENCES numi_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
