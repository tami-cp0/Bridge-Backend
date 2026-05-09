import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

// Extends JwtAuthGuard to also enforce that the caller is an investor user
@Injectable()
export class InvestorGuard extends JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context); // runs JWT validation first
    const { user } = context.switchToHttp().getRequest();
    if (user?.userType !== 'investor') {
      throw new ForbiddenException('Investor account required');
    }
    return true;
  }
}
