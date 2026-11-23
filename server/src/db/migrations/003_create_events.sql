CREATE TABLE events (
  id                        INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  organizer_id              INT UNSIGNED      NOT NULL,
  category_id               INT UNSIGNED      NOT NULL,
  title                     VARCHAR(150)      NOT NULL,
  description               TEXT              NOT NULL,
  venue                     VARCHAR(150)      NOT NULL,
  starts_at                 DATETIME          NOT NULL,
  ends_at                   DATETIME          NOT NULL,
  registration_deadline     DATETIME          NOT NULL,
  -- Students may cancel until this many hours before starts_at.
  cancellation_window_hours SMALLINT UNSIGNED NOT NULL DEFAULT 24,
  capacity                  INT UNSIGNED      NOT NULL,
  -- Denormalised seat counter, updated only inside registration transactions
  -- while the event row is locked. Cheaper to read than COUNT(*) on every list.
  confirmed_count           INT UNSIGNED      NOT NULL DEFAULT 0,
  status                    ENUM('draft', 'pending', 'published', 'rejected', 'closed') NOT NULL DEFAULT 'draft',
  rejection_reason          VARCHAR(255)      NULL,
  reviewed_by               INT UNSIGNED      NULL,
  reviewed_at               DATETIME          NULL,
  created_at                DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_id) REFERENCES users (id),
  CONSTRAINT fk_events_category  FOREIGN KEY (category_id)  REFERENCES event_categories (id),
  CONSTRAINT fk_events_reviewer  FOREIGN KEY (reviewed_by)  REFERENCES users (id) ON DELETE SET NULL,

  -- Database-level guard: even a buggy code path cannot overbook an event.
  CONSTRAINT chk_events_seats     CHECK (confirmed_count <= capacity),
  CONSTRAINT chk_events_capacity  CHECK (capacity BETWEEN 1 AND 100000),
  CONSTRAINT chk_events_timespan  CHECK (ends_at > starts_at),
  CONSTRAINT chk_events_deadline  CHECK (registration_deadline <= starts_at),
  CONSTRAINT chk_events_rejection CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL),

  -- Public listing filters by status and sorts/filters by date.
  KEY idx_events_status_starts   (status, starts_at),
  KEY idx_events_category_starts (category_id, starts_at),
  KEY idx_events_organizer       (organizer_id, starts_at),
  FULLTEXT KEY ft_events_search  (title, description, venue)
) ENGINE=InnoDB;
