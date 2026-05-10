import { IsUUID, IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInvestmentDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'ID of the listing to invest in' })
  @IsUUID()
  listingId!: string;

  @ApiProperty({ example: 500000, description: 'Amount to commit in kobo (minimum 500,000 = ₦5,000)' })
  @IsNumber()
  @IsPositive()
  amountCommitted!: number;
}
