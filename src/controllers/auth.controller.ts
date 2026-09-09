import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { pool } from '../config/db';
import { RegisterDTO } from '../types/user';

const SALT_ROUNDS = 12;
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

interface GoogleAuthRequestBody {
  idToken: string;
}

export const register = async (req: Request, res: Response): Promise<void> => {
  const body: RegisterDTO = req.body;
  if (
    !body.name ||
    !body.email ||
    !body.password ||
    !body.weight ||
    !body.height ||
    !body.birthDate ||
    !body.biologicalSex
  ) {
    res.status(400).json({ error: 'Campos obrigatórios de conta e telemetria biométrica ausentes.' });
    return;
  }

  const clientDb = await pool.connect();
  try {
    const existing = await clientDb.query('SELECT id FROM users WHERE email = $1', [body.email]);
    if (existing.rowCount && existing.rowCount > 0) {
      res.status(409).json({ error: 'E-mail já cadastrado.' });
      return;
    }

    const unitSystem = body.unitSystem || 'metric';
    const weightKg = unitSystem === 'imperial' ? body.weight * 0.453592 : body.weight;
    const heightCm = unitSystem === 'imperial' ? body.height * 2.54 : body.height;
    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    await clientDb.query('BEGIN');
    const userResult = await clientDb.query(
      `INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, created_at`,
      [body.name, body.email, passwordHash]
    );

    const userId = userResult.rows[0].id;
    await clientDb.query(
      `INSERT INTO user_profiles
        (user_id, weight_kg, height_cm, birth_date, biological_sex, fitness_level, primary_goal, unit_system)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        weightKg.toFixed(2),
        heightCm.toFixed(2),
        body.birthDate,
        body.biologicalSex,
        body.fitnessLevel || 'beginner',
        body.primaryGoal || 'general_fitness',
        unitSystem,
      ]
    );

    await clientDb.query('COMMIT');

    const secret = process.env.JWT_SECRET || 'secret_fallback_key';
    const token = jwt.sign({ userId, email: body.email }, secret, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: userResult.rows[0],
      profile: {
        weightKg: Number(weightKg.toFixed(2)),
        heightCm: Number(heightCm.toFixed(2)),
        birthDate: body.birthDate,
        biologicalSex: body.biologicalSex,
        unitSystem,
      },
    });
  } catch (error) {
    await clientDb.query('ROLLBACK');
    res.status(500).json({ error: 'Erro de integridade ao processar registro.' });
  } finally {
    clientDb.release();
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.password_hash, p.weight_kg, p.height_cm, p.birth_date, p.biological_sex, p.unit_system
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rowCount === 0) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    const user = result.rows[0];
    if (!user.password_hash) {
      res.status(401).json({ error: 'Esta conta utiliza autenticação social (Google). Faça login por lá.' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Credenciais inválidas.' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'secret_fallback_key';
    const token = jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: '7d' });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: {
          weightKg: Number(user.weight_kg),
          heightCm: Number(user.height_cm),
          birthDate: user.birth_date,
          biologicalSex: user.biological_sex,
          unitSystem: user.unit_system,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno ao realizar autenticação.' });
  }
};

export const googleAuth = async (
  req: Request<Record<string, never>, unknown, GoogleAuthRequestBody>,
  res: Response
): Promise<void> => {
  const { idToken } = req.body;

  if (!idToken) {
    res.status(400).json({ error: 'ID Token do Google é obrigatório.' });
    return;
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload: TokenPayload | undefined = ticket.getPayload();

    if (!payload || !payload.email) {
      res.status(401).json({ error: 'Token Google inválido ou sem e-mail associado.' });
      return;
    }

    const { email, name, sub: googleId } = payload;

    const query = `
      INSERT INTO users (email, name, google_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) 
      DO UPDATE SET google_id = COALESCE(users.google_id, EXCLUDED.google_id)
      RETURNING id, email, name;
    `;

    const result = await pool.query(query, [email, name || 'Google User', googleId]);
    const user = result.rows[0];

    const profileResult = await pool.query(
      `SELECT weight_kg, height_cm, birth_date, biological_sex, unit_system FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const profile = profileResult.rows[0] || null;

    const secret = process.env.JWT_SECRET || 'secret_fallback_key';
    const token = jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: '7d' });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: profile ? {
          weightKg: Number(profile.weight_kg),
          heightCm: Number(profile.height_cm),
          birthDate: profile.birth_date,
          biologicalSex: profile.biological_sex,
          unitSystem: profile.unit_system,
        } : null,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Erro na validação do Google Auth:', err.message);
    res.status(401).json({ error: 'Falha ao autenticar com Google.' });
  }
};