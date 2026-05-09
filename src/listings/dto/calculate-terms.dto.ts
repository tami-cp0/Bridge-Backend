import { IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CalculateTermsDto {
  @ApiProperty({ example: 5000000, description: 'Capital requested in kobo' })
  @IsNumber()
  @IsPositive()
  capitalRequested!: number;
}
