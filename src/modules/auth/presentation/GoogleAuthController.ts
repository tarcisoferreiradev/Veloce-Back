import { Request, Response } from 'express';
import { GoogleLoginUseCase } from '../useCases/GoogleLoginUseCase';

export class GoogleAuthController {
  public async handle(req: Request, res: Response): Promise<Response> {
    const { idToken } = req.body;

    const googleLoginUseCase = new GoogleLoginUseCase();
    const result = await googleLoginUseCase.execute({ idToken });

    return res.status(200).json(result);
  }
}