-- Profile pictures. Stored in the database rather than on disk, because many
-- hosts wipe the file system on every deploy. One row per user; the image
-- data is kept out of the users table so ordinary user queries never load it.
CREATE TABLE user_avatars (
  user_id    INT UNSIGNED NOT NULL,
  data       MEDIUMBLOB   NOT NULL,
  -- The type found from the file's own bytes, never the one the client claimed.
  mime_type  ENUM('image/jpeg', 'image/png', 'image/webp') NOT NULL,
  byte_size  INT UNSIGNED NOT NULL,
  -- Millisecond precision: it doubles as the image's version in its URL.
  updated_at DATETIME(3)  NOT NULL,

  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_avatars_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  -- The same 1 MB limit the API enforces.
  CONSTRAINT chk_user_avatars_size CHECK (byte_size BETWEEN 1 AND 1048576)
) ENGINE=InnoDB;
