import { IsNumber, IsPositive, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateListingDto {
  @ApiProperty({ example: 5000000, description: 'Capital requested in kobo. Must not exceed the business tier cap (Tier 1: ₦100k, Tier 2: ₦500k, Tier 3: ₦1M). Businesses can raise any amount up to their cap.' })
  @IsNumber()
  @IsPositive()
  capitalRequested!: number;

  @ApiProperty({ example: 'Purchase two additional commercial ovens and expand delivery fleet.' })
  @IsString()
  @IsNotEmpty()
  useOfFunds!: string;

  @ApiProperty({ example: 'Increase monthly output from 800 to 2,000 loaves and serve 5 new hotel contracts.' })
  @IsString()
  @IsNotEmpty()
  expectedImpact!: string;
}
