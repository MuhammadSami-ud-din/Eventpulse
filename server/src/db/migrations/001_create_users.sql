CREATE TABLE users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name      VARCHAR(100) NOT NULL,
  email          VARCHAR(255) NOT NULL,
  password_hash  CHAR(60)     NOT NULL,
  role           ENUM('student', 'organizer', 'admin') NOT NULL DEFAULT 'student',
  department     VARCHAR(100) NULL,
  -- University registration number; only students have one.
  student_number VARCHAR(20)  NULL,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  -- Bumped on logout / password change to invalidate every refresh token issued before.
  token_version  INT UNSIGNED NOT NULL DEFAULT 0,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  -- The default collation is case-insensitive, so this also blocks "A@x.com" vs "a@x.com".
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_student_number (student_number),
  KEY idx_users_role (role)
) ENGINE=InnoDB;
