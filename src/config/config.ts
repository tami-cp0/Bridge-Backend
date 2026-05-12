import { registerAs } from '@nestjs/config';

export const DatabaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));

export const JwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
}));

export const SquadConfig = registerAs('squad', () => ({
  secretKey: process.env.SQUAD_SECRET_KEY,
  baseUrl: process.env.SQUAD_BASE_URL,
  merchantId: process.env.SQUAD_MERCHANT_ID,
}));

export const MonoConfig = registerAs('mono', () => ({
  secretKey: process.env.MONO_SECRET_KEY,
  publicKey: process.env.MONO_PUBLIC_KEY,
  webhookSecret: process.env.MONO_WEBHOOK_SECRET,
}));

export const OpenAiConfig = registerAs('openai', () => ({
  apiKey: process.env.OPENAI_API_KEY,
}));

export const AppConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  maxDealDurationMonths: parseInt(
    process.env.MAX_DEAL_DURATION_MONTHS ?? '24',
    10,
  ),
  sweepTolerancePercent: parseFloat(process.env.SWEEP_TOLERANCE_PERCENT ?? '2'),
  frontendUrl: process.env.FRONTEND_URL,
}));

export const configurations = [
  DatabaseConfig,
  JwtConfig,
  SquadConfig,
  MonoConfig,
  OpenAiConfig,
  AppConfig,
];
