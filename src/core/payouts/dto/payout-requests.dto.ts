import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class InitiatePayoutDto {
  @ApiProperty({
    example: '10000',
    description: 'Amount in kobo as a string (e.g. "10000" for NGN 100)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/)
  amount!: string;
}

export class RequeryPayoutDto {
  @ApiProperty({
    example: 'SB3YYHDENW_9f9b7a4e-79d6-4c7f-9d2d-0a7b6f037c1e',
    description: 'Transaction reference returned on initiate',
  })
  @IsString()
  @IsNotEmpty()
  transactionReference!: string;
}
