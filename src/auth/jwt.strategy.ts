import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../common/decorators/current-user.decorator';

// Passport strategy that validates the JWT on every protected route
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  // Whatever this returns is attached to request.user
  validate(payload: { sub: string; userType: string; email: string }): JwtPayload {
    return {
      userId: payload.sub,
      userType: payload.userType as 'business' | 'investor',
      email: payload.email,
    };
  }
}
