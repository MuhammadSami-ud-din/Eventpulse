import { Router } from 'express';
import { getCategories } from '../controllers/category.controller.js';
import { publicRevalidate } from '../middleware/cacheControl.js';

export const categoryRouter = Router();

categoryRouter.get('/', publicRevalidate, getCategories);
