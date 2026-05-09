import { Module } from '@nestjs/common';
import { SweepController } from './sweep.controller';
import { SweepService } from './sweep.service';
import { DynamicSweepService } from './dynamic-sweep.service';
import { BridgeRatingModule } from '../bridge-rating/bridge-rating.module';

@Module({
  imports: [BridgeRatingModule],
  controllers: [SweepController],
  providers: [SweepService, DynamicSweepService],
  exports: [SweepService, DynamicSweepService],
})
export class SweepModule {}
