import { Router } from 'express';
import { GoogleAuthController } from '../modules/auth/presentation/GoogleAuthController';

const authRouter = Router();
const googleAuthController = new GoogleAuthController();

authRouter.post('/google', (req, res) => googleAuthController.handle(req, res));

export default authRouter;