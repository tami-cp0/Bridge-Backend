import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SquadConfig } from '../../config/config';
import type { SquadConfigType } from '../../config/config.types';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

type SquadApiResponse<T> = { data?: T } & Record<string, unknown>;

function unwrapSquadData<T>(payload: SquadApiResponse<T>): T {
  return (payload.data ?? payload) as T;
}

// Squad customer-transaction entry. Credits land here whenever someone pays into
// the user's virtual account.
export interface SquadCustomerTransaction {
  transactionReference: string;
  virtualAccountNumber: string;
  principalAmount: number; // kobo
  settledAmount: number; // kobo
  feeCharged: number; // kobo
  transactionDate: string;
  // 'C' for credit (incoming), 'D' for debit (rare on VAs since we don't auto-sweep)
  transactionIndicator: string;
  remarks?: string;
  currency?: string;
  frozen?: boolean;
}

// Thin wrapper around the Squad payment API. VAs are entry points only —
// every deposit lands in the merchant wallet, so this module never moves money
// "between" accounts. Internal allocation lives in LedgerService.
@Injectable()
export class SquadService {
  private readonly logger = new Logger(SquadService.name);
  private readonly client: AxiosInstance;

  constructor(@Inject(SquadConfig.KEY) private squadCfg: SquadConfigType) {
    this.client = axios.create({
      baseURL: squadCfg.baseUrl,
      headers: {
        Authorization: `Bearer ${squadCfg.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Investor VA. We deliberately omit beneficiary_account: that field triggers
  // Squad's instant settlement to a GTBank account, which would empty our escrow
  // on every deposit. We want funds to land and stay in the merchant wallet.
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

    try {
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
      });

      const data = unwrapSquadData(response.data);
      return {
        virtualAccountNumber: data.virtual_account_number ?? '',
        reference: data.customer_identifier ?? userId,
      };
    } catch (err: unknown) {
      this.throwSquadError(err, 'Unable to create virtual account');
    }
  }

  async createBusinessVirtualAccount(
    businessId: string,
    businessName: string,
    bvn: string,
    phone: string,
  ): Promise<{ virtualAccountNumber: string; reference: string }> {
    try {
      const response = await this.client.post<
        SquadApiResponse<{
          virtual_account_number?: string;
          customer_identifier?: string;
        }>
      >('/virtual-account/business', {
        business_name: businessName,
        mobile_num: phone,
        bvn,
        customer_identifier: businessId,
      });

      const data = unwrapSquadData(response.data);
      return {
        virtualAccountNumber: data.virtual_account_number ?? '',
        reference: data.customer_identifier ?? businessId,
      };
    } catch (err: unknown) {
      this.throwSquadError(err, 'Unable to create business virtual account');
    }
  }

  // Returns every credit/debit Squad has recorded against this customer's VA.
  // Used to reconcile deposits against the internal ledger.
  async getCustomerTransactions(
    customerIdentifier: string,
  ): Promise<SquadCustomerTransaction[]> {
    try {
      const response = await this.client.get<
        SquadApiResponse<
          Array<{
            transaction_reference?: string;
            virtual_account_number?: string;
            principal_amount?: string | number;
            settled_amount?: string | number;
            fee_charged?: string | number;
            transaction_date?: string;
            transaction_indicator?: string;
            remarks?: string;
            currency?: string;
            frozen_transaction?: unknown;
          }>
        >
      >(`/virtual-account/customer/transactions/${customerIdentifier}`);

      const rows = unwrapSquadData(response.data) ?? [];
      return rows.map((r) => ({
        transactionReference: r.transaction_reference ?? '',
        virtualAccountNumber: r.virtual_account_number ?? '',
        // Squad returns Naira strings like "30000.00"; convert to kobo
        principalAmount: Math.round(Number(r.principal_amount ?? 0) * 100),
        settledAmount: Math.round(Number(r.settled_amount ?? 0) * 100),
        feeCharged: Math.round(Number(r.fee_charged ?? 0) * 100),
        transactionDate: r.transaction_date ?? '',
        transactionIndicator: r.transaction_indicator ?? 'C',
        remarks: r.remarks,
        currency: r.currency,
        frozen: r.frozen_transaction != null,
      }));
    } catch (err: unknown) {
      this.throwSquadError(err, 'Unable to load customer transactions');
    }
  }

  // Total of the merchant wallet (the actual escrow). Returned in kobo.
  async getMerchantBalance(): Promise<number> {
    try {
      const response = await this.client.get<
        SquadApiResponse<{ balance?: number | string }>
      >('/merchant/balance', { params: { currency_id: 'NGN' } });
      const data = unwrapSquadData(response.data);
      return Number(data.balance ?? 0);
    } catch (err: unknown) {
      this.throwSquadError(err, 'Unable to load merchant balance');
    }
  }

  async initiateTransfer(
    amount: number,
    bankCode: string,
    accountNumber: string,
    accountName: string,
    reference: string,
    narration: string,
  ): Promise<{
    transactionReference: string;
    responseDescription: string;
    status: string;
  }> {
    try {
      const response = await this.client.post<
        SquadApiResponse<{
          transaction_reference?: string;
          response_description?: string;
        }>
      >('/payout/transfer', {
        transaction_reference: reference,
        amount: String(amount),
        bank_code: bankCode,
        account_number: accountNumber,
        account_name: accountName,
        currency_id: 'NGN',
        remark: narration,
      });
      const data = unwrapSquadData(response.data);
      const responseDescription = String(data.response_description ?? '');
      return {
        transactionReference: data.transaction_reference ?? reference,
        responseDescription,
        status: this.normalizeTransferStatus(responseDescription),
      };
    } catch (err: unknown) {
      this.throwSquadError(err, 'Unable to initiate payout');
    }
  }

  async lookupAccount(
    bankCode: string,
    accountNumber: string,
  ): Promise<{ accountName: string }> {
    try {
      const response = await this.client.post<
        SquadApiResponse<{ account_name?: string }>
      >('/payout/account/lookup', {
        bank_code: bankCode,
        account_number: accountNumber,
      });

      const data = unwrapSquadData(response.data);
      return { accountName: String(data.account_name ?? '') };
    } catch (err: unknown) {
      this.throwSquadError(err, 'Unable to lookup bank account');
    }
  }

  async requeryTransfer(reference: string): Promise<{
    transactionReference: string;
    responseDescription: string;
    status: string;
    raw: Record<string, unknown>;
  }> {
    try {
      const response = await this.client.post<
        SquadApiResponse<Record<string, unknown>>
      >('/payout/requery', {
        transaction_reference: reference,
      });

      const data = unwrapSquadData(response.data) ?? {};
      const rawDesc = data.response_description;
      const responseDescription = typeof rawDesc === 'string' ? rawDesc : '';
      const refValue =
        (data.transaction_reference as string | undefined) ?? reference;

      return {
        transactionReference: refValue,
        responseDescription,
        status: this.normalizeTransferStatus(responseDescription),
        raw: data,
      };
    } catch (err: unknown) {
      this.throwSquadError(err, 'Unable to requery payout');
    }
  }

  // Sandbox only — simulates an incoming payment to a VA. In production this
  // happens when someone actually pays the VA from their bank app.
  async simulatePayment(
    virtualAccountNumber: string,
    amount: number,
  ): Promise<void> {
    try {
      await this.client.post('/virtual-account/simulate/payment', {
        virtual_account_number: virtualAccountNumber,
        amount: String(amount),
      });
    } catch (err: unknown) {
      this.throwSquadError(err, 'Unable to simulate payment');
    }
  }

  // Squad's HMAC-SHA512 signature; timingSafeEqual prevents timing attacks
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    const secret = this.squadCfg.secretKey!;
    const computed = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(computed, 'hex'),
      Buffer.from(signatureHeader, 'hex'),
    );
  }

  // Squad reports payout state in response_description. Normalize to a small
  // set of statuses our domain understands.
  private normalizeTransferStatus(responseDescription: string): string {
    const v = responseDescription.toLowerCase();
    if (
      v.includes('approved') ||
      v.includes('success') ||
      v.includes('completed')
    ) {
      return 'success';
    }
    if (v.includes('reverse')) return 'reversed';
    if (v.includes('fail') || v.includes('declin') || v.includes('error')) {
      return 'failed';
    }
    if (v.includes('pending') || v.includes('processing') || v === '') {
      return 'pending';
    }
    return v;
  }

  private throwSquadError(err: unknown, fallbackMessage: string): never {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    const data = axios.isAxiosError(err) ? err.response?.data : undefined;
    const extracted = this.extractSquadMessage(data);
    const message = extracted ?? fallbackMessage;

    if (status === 401) {
      throw new UnauthorizedException('Payment provider unauthorized');
    }
    if (status === 403) {
      throw new ForbiddenException('Payment provider forbidden');
    }
    if (status === 404) {
      throw new NotFoundException('Payment provider resource not found');
    }
    if (status && status < 500) {
      throw new BadRequestException(message);
    }

    this.logger.error('Squad API error', {
      status: status ?? 'unknown',
      message,
    });
    throw new InternalServerErrorException('Payment service unavailable');
  }

  private extractSquadMessage(data: unknown): string | undefined {
    if (typeof data === 'string') {
      return data;
    }
    if (!data || typeof data !== 'object') {
      return undefined;
    }
    const record = data as Record<string, unknown>;
    const nested = record.data as Record<string, unknown> | undefined;
    const message = record.message ?? nested?.message;
    if (Array.isArray(message)) {
      return message.filter((m) => typeof m === 'string').join('; ');
    }
    if (typeof message === 'string') {
      return message;
    }
    return undefined;
  }
}
