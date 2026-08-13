import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { apiRouter } from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiRouter);

app.listen(config.port, () => {
  console.log(`[OneLaunch server] http://localhost:${config.port}`);
  if (!config.modelRouter.apiKey) {
    console.warn(
      '[OneLaunch server] Warning: MODEL_ROUTER_API_KEY is not configured. Copy .env.example to .env and fill it in.',
    );
  }
});
