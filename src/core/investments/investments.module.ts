import { Module } from '@nestjs/common';
import { InvestmentsController } from './investments.controller';
import { InvestmentsService } from './investments.service';
import { SweepModule } from '../sweep/sweep.module';

@Module({
  imports: [SweepModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
