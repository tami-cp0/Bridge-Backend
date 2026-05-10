import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { VerificationService } from './verification.service';
import { VerifyCacDto } from './dto/verify-cac.dto';
import { BusinessGuard } from '../../common/guards/business.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { VerifiedResponseDto } from '../../common/dto/common-responses.dto';

@ApiTags('verification')
@ApiBearerAuth('JWT')
@Controller('verify')
export class VerificationController {
  constructor(private verificationService: VerificationService) {}

  @Post('cac')
  @UseGuards(BusinessGuard)
  @ApiOperation({
    summary:
      'Verify CAC registration number via Mono — confirms the RC number against the CAC registry and unlocks the 5-point Bridge Rating bonus',
  })
  @ApiResponse({ status: 201, type: VerifiedResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'CAC registration number could not be verified by the registry',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — caller is not a business account',
  })
  @ApiResponse({ status: 404, description: 'Business profile not found' })
  verifyCac(@CurrentUser() user: JwtPayload, @Body() dto: VerifyCacDto) {
    return this.verificationService.verifyCac(
      user.userId,
      dto.cacRegistrationNumber,
    );
  }
}
