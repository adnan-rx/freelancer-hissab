import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Gates writes to globally-shared configuration (currently the tax rules table).
 * Must be used *after* JwtAuthGuard so `request.user` is populated.
 *
 * There is no admin management UI — promote an account with:
 *   UPDATE users SET is_admin = true WHERE email = '...';
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.user?.isAdmin) {
      throw new ForbiddenException('This action requires an administrator account');
    }
    return true;
  }
}
