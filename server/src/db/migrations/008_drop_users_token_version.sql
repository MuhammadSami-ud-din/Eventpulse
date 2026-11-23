-- Superseded by per-token revocation in refresh_tokens.
ALTER TABLE users DROP COLUMN token_version;
