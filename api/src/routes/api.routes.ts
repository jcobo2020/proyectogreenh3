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

import {
  getOrders,
  postOrder,
  getOrder,
  postConfirmOrder,
  postShipOrder,
  postDeliverOrder,
  postCancelOrder,
} from '../controllers/OrderController';
import { requirePermission } from '../middlewares/requirePermission.middleware';
import { validateListOrders, validateShipOrder, validateCancelOrder } from '../validators/orderValidator';

export const apiRouter = Router();

const canView = requirePermission('pedidos.consultar');
const canManage = requirePermission('pedidos.gestionar');

apiRouter.get('/provinces', authenticate, getProvinces);
apiRouter.get('/towns', authenticate, validateListTowns, getTowns);

apiRouter.get('/customers', authenticate, validateListCustomers, getCustomers);
apiRouter.post('/customers', authenticate, validateIdempotencyKey, postCustomer);
apiRouter.get('/customers/:id', authenticate, validateIdParam, getCustomer);
apiRouter.put('/customers/:id', authenticate, validateUpdateCustomer, putCustomer);
apiRouter.delete('/customers/:id', authenticate, validateIdParam, removeCustomer);

apiRouter.get('/orders', authenticate, canView, validateListOrders, getOrders);
apiRouter.post('/orders', authenticate, canManage, validateIdempotencyKey, postOrder);
apiRouter.get('/orders/:id', authenticate, canView, validateIdParam, getOrder);
apiRouter.post('/orders/:id/confirm', authenticate, canManage, validateIdParam, postConfirmOrder);
apiRouter.post('/orders/:id/ship', authenticate, canManage, validateIdParam, validateShipOrder, postShipOrder);
apiRouter.post('/orders/:id/deliver', authenticate, canManage, validateIdParam, postDeliverOrder);
apiRouter.post('/orders/:id/cancel', authenticate, canManage, validateIdParam, validateCancelOrder, postCancelOrder);
