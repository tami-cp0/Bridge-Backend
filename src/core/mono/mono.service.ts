import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { MonoConfig } from '../../config/config';
import type { MonoConfigType } from '../../config/config.types';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class MonoService {
  private readonly logger = new Logger(MonoService.name);
  private readonly client: AxiosInstance;

  constructor(@Inject(MonoConfig.KEY) monoCfg: MonoConfigType) {
    this.client = axios.create({
      baseURL: 'https://api.withmono.com',
      headers: {
        'mono-sec-key': monoCfg.secretKey,
        'Content-Type': 'application/json',
      },
    });
  }

  // Exchanges the Mono Connect code returned by the frontend widget for an account ID.
  async exchangeCode(code: string): Promise<string> {
    try {
      const res = await this.client.post<{
        id?: string;
        data?: { id?: string };
      }>('/v2/accounts/auth', { code });
      const id = res.data?.id ?? res.data?.data?.id;
      if (!id) {
        throw new InternalServerErrorException(
          'Bank connection service unavailable',
        );
      }
      return id;
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        if (err.getStatus() >= 500) {
          this.logger.error('Mono code exchange error', err);
        }
        throw err;
      }
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status && status < 500) {
        throw new BadRequestException(
          'Invalid or expired bank connection code',
        );
      }
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      this.logger.error('Mono code exchange error', data);
      throw new InternalServerErrorException(
        'Bank connection service unavailable',
      );
    }
  }

  // Triggers Mono's async income analysis for the linked account.
  // The result is delivered via the mono.events.account_income webhook —
  // this call always returns data: null immediately.
  async triggerIncomeProcessing(accountId: string): Promise<void> {
    try {
      await this.client.get(`/v2/accounts/${accountId}/income`);
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status && status < 500) {
        throw new BadRequestException('Unable to trigger Mono income analysis');
      }
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      this.logger.error(
        `Income processing trigger failed for account ${accountId}`,
        data,
      );
      throw new InternalServerErrorException(
        'Income analysis service unavailable',
      );
    }
  }

  // Verifies a CAC registration number. Throws BadRequestException if not found.
  async verifyCac(rcNumber: string): Promise<void> {
    try {
      const res = await this.client.get<{
        data?: unknown[];
      }>('/v3/lookup/cac', { params: { search: rcNumber, exact: true } });

      if (!res.data?.data?.length) {
        throw new BadRequestException(
          'CAC registration number could not be verified',
        );
      }
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        if (err.getStatus() >= 500) {
          this.logger.error('Mono CAC verify error', err);
        }
        throw err;
      }
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status && status < 500) {
        throw new BadRequestException(
          'CAC registration number could not be verified',
        );
      }
      const data = axios.isAxiosError(err) ? err.response?.data : undefined;
      this.logger.error('Mono CAC verify error', data);
      throw new InternalServerErrorException(
        'CAC verification service unavailable',
      );
    }
  }
}
