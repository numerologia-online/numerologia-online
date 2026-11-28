-- Isolated estimates only, apply before enabling the private feature flag.
CREATE TABLE IF NOT EXISTS numi_referral_codes (
 code CHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME NOT NULL,
 KEY ix_ref_owner(owner_id,created_at),
 FOREIGN KEY(owner_id) REFERENCES numi_accounts(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS numi_referral_bindings (
 invitee_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 inviter_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 bound_at DATETIME NOT NULL,
 state ENUM('active','review') NOT NULL DEFAULT 'active',
 KEY ix_ref_inviter(inviter_id,state,bound_at),
 FOREIGN KEY(invitee_id) REFERENCES numi_accounts(id),
 FOREIGN KEY(inviter_id) REFERENCES numi_accounts(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS numi_referral_rewards (
 order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 invitee_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 amount_kopeks INT UNSIGNED NOT NULL,
 reward_kopeks INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL,
 release_at DATETIME NOT NULL,
 KEY ix_ref_reward_invitee(invitee_id),
 FOREIGN KEY(order_id) REFERENCES numi_orders(id),
 FOREIGN KEY(invitee_id) REFERENCES numi_referral_bindings(invitee_id)
) ENGINE=InnoDB;
