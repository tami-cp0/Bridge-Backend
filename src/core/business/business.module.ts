import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { SweepModule } from '../sweep/sweep.module';
import { SquadModule } from '../squad/squad.module';

@Module({
  imports: [SweepModule, SquadModule],
  controllers: [BusinessController],
  providers: [BusinessService],
  exports: [BusinessService],
})
export class BusinessModule {}
