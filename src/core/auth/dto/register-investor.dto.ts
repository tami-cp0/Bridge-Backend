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
  Matches,
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

  @ApiProperty({
    example: '22123456789',
    description: 'BVN â€” 11 digits starting with 22',
  })
  @IsString()
  @IsNotEmpty()
  @Length(11, 11)
  @Matches(/^22\d{9}$/)
  bvn!: string;

  @ApiPropertyOptional({
    enum: SectorEnum,
    isArray: true,
    example: [SectorEnum.FOOD_BEVERAGE, SectorEnum.TECHNOLOGY],
  })
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

  @ApiProperty({
    example: '0123456789',
    description: 'Beneficiary bank account number — exactly 10 digits',
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 10)
  @Matches(/^\d{10}$/)
  beneficiaryAccount!: string;

  @ApiProperty({
    example: '058',
    description: '3-digit CBN bank code (e.g. 058 for GTB, 011 for First Bank)',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  beneficiaryBankCode!: string;
}
