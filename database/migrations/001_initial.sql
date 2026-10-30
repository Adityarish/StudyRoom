BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS administrators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(80) NOT NULL UNIQUE CHECK (username = lower(username)),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  administrator_id uuid NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  csrf_token_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TYPE room_status AS ENUM ('active', 'closed');
CREATE TABLE IF NOT EXISTS study_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_room_id varchar(64) NOT NULL UNIQUE CHECK (length(public_room_id) >= 20),
  livekit_room_name varchar(128) NOT NULL UNIQUE,
  name varchar(100) NOT NULL CHECK (char_length(name) >= 3),
  description varchar(1000) NOT NULL DEFAULT '',
  subject varchar(100) NOT NULL DEFAULT 'General study',
  status room_status NOT NULL DEFAULT 'active',
  max_participants integer NOT NULL CHECK (max_participants BETWEEN 2 AND 100),
  chat_enabled boolean NOT NULL DEFAULT true,
  screen_sharing_enabled boolean NOT NULL DEFAULT true,
  waiting_room_enabled boolean NOT NULL DEFAULT false,
  room_password_hash text,
  expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES administrators(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE TYPE approval_status AS ENUM ('approved', 'pending', 'declined');
CREATE TABLE IF NOT EXISTS guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  guest_identity varchar(128) NOT NULL UNIQUE,
  display_name varchar(48) NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 48),
  avatar_id varchar(24) NOT NULL,
  presentation varchar(16),
  session_token_hash char(64) NOT NULL,
  waiting_token_hash char(64),
  approval_status approval_status NOT NULL DEFAULT 'approved',
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  CONSTRAINT valid_presentation CHECK (presentation IS NULL OR presentation IN ('neutral','feminine','masculine'))
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  sender_identity varchar(128) NOT NULL,
  sender_display_name varchar(48) NOT NULL,
  message varchar(1000) NOT NULL CHECK (char_length(trim(message)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_status_expiry ON study_rooms(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_room_active ON guest_sessions(room_id, left_at, approval_status);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_last_seen ON guest_sessions(last_seen_at) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expires_at) WHERE revoked_at IS NULL;

COMMIT;
