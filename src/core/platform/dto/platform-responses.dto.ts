import { ApiProperty } from '@nestjs/swagger';

export class PlatformStatsResponseDto {
  @ApiProperty({ example: 42 })
  totalBusinessesFunded: number;

  @ApiProperty({
    description: 'Total capital deployed in kobo',
    example: 500000000,
  })
  totalCapitalDeployedKobo: number;

  @ApiProperty({ example: 22.5 })
  averageInvestorReturnPercent: number;

  @ApiProperty({ example: 180 })
  averageRepaymentDays: number;
}
