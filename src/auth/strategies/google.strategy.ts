import { PassportStrategy, AuthGuard } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    const configuredCallbackUrl = configService.get<string>('GOOGLE_CALLBACK_URL');
    const callbackURL = configuredCallbackUrl || 'http://localhost:3000/auth/google/callback';

    if ((process.env.NODE_ENV || '').toLowerCase() === 'production' && !configuredCallbackUrl) {
      throw new Error('GOOGLE_CALLBACK_URL is required in production');
    }

    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, emails = [], photos = [] } = profile;
    const { givenName = '', familyName = '' } = profile.name || {};

    const user = {
      googleId: id,
      email: emails[0]?.value,
      name: `${givenName} ${familyName}`.trim(),
      picture: photos[0]?.value,
      accessToken,
    };
    done(null, user);
  }
}

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}