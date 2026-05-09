import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterBusinessDto } from './dto/register-business.dto';
import { RegisterInvestorDto } from './dto/register-investor.dto';
import { LoginDto } from './dto/login.dto';
import { AuthTokenResponseDto } from './dto/auth-responses.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register/business')
  @ApiOperation({ summary: 'Register a business account — verifies BVN and creates Squad virtual account' })
  @ApiResponse({ status: 201, type: AuthTokenResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error — missing or invalid fields' })
  @ApiResponse({ status: 409, description: 'Email, phone, or BVN already registered' })
  registerBusiness(@Body() dto: RegisterBusinessDto) {
    return this.authService.registerBusiness(dto);
  }

  @Post('register/investor')
  @ApiOperation({ summary: 'Register an investor account — verifies BVN and creates Squad virtual account' })
  @ApiResponse({ status: 201, type: AuthTokenResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error — missing or invalid fields' })
  @ApiResponse({ status: 409, description: 'Email, phone, or BVN already registered' })
  registerInvestor(@Body() dto: RegisterInvestorDto) {
    return this.authService.registerInvestor(dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in and receive a JWT' })
  @ApiResponse({ status: 200, type: AuthTokenResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error — missing or invalid fields' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
