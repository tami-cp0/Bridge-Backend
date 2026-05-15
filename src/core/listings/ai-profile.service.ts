import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { OpenAiConfig } from '../../config/config';
import type { OpenAiConfigType } from '../../config/config.types';

// Model is a deliberate code decision for speed
const MODEL = 'gpt-5-nano';

interface ProfileInput {
  businessName: string;
  sector: string;
  location: string;
  yearsInOperation: number;
  selfReportedMonthlyRevenueNaira: number;
  monoVerifiedMonthlyInflowNaira: number;
  monoHistoryStartDate: string | null;
  bvnVerified: boolean;
  monoLinked: boolean;
  cacVerified: boolean;
  cacRegistrationNumber?: string | null;
  customerConfirmationCount: number;
  capitalRequestedNaira: number;
  useOfFunds: string;
  expectedImpact: string;
  revenueSharePercent: number;
  totalReturnPercent: number;
  totalReturnAmountNaira: number;
  targetRepaymentMonths: number;
}

@Injectable()
export class AiProfileService {
  private readonly logger = new Logger(AiProfileService.name);
  private client: OpenAI;

  constructor(@Inject(OpenAiConfig.KEY) openAiCfg: OpenAiConfigType) {
    this.client = new OpenAI({
      apiKey: openAiCfg.apiKey,
    });
  }

  async generateProfile(input: ProfileInput): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: MODEL,
        max_completion_tokens: 2000,
        messages: [
          {
            role: 'system',
            content:
              'You are generating an investment profile for a micro-investment platform called Bridge. Write a clear honest narrative in plain English that a non-financial investor can read and act on in under two minutes. Cover what the business does, how long it has operated, what the revenue history shows, what the capital will be used for, and what the risk signals are. If there are inconsistencies such as self-reported revenue significantly higher than verified inflow, flag them clearly in a separate paragraph. Do not hide negative signals. Do not use financial jargon. Output only the narrative text with no headings or formatting. but it should be well spaced and flow nicely',
          },
          {
            role: 'user',
            content: this.buildPrompt(input),
          },
        ],
      });

      return response.choices[0]?.message?.content ?? '';
    } catch (err: unknown) {
      this.throwOpenAiError(err);
    }
  }

  async generateSummary(narrative: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: MODEL,
        max_completion_tokens: 150,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert financial copywriter. Summarize the following business investment profile into a maximum of two compelling sentences. Focus on what the business does, what they need the funds for, and the expected impact. Keep it professional and punchy.',
          },
          {
            role: 'user',
            content: narrative,
          },
        ],
      });

      return response.choices[0]?.message?.content?.trim() ?? '';
    } catch (err: unknown) {
      this.throwOpenAiError(err);
    }
  }

  async rephrase(text: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: MODEL,
        max_completion_tokens: 1000,
        messages: [
          {
            role: 'system',
            content:
              'You are a professional editor. Rephrase the following text to correct grammar and spelling mistakes while maintaining the exact meaning and tone. Do not add new information or remove existing details. Just make it read correctly in professional English.',
          },
          {
            role: 'user',
            content: text,
          },
        ],
      });

      return response.choices[0]?.message?.content?.trim() ?? text;
    } catch (err: unknown) {
      this.throwOpenAiError(err);
    }
  }

  private throwOpenAiError(err: unknown): never {
    const status =
      typeof err === 'object' && err !== null
        ? ((err as { status?: number; statusCode?: number }).status ??
          (err as { statusCode?: number }).statusCode)
        : undefined;

    if (status && status >= 400 && status < 500) {
      console.log(err);
      throw new BadRequestException('AI profile request rejected');
    }
    if (status && status === 503) {
      throw new ServiceUnavailableException('AI profile service unavailable');
    }

    const message =
      typeof err === 'object' && err !== null
        ? (err as { message?: string }).message
        : String(err);

    this.logger.error('OpenAI profile generation failed', {
      status: status ?? 'unknown',
      message,
    });
    throw new InternalServerErrorException('AI profile generation failed');
  }

  private buildPrompt(input: ProfileInput): string {
    return `
Business Name: ${input.businessName}
Sector: ${input.sector}
Location: ${input.location}
Years in Operation (Self-Reported): ${input.yearsInOperation}
Self-Reported Average Monthly Revenue: ₦${(input.selfReportedMonthlyRevenueNaira / 100).toLocaleString()}
Mono-Verified Average Monthly Inflow: ₦${(input.monoVerifiedMonthlyInflowNaira / 100).toLocaleString()} (covering history from ${input.monoHistoryStartDate ?? 'unknown'})
BVN Verified: ${input.bvnVerified ? 'Yes' : 'No'}
Bank Account Linked (Mono): ${input.monoLinked ? 'Yes' : 'No'}
CAC/SMEDAN Registered: ${input.cacVerified ? `Yes (${input.cacRegistrationNumber})` : 'No'}
Customer Reference Confirmations: ${input.customerConfirmationCount} confirmed
Capital Requested: ₦${(input.capitalRequestedNaira / 100).toLocaleString()}
Use of Funds: ${input.useOfFunds}
Expected Impact: ${input.expectedImpact}
Revenue Share Percentage: ${input.revenueSharePercent}% of monthly revenue
Total Return to Investors: ${input.totalReturnPercent}% (₦${(input.totalReturnAmountNaira / 100).toLocaleString()} total)
Target Repayment Horizon: ${input.targetRepaymentMonths} months

Generate an investment profile narrative for this business.
    `.trim();
  }
}
