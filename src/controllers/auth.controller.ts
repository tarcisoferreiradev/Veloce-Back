import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { RegisterDTO } from '../types/user';

const SALT_ROUNDS = 12;

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

  const client = await pool.connect();

  try {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [body.email]);
    if (existing.rowCount && existing.rowCount > 0) {
      res.status(409).json({ error: 'E-mail já cadastrado.' });
      return;
    }

    // Normalização para unidades SI (kg e cm)
    const unitSystem = body.unitSystem || 'metric';
    const weightKg = unitSystem === 'imperial' ? body.weight * 0.453592 : body.weight;
    const heightCm = unitSystem === 'imperial' ? body.height * 2.54 : body.height;

    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    await client.query('BEGIN');

    const userResult = await client.query(
      `INSERT INTO users (name, email, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, email, created_at`,
      [body.name, body.email, passwordHash]
    );

    const userId = userResult.rows[0].id;

    await client.query(
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

    await client.query('COMMIT');

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
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erro de integridade ao processar registro.' });
  } finally {
    client.release();
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