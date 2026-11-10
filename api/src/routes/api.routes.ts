import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import { getProvinces } from '../controllers/ProvinceController';
import { getTowns } from '../controllers/TownController';
import { validateListTowns } from '../validators/townValidator';

export const apiRouter = Router();

apiRouter.get('/provinces', authenticate, getProvinces);
apiRouter.get('/towns', authenticate, validateListTowns, getTowns);
