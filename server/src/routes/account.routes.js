import { Router } from 'express';
import * as accountController from '../controllers/account.controller.js';
import { authenticate } from '../middleware/auth.js';
import { imageBody } from '../middleware/imageBody.js';
import { imageUploadLimiter } from '../middleware/rateLimiters.js';

// The signed-in user's own account, whatever their role. There is no user id
// in these URLs: only your own avatar can ever be changed here.
export const accountRouter = Router();

accountRouter.use(authenticate);

accountRouter.get('/summary', accountController.getSummary);
accountRouter.put('/avatar', imageUploadLimiter, imageBody, accountController.uploadAvatar);
accountRouter.delete('/avatar', accountController.removeAvatar);
