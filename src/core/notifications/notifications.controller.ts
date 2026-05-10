import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { SuccessResponseDto } from '../../common/dto/common-responses.dto';

@ApiTags('notifications')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Get all notifications for the authenticated user, most recent first',
  })
  @ApiResponse({ status: 200, type: NotificationResponseDto, isArray: true })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getAll(@CurrentUser() user: { userId: string }) {
    return this.notificationsService.getAll(user.userId);
  }

  @Patch(':id/read')
  @ApiParam({ name: 'id', description: 'Notification UUID' })
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  markRead(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.notificationsService.markRead(id, user.userId);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read for the authenticated user',
  })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  markAllRead(@CurrentUser() user: { userId: string }) {
    return this.notificationsService.markAllRead(user.userId);
  }
}
