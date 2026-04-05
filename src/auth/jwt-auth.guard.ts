import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	handleRequest(err: any, user: any, info: any) {
		if (err || !user) {
			const reason = info?.message || err?.message || 'Missing or invalid JWT token';
			console.warn('[JwtAuthGuard] denied:', reason);
			throw err || new UnauthorizedException(reason);
		}

		return user;
	}
}