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
    profile: any;
  };
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

    let ticket;
    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch {
      throw new AuthenticationError('Token do Google inválido ou expirado.', 401);
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new AuthenticationError('Falha na autenticação do Google: e-mail ausente.', 401);
    }

    const { email, name, sub: googleId } = payload;

    const query = `
      INSERT INTO users (email, name, google_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) 
      DO UPDATE SET google_id = COALESCE(users.google_id, EXCLUDED.google_id)
      RETURNING id, email, name;
    `;

    const result = await pool.query(query, [email, name || 'Usuário Google', googleId]);
    const user = result.rows[0];

    const profileResult = await pool.query(
      `SELECT weight_kg, height_cm, birth_date, biological_sex, unit_system FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const profile = profileResult.rows[0] || null;

    const secret = process.env.JWT_SECRET || 'secret_fallback_key';
    const token = jwt.sign({ userId: user.id, email: user.email }, secret, {
      expiresIn: '7d',
    });

    return {
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
    };
  }
}