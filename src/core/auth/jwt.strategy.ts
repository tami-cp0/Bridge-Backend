import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfig } from '../../config/config';
import type { JwtConfigType } from '../../config/config.types';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(JwtConfig.KEY) jwtCfg: JwtConfigType) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtCfg.secret!,
    });
  }

  // Whatever this returns is attached to request.user
  validate(payload: {
    sub: string;
    userType: string;
    email: string;
  }): JwtPayload {
    return {
      userId: payload.sub,
      userType: payload.userType as 'business' | 'investor',
      email: payload.email,
    };
  }
}
