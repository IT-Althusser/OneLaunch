import { Router } from 'express';
import { imagesRouter } from './images.js';
import { tasksRouter } from './tasks.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'onelaunch-server' });
});

apiRouter.use('/images', imagesRouter);
apiRouter.use('/tasks', tasksRouter);
