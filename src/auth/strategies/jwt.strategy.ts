import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../../user/user.service';
import { isValidObjectId } from 'mongoose';

const looksLikeJwt = (token?: string | null) => {
  if (!token) return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every(Boolean);
};

const normalizeToken = (token?: string | null) => {
  if (!token) return null;
  return token.trim().replace(/^"|"$/g, '');
};

const extractBearerToken = (req: any) => {
  const raw = req?.headers?.authorization;
  if (!raw || typeof raw !== 'string') return null;

  const [scheme, token] = raw.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  const normalized = normalizeToken(token);
  return looksLikeJwt(normalized) ? normalized : null;
};

const cookieExtractor = (req: any) => {
  if (!req) return null;

  // First try parsed cookie object.
  const cookieValue = req.cookies?.jwt;
  if (cookieValue && typeof cookieValue === 'string') {
    const withoutBearerPrefix = cookieValue.replace(/^Bearer\s+/i, '');
    const normalized = normalizeToken(withoutBearerPrefix);
    if (looksLikeJwt(normalized)) return normalized;
  }

  // Then parse raw cookie header because duplicate cookie keys can exist and parser
  // usually keeps only one value (sometimes the malformed one).
  const rawCookieHeader = req?.headers?.cookie;
  if (typeof rawCookieHeader === 'string') {
    const regex = /(?:^|;\s*)jwt=([^;]+)/g;
    let match: RegExpExecArray | null = regex.exec(rawCookieHeader);
    while (match) {
      const candidate = normalizeToken(match[1]?.replace(/^Bearer\s+/i, ''));
      if (looksLikeJwt(candidate)) return candidate;
      match = regex.exec(rawCookieHeader);
    }
  }

  return null;
};

const headerOrCookieExtractor = (req: any) => {
  const cookie = cookieExtractor(req);
  if (cookie) return cookie;

  const bearer = extractBearerToken(req);
  if (bearer) return bearer;

  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private users: UserService,
  ) {
    const secret = config.get<string>('JWT_SECRET') || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    super({
      jwtFromRequest: headerOrCookieExtractor,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const baseUser = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles || [],
      name: payload.name,
    };

    // Some testing tokens use non-ObjectId subjects (e.g. "postman-admin").
    // Skip DB lookup in that case to avoid Mongoose CastError.
    if (!isValidObjectId(payload?.sub)) {
      return baseUser;
    }

    const user = await this.users.findById(payload.sub);
    return user ? { ...baseUser, profile: user } : baseUser;
  }
}