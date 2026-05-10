import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

type SquadApiResponse<T> = { data?: T } & Record<string, unknown>;

function unwrapSquadData<T>(payload: SquadApiResponse<T>): T {
  return (payload.data ?? payload) as T;
}

// Thin wrapper around the Squad payment API — all money movement goes through here
@Injectable()
export class SquadService {
  private readonly logger = new Logger(SquadService.name);
  private readonly client: AxiosInstance;

  constructor(private config: ConfigService) {
    // Pre-configure base URL and auth header so callers don't need to handle them
    this.client = axios.create({
      baseURL: config.get<string>('SQUAD_BASE_URL'),
      headers: {
        Authorization: `Bearer ${config.get<string>('SQUAD_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async createVirtualAccount(
    userId: string,
    fullName: string,
    bvn: string,
    phone: string,
    email: string,
  ): Promise<{ virtualAccountNumber: string; reference: string }> {
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName =
      nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;

    const response = await this.client.post<
      SquadApiResponse<{
        virtual_account_number?: string;
        customer_identifier?: string;
      }>
    >('/virtual-account', {
      first_name: firstName,
      last_name: lastName,
      middle_name: 'N/A',
      mobile_num: phone,
      dob: '01/01/1990',
      email,
      bvn,
      gender: '1',
      address: 'Nigeria',
      customer_identifier: userId,
      beneficiary_account: '0000000000',
    });

    const data = unwrapSquadData(response.data);
    return {
      virtualAccountNumber: data.virtual_account_number ?? '',
      reference: data.customer_identifier ?? userId,
    };
  }

  async getAccountBalance(virtualAccountNumber: string): Promise<number> {
    const response = await this.client.get<
      SquadApiResponse<{
        balance?: number | string;
        available_balance?: number | string;
      }>
    >(`/virtual-account/customer/${virtualAccountNumber}`);
    const data = unwrapSquadData(response.data);
    return Number(data.balance ?? data.available_balance ?? 0);
  }

  async initiateTransfer(
    amount: number,
    bankCode: string,
    accountNumber: string,
    reference: string,
    narration: string,
  ): Promise<{ transactionReference: string; status: string }> {
    const response = await this.client.post<
      SquadApiResponse<{ transaction_reference?: string; status?: string }>
    >('/payout/transfer', {
      transaction_reference: reference,
      amount: String(amount),
      bank_code: bankCode,
      account_number: accountNumber,
      account_name: 'Beneficiary',
      currency_id: 'NGN',
      remark: narration,
    });
    const data = unwrapSquadData(response.data);
    return {
      transactionReference: data.transaction_reference ?? reference,
      status: data.status ?? 'unknown',
    };
  }

  async transferBetweenVirtualAccounts(
    fromAccount: string,
    toAccount: string,
    amount: number,
    reference: string,
  ): Promise<{ transactionReference: string; status: string }> {
    const response = await this.client.post<
      SquadApiResponse<{ transaction_reference?: string; status?: string }>
    >('/virtual-account/transfer', {
      from: fromAccount,
      to: toAccount,
      amount,
      transaction_reference: reference,
    });
    const data = unwrapSquadData(response.data);
    return {
      transactionReference: data.transaction_reference ?? reference,
      status: data.status ?? 'success',
    };
  }

  // Sandbox only — simulates an incoming payment to trigger the webhook flow without a real bank transfer
  async simulatePayment(
    virtualAccountNumber: string,
    amount: number,
  ): Promise<void> {
    await this.client.post('/virtual-account/simulate/payment', {
      virtual_account_number: virtualAccountNumber,
      amount,
    });
  }

  // Validates Squad's HMAC-SHA512 signature; timingSafeEqual prevents timing attacks
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    const secret = this.config.get<string>('SQUAD_SECRET_KEY')!;
    const computed = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(signatureHeader, 'hex'),
    );
  }
}
