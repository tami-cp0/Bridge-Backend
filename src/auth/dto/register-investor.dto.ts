import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsArray,
  IsNumber,
  IsPositive,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterInvestorDto {
  @ApiProperty({ example: 'Chidi Nwosu' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'chidi@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '08098765432' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: 'Str0ngPass!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

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
