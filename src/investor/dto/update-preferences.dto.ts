import { IsOptional, IsArray, IsString, IsIn, IsNumber, IsPositive } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ example: ['Food & Beverage', 'Tech'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sectorInterests?: string[];

  @ApiPropertyOptional({ enum: ['conservative', 'balanced', 'growth'] })
  @IsOptional()
  @IsString()
  @IsIn(['conservative', 'balanced', 'growth'])
  riskTierPreference?: string;

  @ApiPropertyOptional({ enum: ['short', 'medium', 'flexible'] })
  @IsOptional()
  @IsString()
  @IsIn(['short', 'medium', 'flexible'])
  returnTimelinePreference?: string;

  @ApiPropertyOptional({ example: 50000000, description: 'Minimum investment per deal in kobo' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  investmentRangeMin?: number;

  @ApiPropertyOptional({ example: 500000000, description: 'Maximum investment per deal in kobo' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  investmentRangeMax?: number;
}
