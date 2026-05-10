import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BridgeRatingResponseDto } from '../../bridge-rating/dto/bridge-rating-response.dto';
import { SectorEnum } from '../../../common/enums/sector.enum';

export class BusinessStatsResponseDto {
  @ApiProperty({
    example: 15000000,
    description: 'Total capital raised across all deals in kobo',
  })
  totalCapitalRaised: number;

  @ApiProperty({
    example: 3750000,
    description: 'Total swept to investors across all deals in kobo',
  })
  totalSweptToInvestors: number;

  @ApiProperty({ example: 2 })
  completedDealsCount: number;
}

export class PaymentLinkResponseDto {
  @ApiProperty({ example: 'https://sandbox.squadco.com/1234567890' })
  paymentLink: string;

  @ApiProperty({ example: '1234567890' })
  virtualAccountNumber: string;
}

export class SweepSummaryResponseDto {
  @ApiProperty({ example: 500000, description: 'Total swept so far in kobo' })
  totalSwept: number;

  @ApiProperty({
    example: 5725000,
    description: 'Remaining amount owed to investors in kobo',
  })
  totalRemaining: number;

  @ApiProperty({
    example: '8.50',
    description: 'Current revenue share percentage being swept',
  })
  currentSweepPercent: string;
}

export class BusinessProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'Mama Put Kitchen' })
  businessName: string;

  @ApiProperty({ enum: SectorEnum, example: SectorEnum.FOOD_BEVERAGE })
  sector: SectorEnum;

  @ApiProperty({ example: 'Lagos' })
  location: string;

  @ApiProperty({ example: 3 })
  yearsInOperation: number;

  @ApiProperty({ example: 1000000, description: 'In kobo' })
  averageMonthlyRevenue: number;

  @ApiProperty()
  businessDescription: string;

  @ApiPropertyOptional()
  cacRegistrationNumber: string | null;

  @ApiProperty({ example: false })
  cacVerified: boolean;

  @ApiProperty({
    example: false,
    description:
      'True once the business has connected a bank account via Mono Connect',
  })
  bankConnected: boolean;

  @ApiProperty({ example: 1 })
  tier: number;

  @ApiProperty({ example: 0 })
  completedRepaymentCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UserPublicDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Amara Obi' })
  fullName: string;

  @ApiProperty({ example: 'amara@example.com' })
  email: string;

  @ApiProperty({ example: '08012345678' })
  phone: string;

  @ApiProperty({ enum: ['business', 'investor'] })
  userType: string;

  @ApiProperty({ example: true })
  bvnVerified: boolean;

  @ApiPropertyOptional({ example: '1234567890' })
  squadVirtualAccountNumber: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class BusinessProfileFullResponseDto {
  @ApiProperty({ type: BusinessProfileDto })
  business_profiles: BusinessProfileDto;

  @ApiPropertyOptional({ type: UserPublicDto })
  users: UserPublicDto | null;

  @ApiPropertyOptional({ type: BridgeRatingResponseDto })
  bridge_ratings: BridgeRatingResponseDto | null;
}
