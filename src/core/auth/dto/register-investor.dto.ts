import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsArray,
  IsIn,
  IsEnum,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SectorEnum } from '../../../common/enums/sector.enum';

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

  @ApiProperty({ example: '12345678901', description: 'BVN â€” exactly 11 digits' })
  @IsString()
  @IsNotEmpty()
  @Length(11, 11)
  bvn!: string;

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
}
