import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterBusinessDto } from './dto/register-business.dto';
import { RegisterInvestorDto } from './dto/register-investor.dto';
import { VerifyBvnDto } from './dto/verify-bvn.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register/business')
  @ApiOperation({ summary: 'Register a business account' })
  @ApiResponse({ status: 201, description: '{ userId, userType }. BVN verification required before login.' })
  @ApiResponse({ status: 400, description: 'Validation error — missing or invalid fields' })
  @ApiResponse({ status: 409, description: 'Email or phone already registered' })
  registerBusiness(@Body() dto: RegisterBusinessDto) {
    return this.authService.registerBusiness(dto);
  }

  @Post('register/investor')
  @ApiOperation({ summary: 'Register an investor account' })
  @ApiResponse({ status: 201, description: '{ userId, userType }. BVN verification required before login.' })
  @ApiResponse({ status: 400, description: 'Validation error — missing or invalid fields' })
  @ApiResponse({ status: 409, description: 'Email or phone already registered' })
  registerInvestor(@Body() dto: RegisterInvestorDto) {
    return this.authService.registerInvestor(dto);
  }

  @Post('verify-bvn')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify BVN and create Squad virtual account' })
  @ApiResponse({ status: 200, description: '{ accessToken, userType, squadVirtualAccountNumber }' })
  @ApiResponse({ status: 400, description: 'Validation error, or BVN already verified for this account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'BVN already registered to another account' })
  verifyBvn(@Body() dto: VerifyBvnDto) {
    return this.authService.verifyBvn(dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in and receive a JWT' })
  @ApiResponse({ status: 200, description: '{ accessToken, userType, squadVirtualAccountNumber }' })
  @ApiResponse({ status: 400, description: 'Validation error — missing or invalid fields' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or BVN not yet verified' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
