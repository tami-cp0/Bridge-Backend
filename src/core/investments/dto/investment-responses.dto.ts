import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SweepEventResponseDto } from '../../listings/dto/listing-responses.dto';

export class SweepDistributionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  sweepEventId: string;

  @ApiProperty({ format: 'uuid' })
  investmentId: string;

  @ApiProperty({ example: 8500, description: 'Amount distributed to this investor in kobo' })
  amountDistributed: number;

  @ApiPropertyOptional()
  squadTransferReference: string | null;

  @ApiPropertyOptional()
  createdAt: Date | null;
}

export class SweepEventWithDistributionDto extends SweepEventResponseDto {
  @ApiPropertyOptional({ type: SweepDistributionDto, nullable: true, description: 'Present only when the caller is an investor in this deal' })
  distribution: SweepDistributionDto | null;
}
