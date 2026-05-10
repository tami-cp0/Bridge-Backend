import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { JwtConfig } from '../../config/config';
import { JwtConfigType } from '../../config/config.types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (jwtCfg: JwtConfigType) => ({
        secret: jwtCfg.secret,
        // @nestjs/jwt v11 expiresIn expects branded StringValue from ms, not plain string
        signOptions: { expiresIn: jwtCfg.expiresIn as any }, // eslint-disable-line @typescript-eslint/no-unsafe-assignment
      }),
      inject: [JwtConfig.KEY],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // JwtModule and PassportModule exported so other modules can use JwtAuthGuard
  exports: [JwtModule, PassportModule],
})
export class AuthModule {}
