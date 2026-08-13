import 'dotenv/config';

/** Global configuration: API Key is only read from environment variables; hardcoding is forbidden */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  modelRouter: {
    baseUrl:
      process.env.MODEL_ROUTER_BASE_URL ??
      'https://model-router.edu-aliyun.com/v1',
    apiKey: process.env.MODEL_ROUTER_API_KEY ?? '',
  },
} as const;

export function requireApiKey(): string {
  if (!config.modelRouter.apiKey) {
    throw new Error(
      'MODEL_ROUTER_API_KEY is missing: please copy apps/server/.env.example to .env and fill in the API Key',
    );
  }
  return config.modelRouter.apiKey;
}
