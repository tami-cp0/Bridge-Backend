import { ApiProperty } from '@nestjs/swagger';

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;
}

export class VerifiedResponseDto {
  @ApiProperty({ example: true })
  verified: boolean;
}

export class ReceivedResponseDto {
  @ApiProperty({ example: true })
  received: boolean;
}
