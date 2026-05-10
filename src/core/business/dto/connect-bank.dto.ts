import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ConnectBankDto {
  @ApiProperty({
    description:
      'Authorization code returned by the Mono Connect widget after the user authenticates their bank account',
    example: 'code_xyz123',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
