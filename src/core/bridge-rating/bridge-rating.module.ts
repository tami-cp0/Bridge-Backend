import { Module } from '@nestjs/common';
import { BridgeRatingController } from './bridge-rating.controller';
import { BridgeRatingService } from './bridge-rating.service';

@Module({
  controllers: [BridgeRatingController],
  providers: [BridgeRatingService],
  exports: [BridgeRatingService],
})
export class BridgeRatingModule {}
