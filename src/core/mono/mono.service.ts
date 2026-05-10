import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class MonoService {
  private readonly logger = new Logger(MonoService.name);
  private readonly client: AxiosInstance;

  constructor(private config: ConfigService) {
    this.client = axios.create({
      baseURL: 'https://api.withmono.com',
      headers: {
        'mono-sec-key': config.get<string>('MONO_SECRET_KEY'),
        'Content-Type': 'application/json',
      },
    });
  }

  // Initiates BVN lookup — if Mono accepts the BVN as valid, the call succeeds silently.
  // Throws BadRequestException (→ 400) if the BVN is not found or invalid.
  async verifyBvn(bvn: string): Promise<void> {
    try {
      await this.client.post('/v2/lookup/bvn/initiate', { bvn });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status && status < 500) {
        throw new BadRequestException('BVN verification failed');
      }
      this.logger.error('Mono BVN verify error', err?.response?.data);
      throw new InternalServerErrorException('BVN verification service unavailable');
    }
  }

  // Exchanges the Mono Connect code returned by the frontend widget for an account ID.
  async exchangeCode(code: string): Promise<string> {
    try {
      const res = await this.client.post('/v2/accounts/auth', { code });
      const id = res.data?.id ?? res.data?.data?.id;
      if (!id) throw new Error('No account id in response');
      return id as string;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      const status = err?.response?.status;
      if (status && status < 500) {
        throw new BadRequestException('Invalid or expired bank connection code');
      }
      this.logger.error('Mono code exchange error', err?.response?.data);
      throw new InternalServerErrorException('Bank connection service unavailable');
    }
  }

  // Returns the average monthly inflow (in kobo) and the history start date for an account.
  async getAccountIncome(accountId: string): Promise<{
    averageMonthlyInflow: number;
    historyStartDate: string;
  }> {
    try {
      const res = await this.client.get(`/v2/accounts/${accountId}/income`);
      const data = res.data?.data ?? res.data;

      // monthlyAmount is already in kobo from Mono; fall back to 0 if unavailable
      const averageMonthlyInflow = Number(data?.monthlyAmount ?? 0);

      // Use today if Mono doesn't return a period start date
      const historyStartDate =
        data?.period_start ?? new Date().toISOString().split('T')[0];

      return { averageMonthlyInflow, historyStartDate };
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof InternalServerErrorException) {
        throw err;
      }
      // Income endpoint may not be available for all account types — return zeros gracefully
      this.logger.warn(`Mono income fetch failed for ${accountId}`, err?.response?.data);
      return {
        averageMonthlyInflow: 0,
        historyStartDate: new Date().toISOString().split('T')[0],
      };
    }
  }

  // Verifies a CAC registration number. Throws BadRequestException if invalid.
  async verifyCac(rcNumber: string): Promise<void> {
    try {
      await this.client.post('/v3/identity/cac', { rc_number: rcNumber });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status && status < 500) {
        throw new BadRequestException('CAC registration number could not be verified');
      }
      this.logger.error('Mono CAC verify error', err?.response?.data);
      throw new InternalServerErrorException('CAC verification service unavailable');
    }
  }
}
