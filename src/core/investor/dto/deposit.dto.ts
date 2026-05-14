import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class SimulateDepositDto {
  @ApiProperty({
    example: 500000,
    description: 'Amount in kobo to simulate depositing (e.g. 500000 = ₦5,000)',
  })
  @IsInt()
  @IsPositive()
  amount!: number;
}

export class InitiateCheckoutDto {
  @ApiProperty({
    example: 5000,
    description: 'Amount in kobo (e.g. 5000 = ₦50)',
  })
  @IsInt()
  @IsPositive()
  amount!: number;
}

