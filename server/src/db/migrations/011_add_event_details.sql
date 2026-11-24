-- Optional details for richer event pages. Lists (agenda, speakers, tags) are
-- JSON arrays: they are always read and replaced as a whole with their event,
-- and the API validates their shape. MySQL rejects JSON that is not valid.
ALTER TABLE events
  ADD COLUMN tagline       VARCHAR(160) NULL AFTER title,
  ADD COLUMN agenda        JSON         NULL,
  ADD COLUMN speakers      JSON         NULL,
  ADD COLUMN tags          JSON         NULL,
  ADD COLUMN what_to_bring VARCHAR(500) NULL,
  ADD COLUMN entry_notes   VARCHAR(500) NULL,
  ADD COLUMN contact       VARCHAR(255) NULL;
