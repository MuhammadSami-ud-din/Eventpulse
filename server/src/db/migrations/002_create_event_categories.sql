CREATE TABLE event_categories (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(50)  NOT NULL,
  slug        VARCHAR(60)  NOT NULL,
  description VARCHAR(255) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_event_categories_name (name),
  UNIQUE KEY uq_event_categories_slug (slug)
) ENGINE=InnoDB;
