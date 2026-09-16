import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { pool } from '../../../config/db';
import { AuthenticationError } from '../../../domain/errors/AuthErrors';

interface GoogleLoginRequestDTO {
  idToken: string;
}

interface AuthResponseDTO {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  }
}

export class GoogleLoginUseCase {
  private googleClient: OAuth2Client;

  constructor() {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  public async execute({ idToken }: GoogleLoginRequestDTO): Promise<AuthResponseDTO> {
    if (!idToken) {
      throw new AuthenticationError('Google ID Token é obrigatório.', 400);
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      
      if (!payload || !payload.email) {
        throw new AuthenticationError('Token do Google inválido ou sem e-mail associado.', 401);
      }

      const { email, name } = payload;

      const userQuery = await pool.query(
        'SELECT * FROM users WHERE email = $1 LIMIT 1',
        [email]
      );

      let user;

      if (userQuery.rows.length > 0) {
        user = userQuery.rows[0];
      } else {
        const insertQuery = await pool.query(
          `INSERT INTO users (name, email, password_hash, created_at, updated_at) 
           VALUES ($1, $2, NULL, NOW(), NOW()) 
           RETURNING *`,
          [name || 'Usuário Google', email]
        );
        user = insertQuery.rows[0];
      }

      const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';
      const token = jwt.sign(
        { id: user.id, email: user.email },
        jwtSecret,
        { expiresIn: '7d' }
      );

      return {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      };

    } catch (error: any) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError(`Falha na autenticação com o Google: ${error.message}`, 401);
    }
  }
}