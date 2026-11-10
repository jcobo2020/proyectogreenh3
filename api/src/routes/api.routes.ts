import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import { getProvinces } from '../controllers/ProvinceController';
import { getTowns } from '../controllers/TownController';
import { getCustomers, postCustomer, getCustomer, putCustomer, removeCustomer } from '../controllers/CustomerController';
import { validateListTowns } from '../validators/townValidator';
import {
  validateIdParam,
  validateIdempotencyKey,
  validateListCustomers,
  validateUpdateCustomer,
} from '../validators/customerValidator';

export const apiRouter = Router();

apiRouter.get('/provinces', authenticate, getProvinces);
apiRouter.get('/towns', authenticate, validateListTowns, getTowns);

apiRouter.get('/customers', authenticate, validateListCustomers, getCustomers);
apiRouter.post('/customers', authenticate, validateIdempotencyKey, postCustomer);
apiRouter.get('/customers/:id', authenticate, validateIdParam, getCustomer);
apiRouter.put('/customers/:id', authenticate, validateUpdateCustomer, putCustomer);
apiRouter.delete('/customers/:id', authenticate, validateIdParam, removeCustomer);
