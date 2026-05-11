import { ApiProperty } from '@nestjs/swagger';

export class AccountLookupResponseDto {
  @ApiProperty({ example: '000013' })
  bankCode: string;

  @ApiProperty({ example: '0123456789' })
  accountNumber: string;

  @ApiProperty({ example: 'JOHN DOE' })
  accountName: string;
}

export class PayoutResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['business', 'investor'] })
  userType: string;

  @ApiProperty({ example: 10000, description: 'Amount in kobo' })
  amount: number;

  @ApiProperty({ example: '000013' })
  bankCode: string;

  @ApiProperty({ example: '0123456789' })
  accountNumber: string;

  @ApiProperty({ example: 'JOHN DOE' })
  accountName: string;

  @ApiProperty({ example: 'SB3YYHDENW_9f9b7a4e-79d6-4c7f-9d2d-0a7b6f037c1e' })
  transactionReference: string;

  @ApiProperty({ example: 'Project payout' })
  remark: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiProperty({ example: 'pending', nullable: true })
  squadStatus: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  completedAt: Date | null;
}

export class InitiatePayoutResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'SB3YYHDENW_9f9b7a4e-79d6-4c7f-9d2d-0a7b6f037c1e' })
  transactionReference: string;

  @ApiProperty({ example: 'pending' })
  status: string;
}

export class RequeryPayoutResponseDto {
  @ApiProperty({ example: 'SB3YYHDENW_9f9b7a4e-79d6-4c7f-9d2d-0a7b6f037c1e' })
  transactionReference: string;

  @ApiProperty({ example: 'successful' })
  status: string;

  @ApiProperty({ example: 'successful', nullable: true })
  squadStatus: string | null;

  @ApiProperty()
  updatedAt: Date;
}

export class PayoutListResponseDto {
  @ApiProperty({ type: PayoutResponseDto, isArray: true })
  data: PayoutResponseDto[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  perPage: number;

  @ApiProperty({ example: 42 })
  total: number;
}
