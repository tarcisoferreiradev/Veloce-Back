import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

export const initDb = async (): Promise<void> => {
  const ddl = `
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    DO $$ BEGIN
      CREATE TYPE biological_sex_enum AS ENUM ('male', 'female', 'other');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE unit_system_enum AS ENUM ('metric', 'imperial');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE fitness_level_enum AS ENUM ('sedentary', 'beginner', 'intermediate', 'advanced');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      weight_kg NUMERIC(5, 2) NOT NULL,
      height_cm NUMERIC(5, 2) NOT NULL,
      birth_date DATE NOT NULL,
      biological_sex biological_sex_enum NOT NULL,
      fitness_level fitness_level_enum DEFAULT 'beginner',
      primary_goal VARCHAR(100) DEFAULT 'general_fitness',
      unit_system unit_system_enum DEFAULT 'metric',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `;
  await pool.query(ddl);
};