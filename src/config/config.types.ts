import { ConfigType } from '@nestjs/config';
import {
  AppConfig,
  DatabaseConfig,
  JwtConfig,
  MonoConfig,
  OpenAiConfig,
  SquadConfig,
} from './config';

export type DatabaseConfigType = ConfigType<typeof DatabaseConfig>;
export type JwtConfigType = ConfigType<typeof JwtConfig>;
export type SquadConfigType = ConfigType<typeof SquadConfig>;
export type MonoConfigType = ConfigType<typeof MonoConfig>;
export type OpenAiConfigType = ConfigType<typeof OpenAiConfig>;
export type AppConfigType = ConfigType<typeof AppConfig>;
