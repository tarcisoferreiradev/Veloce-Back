// src/presentation/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import { executeLogin } from '../../application/use-cases/Auth/LoginUseCase';
import { AuthenticationError } from '../../domain/errors/AuthErrors';

/**
 * @description Adaptador de entrada para o ecossistema Express.
 * Delega o processamento ao Use Case e encaminha exceções ao interceptador global.
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const responseData = await executeLogin(req.body);
    res.status(200).json(responseData);
  } catch (error: unknown) {
    if (error instanceof AuthenticationError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    // Delega falhas críticas não mapeadas (ex: falha no pool do Supabase) ao Interceptor
    next(error); 
  }
};