import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SectorEnum } from '../../../common/enums/sector.enum';

export class InvestorProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiPropertyOptional({ enum: SectorEnum, isArray: true })
  sectorInterests: SectorEnum[] | null;

  @ApiPropertyOptional({ example: 'medium' })
  riskTierPreference: string | null;

  @ApiPropertyOptional({ example: 'short' })
  returnTimelinePreference: string | null;

  @ApiPropertyOptional({
    example: 500000,
    description: 'Minimum investment amount in kobo',
  })
  investmentRangeMin: number | null;

  @ApiPropertyOptional({
    example: 5000000,
    description: 'Maximum investment amount in kobo',
  })
  investmentRangeMax: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class InvestorSummaryResponseDto {
  @ApiProperty({
    example: 10000000,
    description: 'Total capital committed across all investments in kobo',
  })
  totalCapitalDeployed: number;

  @ApiProperty({
    example: 1250000,
    description: 'Total returns received so far in kobo',
  })
  totalReturnsReceived: number;

  @ApiProperty({ example: 2 })
  activeDealsCount: number;

  @ApiProperty({
    example: 400000,
    description:
      '4% of each investment held in default protection pool in kobo',
  })
  defaultPoolContributionBalance: number;
}

export class WalletResponseDto {
  @ApiProperty({
    example: 5000000,
    description: 'Live balance from Squad in kobo',
  })
  availableBalance: number;

  @ApiProperty({
    example: 400000,
    description: 'Sum of default pool contributions in kobo',
  })
  defaultPoolBalance: number;
}

export class InvestorUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ada Obi' })
  fullName: string;

  @ApiProperty({ example: 'ada@example.com' })
  email: string;

  @ApiProperty({ example: '+2348012345678' })
  phone: string;

  @ApiPropertyOptional({ example: '1234567890' })
  squadVirtualAccountNumber: string | null;
}

export class InvestorProfileFullResponseDto {
  @ApiProperty({ type: InvestorProfileDto })
  investor_profiles: InvestorProfileDto;

  @ApiPropertyOptional({ type: InvestorUserDto })
  users: InvestorUserDto | null;
}

export class InvestmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  listingId: string;

  @ApiProperty({ format: 'uuid' })
  investorId: string;

  @ApiProperty({ example: 1000000, description: 'In kobo' })
  amountCommitted: number;

  @ApiProperty({ example: 40000, description: '4% of amountCommitted in kobo' })
  defaultPoolContribution: number;

  @ApiProperty({
    example: '9.6000',
    description: 'Investor share of total listing capital as percent',
  })
  sharePercent: string;

  @ApiProperty({
    example: 1196400,
    description: 'Total return owed to this investor in kobo',
  })
  totalReturnDue: number;

  @ApiProperty({
    example: 200000,
    description: 'Total return received so far in kobo',
  })
  totalReturnReceived: number;

  @ApiProperty({ enum: ['inactive', 'active', 'completed', 'defaulted'] })
  status: string;

  @ApiPropertyOptional()
  squadTransferReference: string | null;

  @ApiProperty({ example: 12, description: 'Target months to full repayment' })
  targetRepaymentMonths: number;

  @ApiProperty({ example: 'TechFlow Solutions' })
  businessName: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
