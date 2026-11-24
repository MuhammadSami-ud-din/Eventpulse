import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter, loginLimiter, passwordChangeLimiter, registerLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from '../schemas/auth.schemas.js';

export const authRouter = Router();

authRouter.use(authLimiter);

authRouter.get('/csrf', authController.getCsrfToken);
authRouter.post('/register', registerLimiter, validate({ body: registerSchema }), authController.register);
authRouter.post('/login', validate({ body: loginSchema }), loginLimiter, authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', authenticate, authController.me);
authRouter.patch('/me', authenticate, validate({ body: updateProfileSchema }), authController.updateProfile);
authRouter.post(
  '/password',
  authenticate,
  passwordChangeLimiter,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);
