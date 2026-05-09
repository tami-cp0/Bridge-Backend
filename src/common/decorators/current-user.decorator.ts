import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Shape of what JwtStrategy.validate() returns — attached to request.user after auth
export interface JwtPayload {
  userId: string;
  userType: 'business' | 'investor';
  email: string;
}

// @CurrentUser() injects the authenticated user into a controller parameter
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
