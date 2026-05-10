import { IsNumber, IsPositive, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CalculateTermsDto {
  @ApiProperty({ example: 5000000, description: 'Capital requested in kobo' })
  @IsNumber()
  @IsPositive()
  capitalRequested!: number;

  @ApiProperty({
    example: 12,
    description:
      'Preferred repayment duration in months. Must be one of: 12, 15, 18, 21, 24',
    enum: [12, 15, 18, 21, 24],
  })
  @IsIn([12, 15, 18, 21, 24])
  preferredRepaymentMonths!: number;
}
