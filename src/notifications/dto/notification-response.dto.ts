import { ApiProperty } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: 'Return received' })
  title: string;

  @ApiProperty({ example: '₦5,000 was distributed to your wallet from a sweep.' })
  body: string;

  @ApiProperty({ example: false })
  read: boolean;

  @ApiProperty()
  createdAt: Date;
}
