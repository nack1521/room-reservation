import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string) {
    const user: any = await this.users.findByEmail(email);
    if (!user || !user.password) return null;
    const match = await bcrypt.compare(pass, user.password);
    if (!match) return null;
    const { password, ...safe } = user.toObject ? user.toObject() : user;
    return safe;
  }

  async login(user: any) {
    if (!user) throw new UnauthorizedException();
    const payload = { sub: user._id ?? user.id, email: user.email, roles: user.roles || [] };
    return { access_token: this.jwtService.sign(payload) };
  }

  // Upsert user from OAuth provider (Google). Returns the user document.
  async validateOAuthLogin(oauthUser: { email?: string; googleId?: string; name?: string; picture?: string }) {
    const email = oauthUser?.email;
    if (!email) throw new UnauthorizedException('OAuth provider did not return email');

    let user: any = await this.users.findByEmail(email);
    if (!user) {
      user = await this.users.create({
        email,
        name: oauthUser.name,
        googleId: oauthUser.googleId,
        picture: oauthUser.picture,
        roles: ['user'],
      } as any);
    } else {
      // Link googleId if missing
      if (!user.googleId && oauthUser.googleId) {
        await this.users.updateById(user._id, { googleId: oauthUser.googleId }).catch(() => {});
        user = await this.users.findByEmail(email);
      }
    }
    return user;
  }
}