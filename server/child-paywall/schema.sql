-- Private MySQL/MariaDB schema for one paid child report per child record.
-- Run on REG.RU, never from public JavaScript.
CREATE TABLE IF NOT EXISTS user_accounts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 provider VARCHAR(24) NOT NULL,
 provider_user_id VARCHAR(191) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_account_provider (provider, provider_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS child_profiles (
 id CHAR(36) NOT NULL PRIMARY KEY,
 account_id BIGINT UNSIGNED NOT NULL,
 birth_date DATE NOT NULL,
 nickname VARCHAR(80) NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_children_owner (account_id),
 CONSTRAINT fk_children_account FOREIGN KEY (account_id) REFERENCES user_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS child_purchases (
 id CHAR(36) NOT NULL PRIMARY KEY,
 account_id BIGINT UNSIGNED NOT NULL,
 child_id CHAR(36) NOT NULL,
 product_code VARCHAR(40) NOT NULL DEFAULT 'child_full_v1',
 amount_kopeks INT UNSIGNED NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'RUB',
 payment_provider VARCHAR(50) NULL,
 provider_payment_id VARCHAR(191) NULL,
 status ENUM('pending','paid','refunded','cancelled') NOT NULL DEFAULT 'pending',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 verified_at TIMESTAMP NULL,
 UNIQUE KEY uq_provider_payment (payment_provider, provider_payment_id),
 INDEX ix_child_orders (account_id,child_id,status),
 CONSTRAINT fk_purchase_account FOREIGN KEY (account_id) REFERENCES user_accounts(id),
 CONSTRAINT fk_purchase_child FOREIGN KEY (child_id) REFERENCES child_profiles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS child_entitlements (
 account_id BIGINT UNSIGNED NOT NULL,
 child_id CHAR(36) NOT NULL,
 product_code VARCHAR(40) NOT NULL DEFAULT 'child_full_v1',
 purchase_id CHAR(36) NOT NULL,
 status ENUM('active','revoked') NOT NULL DEFAULT 'active',
 granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 revoked_at TIMESTAMP NULL,
 PRIMARY KEY (account_id,child_id,product_code),
 CONSTRAINT fk_entitlement_account FOREIGN KEY (account_id) REFERENCES user_accounts(id),
 CONSTRAINT fk_entitlement_child FOREIGN KEY (child_id) REFERENCES child_profiles(id),
 CONSTRAINT fk_entitlement_purchase FOREIGN KEY (purchase_id) REFERENCES child_purchases(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
