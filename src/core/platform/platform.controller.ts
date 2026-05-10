import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { PlatformStatsResponseDto } from './dto/platform-responses.dto';

@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(private platformService: PlatformService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get platform-wide statistics for the landing page',
  })
  @ApiResponse({ status: 200, type: PlatformStatsResponseDto })
  getStats() {
    return this.platformService.getStats();
  }
}
