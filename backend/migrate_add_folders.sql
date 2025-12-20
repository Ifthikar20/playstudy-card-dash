-- Migration script to add folders table and folder_id to study_sessions
-- Run this with: psql -d your_database_name -f migrate_add_folders.sql
-- Or for Docker: docker exec -i your_postgres_container psql -U your_user -d your_db < migrate_add_folders.sql

BEGIN;

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    color VARCHAR DEFAULT '#3B82F6',
    icon VARCHAR DEFAULT '📁',
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_folders_id ON folders(id);
CREATE INDEX IF NOT EXISTS ix_folders_user_id ON folders(user_id);

-- Add folder_id column to study_sessions table
ALTER TABLE study_sessions
ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_study_sessions_folder_id ON study_sessions(folder_id);

COMMIT;

-- Display the updated schema
\d folders
\d study_sessions
