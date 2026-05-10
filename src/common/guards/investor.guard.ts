import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { JwtPayload } from '../decorators/current-user.decorator';

// Extends JwtAuthGuard to also enforce that the caller is an investor user
@Injectable()
export class InvestorGuard extends JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context); // runs JWT validation first
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    if (!user || user.userType !== 'investor') {
      throw new ForbiddenException('Investor account required');
    }
    return true;
  }
}
