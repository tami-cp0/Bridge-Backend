import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BridgeRatingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  businessId: string;

  @ApiProperty({ example: '72.50', description: 'Overall score out of 100' })
  overallScore: string;

  @ApiProperty({ enum: ['Seed', 'Established', 'Elite'] })
  standing: string;

  @ApiProperty({ example: '20.00', description: 'Max 30 pts' })
  repaymentSpeedScore: string;

  @ApiProperty({ example: '22.00', description: 'Max 30 pts' })
  repaymentConsistencyScore: string;

  @ApiProperty({ example: '14.00', description: 'Max 20 pts' })
  transactionVolumeScore: string;

  @ApiProperty({ example: '12.00', description: 'Max 15 pts' })
  revenueConsistencyScore: string;

  @ApiProperty({
    example: '5.00',
    description: 'Max 5 pts — unlocked by CAC verification',
  })
  cacBonusScore: string;


  @ApiProperty()
  lastCalculatedAt: Date;

  @ApiPropertyOptional()
  updatedAt: Date | null;
}
