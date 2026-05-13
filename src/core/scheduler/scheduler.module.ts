import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { BridgeRatingModule } from '../bridge-rating/bridge-rating.module';
import { SquadModule } from '../squad/squad.module';

@Module({
  imports: [BridgeRatingModule, SquadModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
