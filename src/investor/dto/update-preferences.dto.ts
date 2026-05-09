import { IsOptional, IsArray, IsString, IsIn, IsNumber, IsPositive, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SectorEnum } from '../../common/enums/sector.enum';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ enum: SectorEnum, isArray: true, example: [SectorEnum.FOOD_BEVERAGE, SectorEnum.TECHNOLOGY] })
  @IsOptional()
  @IsArray()
  @IsEnum(SectorEnum, { each: true })
  sectorInterests?: SectorEnum[];

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
