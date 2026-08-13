import { Router } from 'express';
import { modelRouter } from '../services/modelRouter.js';

export const tasksRouter = Router();

/** GET /api/tasks/:taskId — query async task status and results (video / older-version image models) */
tasksRouter.get('/:taskId', async (req, res) => {
  try {
    const result = await modelRouter.getTask(req.params.taskId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
