import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterBusinessDto {
  @ApiProperty({ example: 'Amara Okonkwo' })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({ example: 'amara@acmebakery.ng' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '08012345678' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: 'Str0ngPass!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Acme Bakery' })
  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @ApiProperty({ example: 'Food & Beverage' })
  @IsString()
  @IsNotEmpty()
  sector!: string;

  @ApiProperty({ example: 'Lagos, Nigeria' })
  @IsString()
  @IsNotEmpty()
  location!: string;

  @ApiProperty({ example: 3 })
  @IsNumber()
  @IsPositive()
  yearsInOperation!: number;

  @ApiProperty({ example: 80000000, description: 'Average monthly revenue in kobo' })
  @IsNumber()
  @IsPositive()
  averageMonthlyRevenue!: number;

  @ApiProperty({ example: 'We supply artisan bread to 12 hotels in Lagos Island.' })
  @IsString()
  @IsNotEmpty()
  businessDescription!: string;
}
