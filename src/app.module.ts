import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SquadModule } from './squad/squad.module';
import { AuthModule } from './auth/auth.module';
import { VerificationModule } from './verification/verification.module';
import { BusinessModule } from './business/business.module';
import { InvestorModule } from './investor/investor.module';
import { PlatformModule } from './platform/platform.module';
import { ListingsModule } from './listings/listings.module';
import { InvestmentsModule } from './investments/investments.module';
import { SweepModule } from './sweep/sweep.module';
import { BridgeRatingModule } from './bridge-rating/bridge-rating.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    SquadModule,
    AuthModule,
    VerificationModule,
    BusinessModule,
    InvestorModule,
    PlatformModule,
    ListingsModule,
    InvestmentsModule,
    SweepModule,
    BridgeRatingModule,
    NotificationsModule,
    SchedulerModule,
  ],
})
export class AppModule {}
