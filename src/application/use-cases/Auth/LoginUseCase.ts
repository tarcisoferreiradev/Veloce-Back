// src/application/use-cases/Auth/LoginUseCase.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../../../config/db';
import { AuthenticationError } from '../../../domain/errors/AuthErrors';
import { LoginDTO } from '../../../types/auth'; // Requer interface com email e password

/**
 * @description Orquestração da regra de negócio para autenticação.
 * Implementa Inversão de Controle implícita via driver PG (Supabase) e 
 * isola a lógica de validação criptográfica da camada de transporte HTTP.
 */
export const executeLogin = async (credentials: LoginDTO) => {
  // Early return de validação de payload
  if (!credentials.email || !credentials.password) {
    throw new AuthenticationError('E-mail e senha são obrigatórios.', 400);
  }

  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.password_hash, p.weight_kg, p.height_cm, p.birth_date, p.biological_sex, p.unit_system
     FROM users u
     LEFT JOIN user_profiles p ON u.id = p.user_id
     WHERE u.email = $1`,
    [credentials.email]
  );

  // Early return contra ataques de enumeração / payload inexistente
  if (result.rowCount === 0) {
    throw new AuthenticationError('Credenciais inválidas.');
  }

  const user = result.rows[0];

  // Early return bloqueando senhas nulas derivadas de logins OAuth2 (SSO)
  if (!user.password_hash) {
    throw new AuthenticationError('Esta conta utiliza autenticação social. Efetue login pelo provedor original.');
  }

  const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);
  
  if (!isPasswordValid) {
    throw new AuthenticationError('Credenciais inválidas.');
  }

  const secret = process.env.JWT_SECRET || 'secret_fallback_key';
  const token = jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn: '7d' });

  return {
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
  };
};