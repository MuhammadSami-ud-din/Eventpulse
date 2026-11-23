import { Router } from 'express';
import { getCategories } from '../controllers/category.controller.js';
import { publicMaxAge } from '../middleware/cacheControl.js';

export const categoryRouter = Router();

categoryRouter.get('/', publicMaxAge(300), getCategories);
