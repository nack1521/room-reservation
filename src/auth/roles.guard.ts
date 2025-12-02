import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.get<Role[]>('roles', ctx.getHandler()) || [];
    if (!required.length) return true;
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user || !user.roles) return false;
    return required.some(r => user.roles.includes(r));
  }
}