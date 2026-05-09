import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VerificationService } from './verification.service';
import { VerifyCacDto } from './dto/verify-cac.dto';
import { BusinessGuard } from '../common/guards/business.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('verification')
@ApiBearerAuth('JWT')
@Controller('verify')
export class VerificationController {
  constructor(private verificationService: VerificationService) {}

  @Post('cac')
  @UseGuards(BusinessGuard)
  @ApiOperation({ summary: 'Submit CAC registration number to unlock the 5-point CAC bonus on Bridge Rating' })
  @ApiResponse({ status: 201, description: '{ verified: true }. Sets cacVerified on business profile and adds 5 pts to Bridge Rating.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  verifyCac(
    @CurrentUser() user: JwtPayload,
    @Body() dto: VerifyCacDto,
  ) {
    return this.verificationService.verifyCac(user.userId, dto.cacRegistrationNumber);
  }
}
