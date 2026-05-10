import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { AiProfileService } from './ai-profile.service';

@Module({
  controllers: [ListingsController],
  providers: [ListingsService, AiProfileService],
  exports: [ListingsService],
})
export class ListingsModule {}
