import { IsNumber, IsPositive, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CalculateTermsDto {
  @ApiProperty({ example: 5000000, description: 'Capital requested in kobo' })
  @IsNumber()
  @IsPositive()
  capitalRequested!: number;

  @ApiProperty({
    example: 12,
    description: 'Preferred repayment duration in months (1 to 24 months)',
    minimum: 1,
    maximum: 24,
  })
  @IsInt()
  @Min(1)
  @Max(24)
  preferredRepaymentMonths!: number;
}
