import { Router } from 'express';
import * as imageController from '../controllers/image.controller.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParamSchema } from '../schemas/common.schemas.js';

// Public routes; a signed-in viewer may see more (see image.service.js).
export const imageRouter = Router();

imageRouter.get('/avatars/:id', optionalAuthenticate, validate({ params: idParamSchema }), imageController.getAvatar);
imageRouter.get('/covers/:id', optionalAuthenticate, validate({ params: idParamSchema }), imageController.getCover);
