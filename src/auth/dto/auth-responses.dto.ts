import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthTokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken: string;

  @ApiProperty({ enum: ['business', 'investor'] })
  userType: string;

  @ApiPropertyOptional({ example: '1234567890', nullable: true })
  squadVirtualAccountNumber: string | null;
}
