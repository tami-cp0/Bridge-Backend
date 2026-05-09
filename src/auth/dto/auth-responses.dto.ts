import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({ format: 'uuid', example: 'a1b2c3d4-...' })
  userId: string;

  @ApiProperty({ enum: ['business', 'investor'] })
  userType: string;
}

export class AuthTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ enum: ['business', 'investor'] })
  userType: string;

  @ApiPropertyOptional({ example: '1234567890', nullable: true })
  squadVirtualAccountNumber: string | null;
}
