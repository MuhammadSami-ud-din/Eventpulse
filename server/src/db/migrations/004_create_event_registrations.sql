CREATE TABLE event_registrations (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id          INT UNSIGNED NOT NULL,
  user_id           INT UNSIGNED NOT NULL,
  status            ENUM('confirmed', 'waitlisted', 'cancelled') NOT NULL,
  waitlist_position INT UNSIGNED NULL,
  ticket_code       CHAR(10)     NOT NULL,
  -- 1 for active rows, NULL for cancelled ones. MySQL has no partial unique
  -- index, but a UNIQUE key ignores NULLs, so (event, user, active_marker)
  -- allows only one active registration while keeping cancelled history and
  -- letting a student register again after cancelling.
  active_marker     TINYINT GENERATED ALWAYS AS (IF(status = 'cancelled', NULL, 1)) STORED,
  registered_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  promoted_at       DATETIME     NULL,
  cancelled_at      DATETIME     NULL,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_registrations_event FOREIGN KEY (event_id) REFERENCES events (id),
  CONSTRAINT fk_registrations_user  FOREIGN KEY (user_id)  REFERENCES users (id),

  UNIQUE KEY uq_registrations_active (event_id, user_id, active_marker),
  -- Position is cleared on promotion/cancellation, so live positions never collide.
  UNIQUE KEY uq_registrations_waitlist_position (event_id, waitlist_position),
  UNIQUE KEY uq_registrations_ticket_code (ticket_code),

  CONSTRAINT chk_registrations_waitlist  CHECK ((status = 'waitlisted') = (waitlist_position IS NOT NULL)),
  CONSTRAINT chk_registrations_cancelled CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),

  KEY idx_registrations_event_status (event_id, status),
  KEY idx_registrations_user_status  (user_id, status)
) ENGINE=InnoDB;
