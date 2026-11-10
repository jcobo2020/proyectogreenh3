import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import { getProvinces } from '../controllers/ProvinceController';

export const apiRouter = Router();

apiRouter.get('/provinces', authenticate, getProvinces);
