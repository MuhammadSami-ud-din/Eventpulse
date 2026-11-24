-- Event cover images, stored like avatars (see 009_create_user_avatars.sql).
CREATE TABLE event_covers (
  event_id   INT UNSIGNED NOT NULL,
  data       MEDIUMBLOB   NOT NULL,
  mime_type  ENUM('image/jpeg', 'image/png', 'image/webp') NOT NULL,
  byte_size  INT UNSIGNED NOT NULL,
  updated_at DATETIME(3)  NOT NULL,

  PRIMARY KEY (event_id),
  CONSTRAINT fk_event_covers_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
  CONSTRAINT chk_event_covers_size CHECK (byte_size BETWEEN 1 AND 1048576)
) ENGINE=InnoDB;
