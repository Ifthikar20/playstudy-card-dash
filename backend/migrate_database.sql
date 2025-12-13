-- Migration script to add study_content column and create topics/questions tables
-- Run this with: psql -d playstudy_db -f migrate_database.sql

BEGIN;

-- Add study_content column to study_sessions table
ALTER TABLE study_sessions
ADD COLUMN IF NOT EXISTS study_content TEXT;

-- Update existing records to have default values for modified columns
UPDATE study_sessions
SET duration = 0
WHERE duration IS NULL;

UPDATE study_sessions
SET status = 'in_progress'
WHERE status = 'completed';

UPDATE study_sessions
SET has_full_study = false,
    has_speed_run = false,
    has_quiz = false
WHERE has_full_study = true;

-- Create topics table
CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    study_session_id INTEGER NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    score INTEGER,
    current_question_index INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_topics_id ON topics(id);
CREATE INDEX IF NOT EXISTS ix_topics_study_session_id ON topics(study_session_id);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    options JSON NOT NULL,
    correct_answer INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_questions_id ON questions(id);
CREATE INDEX IF NOT EXISTS ix_questions_topic_id ON questions(topic_id);

COMMIT;

-- Display the updated schema
\d study_sessions
\d topics
\d questions
