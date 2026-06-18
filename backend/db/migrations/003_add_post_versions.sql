CREATE TABLE IF NOT EXISTS post_versions (
  id bigserial PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  title varchar(220) NOT NULL,
  summary text,
  content_markdown text NOT NULL,
  cover_url text,
  category_name varchar(120),
  tags_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_versions_post_id_created_at ON post_versions(post_id, created_at DESC);
