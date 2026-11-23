CREATE TABLE notifications (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED    NOT NULL,
  event_id   INT UNSIGNED    NULL,
  type       ENUM(
               'registration_confirmed',
               'waitlisted',
               'promoted',
               'registration_cancelled',
               'event_approved',
               'event_rejected'
             ) NOT NULL,
  title      VARCHAR(150)    NOT NULL,
  message    VARCHAR(500)    NOT NULL,
  read_at    DATETIME        NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_notifications_user  FOREIGN KEY (user_id)  REFERENCES users (id)  ON DELETE CASCADE,
  CONSTRAINT fk_notifications_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE SET NULL,

  -- Serves "my notifications, newest first" and the unread badge count.
  KEY idx_notifications_user_created (user_id, created_at),
  KEY idx_notifications_user_unread  (user_id, read_at)
) ENGINE=InnoDB;
