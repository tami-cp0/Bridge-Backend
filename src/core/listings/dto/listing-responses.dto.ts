import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReturnRateBreakdownDto {
  @ApiProperty({ example: 30 })
  baseRate: number;

  @ApiProperty({ enum: ['Seed', 'Established', 'Elite'] })
  standing: string;

  @ApiProperty({
    example: -7,
    description: 'Reduction applied based on Bridge Rating standing',
  })
  ratingReduction: number;

  @ApiProperty({
    example: 1.5,
    description: 'Additional percent per month beyond 6-month base horizon',
  })
  horizonBump: number;

  @ApiProperty({ example: 24.5, description: 'Final clamped rate (20–40%)' })
  finalRate: number;
}

export class CalculateTermsResponseDto {
  @ApiProperty({ example: 5000000, description: 'Capital requested in kobo' })
  capitalRequested: number;

  @ApiProperty({
    example: 24.5,
    description: 'Total return percent charged to the business',
  })
  totalReturnPercent: number;

  @ApiProperty({
    example: 6225000,
    description: 'Total amount the business must repay in kobo',
  })
  totalReturnAmount: number;

  @ApiProperty({
    example: 8.5,
    description: 'Percent of each incoming payment swept for repayment',
  })
  revenueSharePercent: number;

  @ApiProperty({
    example: 9,
    description: 'Expected months to full repayment at average revenue',
  })
  targetRepaymentMonths: number;

  @ApiProperty({
    example: 85000,
    description: 'Expected monthly sweep amount at average revenue in kobo',
  })
  monthlySweepAtAverage: number;

  @ApiProperty({
    example: 2000000,
    description: 'Tranche 1 amount (40% of capital) in kobo',
  })
  tranche1: number;

  @ApiProperty({
    example: 1500000,
    description: 'Tranche 2 amount (30% of capital) in kobo',
  })
  tranche2: number;

  @ApiProperty({
    example: 1500000,
    description: 'Tranche 3 amount (30% of capital) in kobo',
  })
  tranche3: number;

  @ApiProperty({ type: ReturnRateBreakdownDto })
  returnRateBreakdown: ReturnRateBreakdownDto;
}

export class TrancheResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  listingId: string;

  @ApiProperty({ example: 1 })
  trancheNumber: number;

  @ApiProperty({ example: 2000000, description: 'Amount in kobo' })
  amount: number;

  @ApiProperty({ enum: ['locked', 'released', 'returned'] })
  status: string;

  @ApiProperty({ example: 'Released when listing is fully funded' })
  releaseCondition: string;

  @ApiPropertyOptional()
  releasedAt: Date | null;

  @ApiPropertyOptional()
  squadTransferReference: string | null;
}

export class ListingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  businessId: string;

  @ApiProperty({ example: 5000000, description: 'In kobo' })
  capitalRequested: number;

  @ApiProperty()
  useOfFunds: string;

  @ApiProperty()
  expectedImpact: string;

  @ApiProperty({ example: '8.50' })
  revenueSharePercent: string;

  @ApiProperty({ example: 6225000, description: 'In kobo' })
  totalReturnAmount: number;

  @ApiProperty({ example: '24.50' })
  totalReturnPercent: string;

  @ApiProperty({ example: 9 })
  targetRepaymentMonths: number;

  @ApiProperty({ description: 'AI-generated investor-facing narrative' })
  aiProfile: string;

  @ApiProperty({ description: 'Short AI-generated 2-sentence summary' })
  generatedProfile: string;

  @ApiProperty({ enum: ['active', 'funded', 'completed', 'defaulted'] })
  status: string;

  @ApiProperty({
    example: 3000000,
    description: 'Total investor capital committed so far in kobo',
  })
  totalCommitted: number;

  @ApiProperty({
    example: 500000,
    description: 'Total amount swept so far in kobo',
  })
  totalSwept: number;

  @ApiProperty({ example: 3 })
  investorCount: number;

  @ApiProperty({ example: false, description: 'True if the current user has invested in this deal' })
  isInvested?: boolean;

  @ApiPropertyOptional({ type: TrancheResponseDto, isArray: true })
  tranches?: TrancheResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SweepEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  listingId: string;

  @ApiProperty({
    example: 1000000,
    description: 'Full incoming payment in kobo',
  })
  incomingPaymentAmount: number;

  @ApiProperty({ example: '8.50' })
  sweepPercent: string;

  @ApiProperty({ example: 85000, description: 'Amount swept in kobo' })
  sweepAmount: number;

  @ApiProperty({ example: 10000, description: '1% Platform service fee in kobo' })
  serviceFee: number;

  @ApiProperty({
    example: 915000,
    description: 'Amount retained by business in kobo',
  })
  netAmountRetained: number;

  @ApiProperty()
  squadWebhookReference: string;

  @ApiProperty()
  processedAt: Date;
}
