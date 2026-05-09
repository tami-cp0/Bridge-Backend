import { IsString, IsNotEmpty, IsUUID, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyBvnDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ example: '12345678901', description: 'BVN — exactly 11 digits' })
  @IsString()
  @IsNotEmpty()
  @Length(11, 11)
  bvn!: string;
}
