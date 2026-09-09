import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import { pool } from './config/db';

dotenv.config();

const app: Application = express();
const PORT: number = Number(process.env.PORT) || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Health check para monitors de infraestrutura e orquestradores de nuvem
app.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

app.use('/auth', authRoutes);

// Interceptador global para tratamento centralizado de exceções
app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

const server = app.listen(PORT, '0.0.0.0', (): void => {
  console.log(`Server listening on port ${PORT}`);
});

const handleGracefulShutdown = async (signal: string): Promise<void> => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

export default app;