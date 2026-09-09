import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isProduction: boolean = process.env.NODE_ENV === 'production';
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction || Boolean(process.env.DATABASE_URL?.includes('supabase.co'))
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

export const pool: Pool = new Pool(poolConfig);

pool.on('error', (err: Error): void => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});