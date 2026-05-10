import {
  IsNumber,
  IsPositive,
  IsString,
  IsNotEmpty,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateListingDto {
  @ApiProperty({
    example: 5000000,
    description:
      'Capital requested in kobo. Capped at a revenue multiple per tier (Tier 1: 1.5×, Tier 2 and Tier 3: 2× average monthly revenue).',
  })
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

  @ApiProperty({
    example:
      'Purchase two additional commercial ovens and expand delivery fleet.',
  })
  @IsString()
  @IsNotEmpty()
  useOfFunds!: string;

  @ApiProperty({
    example:
      'Increase monthly output from 800 to 2,000 loaves and serve 5 new hotel contracts.',
  })
  @IsString()
  @IsNotEmpty()
  expectedImpact!: string;
}
