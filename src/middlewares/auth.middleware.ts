import { Request, Response, NextFunction } from 'express';
import jwt, { VerifyErrors, JwtPayload } from 'jsonwebtoken';

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token de autenticação ausente.' });
    return;
  }

  const secret = process.env.JWT_SECRET || 'secret_fallback_key';
  jwt.verify(token, secret, (err: VerifyErrors | null, decoded: string | JwtPayload | undefined): void => {
    if (err || !decoded || typeof decoded === 'string') {
      res.status(403).json({ error: 'Token inválido ou expirado.' });
      return;
    }
    req.user = decoded as AuthenticatedUser;
    next();
  });
};