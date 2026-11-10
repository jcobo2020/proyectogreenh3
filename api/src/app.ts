import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { apiRouter } from './routes/api.routes';
import { swaggerSpec } from './config/swagger';
import { notFound, errorHandler } from './middlewares/errorHandler.middleware';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/api', apiRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
