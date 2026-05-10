import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCacDto {
  @ApiProperty({ example: 'RC1234567', description: 'CAC registration number' })
  @IsString()
  @IsNotEmpty()
  cacRegistrationNumber!: string;
}
