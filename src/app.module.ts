import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { configurations } from './config/config';
import { validateConfig } from './config/config.validation';
import { SquadModule } from './core/squad/squad.module';
import { MonoModule } from './core/mono/mono.module';
import { AuthModule } from './core/auth/auth.module';
import { VerificationModule } from './core/verification/verification.module';
import { BusinessModule } from './core/business/business.module';
import { InvestorModule } from './core/investor/investor.module';
import { PlatformModule } from './core/platform/platform.module';
import { ListingsModule } from './core/listings/listings.module';
import { InvestmentsModule } from './core/investments/investments.module';
import { SweepModule } from './core/sweep/sweep.module';
import { BridgeRatingModule } from './core/bridge-rating/bridge-rating.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { SchedulerModule } from './core/scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      ignoreEnvFile: false,
      load: [...configurations],
      validate: validateConfig,
    }),
    ScheduleModule.forRoot(),
    SquadModule,
    MonoModule,
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
