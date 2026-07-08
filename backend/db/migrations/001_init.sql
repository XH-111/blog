CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id bigserial PRIMARY KEY,
  username varchar(80) NOT NULL UNIQUE,
  email varchar(160) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  avatar_url text,
  role varchar(40) NOT NULL DEFAULT 'admin',
  status varchar(30) NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id bigserial PRIMARY KEY,
  admin_user_id bigint NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id bigserial PRIMARY KEY,
  name varchar(80) NOT NULL UNIQUE,
  slug varchar(100) NOT NULL UNIQUE,
  description text,
  icon text,
  cover text,
  background text,
  theme_color varchar(40),
  sort_order integer NOT NULL DEFAULT 0,
  posts_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id bigserial PRIMARY KEY,
  name varchar(80) NOT NULL UNIQUE,
  slug varchar(100) NOT NULL UNIQUE,
  color varchar(40),
  posts_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id bigserial PRIMARY KEY,
  file_name varchar(255) NOT NULL,
  original_name varchar(255),
  mime_type varchar(120),
  file_size bigint,
  url text NOT NULL,
  thumbnail_url text,
  display_url text,
  storage_path text,
  width integer,
  height integer,
  alt_text text,
  uploaded_by bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id bigserial PRIMARY KEY,
  title varchar(220) NOT NULL,
  slug varchar(260) NOT NULL UNIQUE,
  excerpt text,
  summary text,
  content_markdown text NOT NULL,
  content_html text,
  cover_media_id bigint REFERENCES media_assets(id) ON DELETE SET NULL,
  cover_url text,
  category_id bigint REFERENCES categories(id) ON DELETE SET NULL,
  status varchar(30) NOT NULL DEFAULT 'draft',
  visibility varchar(30) NOT NULL DEFAULT 'public',
  access_password_hash text,
  password_hint text,
  is_featured boolean NOT NULL DEFAULT false,
  featured_order integer NOT NULL DEFAULT 0,
  allow_comment boolean NOT NULL DEFAULT true,
  require_comment_review boolean NOT NULL DEFAULT true,
  reading_minutes integer NOT NULL DEFAULT 1,
  views_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  source varchar(40) NOT NULL DEFAULT 'manual',
  published_at timestamptz,
  scheduled_at timestamptz,
  created_by bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_by bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_status_published_at ON posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category_id ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_is_featured ON posts(is_featured);
CREATE INDEX IF NOT EXISTS idx_posts_featured_order ON posts(is_featured, featured_order);

CREATE TABLE IF NOT EXISTS post_tags (
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id bigint NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS post_sections (
  id bigserial PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  title varchar(220) NOT NULL,
  anchor varchar(160) NOT NULL,
  level integer NOT NULL CHECK (level IN (2, 3)),
  body text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS comments (
  id bigserial PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id bigint REFERENCES comments(id) ON DELETE CASCADE,
  author_name varchar(80) NOT NULL,
  author_email varchar(160),
  author_site text,
  author_avatar text,
  content text NOT NULL,
  likes_count integer NOT NULL DEFAULT 0,
  status varchar(30) NOT NULL DEFAULT 'pending',
  is_visible boolean NOT NULL DEFAULT true,
  source varchar(40) NOT NULL DEFAULT 'user',
  ip_address varchar(80),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id bigserial PRIMARY KEY,
  parent_id bigint REFERENCES messages(id) ON DELETE CASCADE,
  author_name varchar(80) NOT NULL,
  author_email varchar(160),
  author_site text,
  author_avatar text,
  role varchar(30) NOT NULL DEFAULT 'visitor',
  content text NOT NULL,
  likes_count integer NOT NULL DEFAULT 0,
  status varchar(30) NOT NULL DEFAULT 'pending',
  ip_address varchar(80),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
  id bigserial PRIMARY KEY,
  key varchar(120) NOT NULL UNIQUE,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id bigserial PRIMARY KEY,
  title varchar(160) NOT NULL,
  description text,
  cover_media_id bigint REFERENCES media_assets(id) ON DELETE SET NULL,
  cover_url text,
  project_url text,
  repo_url text,
  stars_count integer NOT NULL DEFAULT 0,
  forks_count integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_daily_stats (
  id bigserial PRIMARY KEY,
  post_id bigint NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  stat_date date NOT NULL,
  views_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  UNIQUE (post_id, stat_date)
);

CREATE TABLE IF NOT EXISTS site_daily_stats (
  id bigserial PRIMARY KEY,
  stat_date date NOT NULL UNIQUE,
  pv integer NOT NULL DEFAULT 0,
  uv integer NOT NULL DEFAULT 0,
  posts_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  messages_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_daily_visitors (
  id bigserial PRIMARY KEY,
  stat_date date NOT NULL,
  visitor_id varchar(120) NOT NULL,
  ip_address varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stat_date, visitor_id)
);

CREATE TABLE IF NOT EXISTS likes (
  id bigserial PRIMARY KEY,
  target_type varchar(30) NOT NULL,
  target_id bigint NOT NULL,
  visitor_id varchar(120),
  ip_address varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_type, target_id, visitor_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id bigserial PRIMARY KEY,
  email varchar(160) NOT NULL UNIQUE,
  status varchar(30) NOT NULL DEFAULT 'active',
  token varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_tasks (
  id bigserial PRIMARY KEY,
  task_type varchar(40) NOT NULL,
  source_type varchar(40),
  source_id bigint,
  input_text text,
  result_json jsonb,
  status varchar(30) NOT NULL DEFAULT 'pending',
  created_by bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
