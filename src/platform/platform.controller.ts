import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PlatformService } from './platform.service';

@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(private platformService: PlatformService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform-wide statistics for the landing page' })
  @ApiResponse({ status: 200, description: 'totalBusinessesFunded, totalCapitalDeployedKobo, averageInvestorReturnPercent, averageRepaymentDays' })
  getStats() {
    return this.platformService.getStats();
  }
}
