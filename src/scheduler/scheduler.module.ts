import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { BridgeRatingModule } from '../bridge-rating/bridge-rating.module';

@Module({
  imports: [BridgeRatingModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
