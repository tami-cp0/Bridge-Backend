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
  private readonly mockIncomePayloads = [
    {
      status: 'successful',
      message: 'Income retrieved successfully',
      data: {
        income_summary: {
          total_income: 240000000,
          annual_income: 2880000000,
          monthly_income: 20000000,
          average_monthly_income: 20000000,
          income_source_type: 'BANK',
          employer: 'Mock Corp Nigeria',
        },
        income_streams: [
          {
            income_type: 'SALARY',
            frequency: 'MONTHLY',
            monthly_average: 20000000,
            average_income_amount: 20000000,
            last_income_amount: 20000000,
            currency: 'NGN',
            stability: 0.72,
            last_income_description: 'MONTHLY SALARY / MOCK CORP',
            last_income_date: '2026-05-01',
            periods_with_income: 12,
            number_of_incomes: 12,
          },
        ],
      },
    },
    {
      status: 'successful',
      message: 'Income retrieved successfully',
      data: {
        income_summary: {
          total_income: 720000000,
          annual_income: 8640000000,
          monthly_income: 60000000,
          average_monthly_income: 60000000,
          income_source_type: 'BANK',
          employer: 'Mock Corp Nigeria',
        },
        income_streams: [
          {
            income_type: 'SALARY',
            frequency: 'MONTHLY',
            monthly_average: 60000000,
            average_income_amount: 60000000,
            last_income_amount: 60000000,
            currency: 'NGN',
            stability: 0.8,
            last_income_description: 'MONTHLY SALARY / MOCK CORP',
            last_income_date: '2026-05-01',
            periods_with_income: 12,
            number_of_incomes: 12,
          },
        ],
      },
    },
    {
      status: 'successful',
      message: 'Income retrieved successfully',
      data: {
        income_summary: {
          total_income: 1200000000,
          annual_income: 14400000000,
          monthly_income: 100000000,
          average_monthly_income: 100000000,
          income_source_type: 'BANK',
          employer: 'Mock Corp Nigeria',
        },
        income_streams: [
          {
            income_type: 'SALARY',
            frequency: 'MONTHLY',
            monthly_average: 100000000,
            average_income_amount: 100000000,
            last_income_amount: 100000000,
            currency: 'NGN',
            stability: 0.88,
            last_income_description: 'MONTHLY SALARY / MOCK CORP',
            last_income_date: '2026-05-01',
            periods_with_income: 12,
            number_of_incomes: 12,
          },
        ],
      },
    },
    {
      status: 'successful',
      message: 'Income retrieved successfully',
      data: {
        income_summary: {
          total_income: 2100000000,
          annual_income: 25200000000,
          monthly_income: 175000000,
          average_monthly_income: 175000000,
          income_source_type: 'BANK',
          employer: 'Mock Corp Nigeria',
        },
        income_streams: [
          {
            income_type: 'SALARY',
            frequency: 'MONTHLY',
            monthly_average: 175000000,
            average_income_amount: 175000000,
            last_income_amount: 175000000,
            currency: 'NGN',
            stability: 0.9,
            last_income_description: 'MONTHLY SALARY / MOCK CORP',
            last_income_date: '2026-05-01',
            periods_with_income: 12,
            number_of_incomes: 12,
          },
        ],
      },
    },
    {
      status: 'successful',
      message: 'Income retrieved successfully',
      data: {
        income_summary: {
          total_income: 3600000000,
          annual_income: 43200000000,
          monthly_income: 300000000,
          average_monthly_income: 300000000,
          income_source_type: 'BANK',
          employer: 'Mock Corp Nigeria',
        },
        income_streams: [
          {
            income_type: 'SALARY',
            frequency: 'MONTHLY',
            monthly_average: 300000000,
            average_income_amount: 300000000,
            last_income_amount: 300000000,
            currency: 'NGN',
            stability: 0.95,
            last_income_description: 'MONTHLY SALARY / MOCK CORP',
            last_income_date: '2026-05-01',
            periods_with_income: 12,
            number_of_incomes: 12,
          },
        ],
      },
    },
  ];

  constructor(@Inject(MonoConfig.KEY) monoCfg: MonoConfigType) {
    this.client = axios.create({
      baseURL: 'https://api.withmono.com',
      headers: {
        'mono-sec-key': monoCfg.secretKey,
        'Content-Type': 'application/json',
      },
    });
  }

  getMockIncomePayload() {
    const index = Math.floor(Math.random() * this.mockIncomePayloads.length);
    return this.mockIncomePayloads[index];
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
