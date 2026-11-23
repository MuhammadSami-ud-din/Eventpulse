-- One row per issued refresh token. Storing them (instead of relying only on
-- the JWT signature) lets logout revoke a single device and lets the refresh
-- endpoint detect a stolen token being replayed after it was rotated.
CREATE TABLE refresh_tokens (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  jti        CHAR(36)     NOT NULL,
  expires_at DATETIME     NOT NULL,
  revoked_at DATETIME     NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_tokens_jti (jti),
  KEY idx_refresh_tokens_user (user_id, revoked_at),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
