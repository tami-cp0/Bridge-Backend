import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString({ message: 'DATABASE_URL must be a string' })
  @IsNotEmpty({ message: 'DATABASE_URL is required and cannot be empty' })
  DATABASE_URL: string;

  @IsString({ message: 'JWT_SECRET must be a string' })
  @IsNotEmpty({ message: 'JWT_SECRET is required and cannot be empty' })
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string;

  @IsString({ message: 'SQUAD_SECRET_KEY must be a string' })
  @IsNotEmpty({ message: 'SQUAD_SECRET_KEY is required and cannot be empty' })
  SQUAD_SECRET_KEY: string;

  @IsString({ message: 'SQUAD_BASE_URL must be a string' })
  @IsNotEmpty({ message: 'SQUAD_BASE_URL is required and cannot be empty' })
  SQUAD_BASE_URL: string;

  @IsString({ message: 'SQUAD_MERCHANT_ID must be a string' })
  @IsNotEmpty({
    message: 'SQUAD_MERCHANT_ID is required and cannot be empty',
  })
  SQUAD_MERCHANT_ID: string;

  @IsString({ message: 'MONO_SECRET_KEY must be a string' })
  @IsNotEmpty({ message: 'MONO_SECRET_KEY is required and cannot be empty' })
  MONO_SECRET_KEY: string;

  @IsString()
  @IsOptional()
  MONO_PUBLIC_KEY: string;

  @IsString()
  @IsOptional()
  MONO_WEBHOOK_SECRET: string;

  @IsString({ message: 'OPENAI_API_KEY must be a string' })
  @IsNotEmpty({ message: 'OPENAI_API_KEY is required and cannot be empty' })
  OPENAI_API_KEY: string;

  @IsString()
  @IsOptional()
  PORT: string;

  @IsString()
  @IsOptional()
  MAX_DEAL_DURATION_MONTHS: string;

  @IsString()
  @IsOptional()
  SWEEP_TOLERANCE_PERCENT: string;

  @IsString()
  @IsOptional()
  FRONTEND_URL: string;
}

export function validateConfig(configuration: Record<string, unknown>) {
  const finalConfig = plainToInstance(EnvironmentVariables, configuration);

  const errors = validateSync(finalConfig);

  if (errors.length) {
    const formatted = errors
      .flatMap((err) => Object.values(err.constraints || {}))
      .join('\n');

    throw new BadRequestException(`Config validation failed:\n${formatted}`);
  }

  return finalConfig;
}
