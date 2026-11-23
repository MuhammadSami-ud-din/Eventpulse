CREATE TABLE event_attendance (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  registration_id INT UNSIGNED NOT NULL,
  status          ENUM('attended', 'no_show') NOT NULL,
  checked_in_at   DATETIME     NULL,
  marked_by       INT UNSIGNED NULL,
  marked_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  -- One attendance record per registration; re-marking updates it.
  UNIQUE KEY uq_attendance_registration (registration_id),
  CONSTRAINT fk_attendance_registration FOREIGN KEY (registration_id) REFERENCES event_registrations (id),
  CONSTRAINT fk_attendance_marked_by    FOREIGN KEY (marked_by)       REFERENCES users (id) ON DELETE SET NULL,

  CONSTRAINT chk_attendance_checkin CHECK ((status = 'attended') = (checked_in_at IS NOT NULL))
) ENGINE=InnoDB;
