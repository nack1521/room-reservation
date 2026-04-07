import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { Role } from './roles.enum';

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

  async findOrCreateUser(googleUser: any) {
    let user = await this.users.findByEmail(googleUser.email);
    
    if (!user) {
      user = await this.users.create({
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.googleId,
        picture: googleUser.picture,
      } as any);
    } else {
      // Update user info
      const userRoles = user.roles || [];
      const shouldNormalizeToStudent =
        this.users.isStudentEmail(googleUser.email) &&
        userRoles.length === 1 &&
        userRoles.includes(Role.USER);

      const updatePayload: any = {
        name: googleUser.name,
        picture: googleUser.picture,
      };
      if (!userRoles.length || shouldNormalizeToStudent) {
        updatePayload.roles = this.users.getDefaultRolesForEmail(googleUser.email);
      }

      await this.users.updateById(user._id.toString(), updatePayload);
      user = await this.users.findByEmail(googleUser.email);
    }
    
    return user;
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
      } as any);
    } else {
      const userRoles = user.roles || [];
      const shouldNormalizeToStudent =
        this.users.isStudentEmail(email) &&
        userRoles.length === 1 &&
        userRoles.includes(Role.USER);

      const updatePayload: any = {};
      // Link googleId if missing
      if (!user.googleId && oauthUser.googleId) {
        updatePayload.googleId = oauthUser.googleId;
      }
      if (!userRoles.length || shouldNormalizeToStudent) {
        updatePayload.roles = this.users.getDefaultRolesForEmail(email);
      }

      if (Object.keys(updatePayload).length) {
        await this.users.updateById(user._id.toString(), updatePayload).catch(() => {});
        user = await this.users.findByEmail(email);
      }
    }
    return user;
  }

  async generateToken(user: any) {
    const payload = { 
      sub: user._id || user.id, 
      email: user.email,
      name: user.name,
      roles: user.roles || [],
    };
    
    return this.jwtService.sign(payload);
  }

  generateTestingAdminToken(email = 'postman-admin@local.test') {
    const payload = {
      sub: 'postman-admin',
      email,
      name: 'Postman Admin',
      roles: [Role.ADMIN, Role.SUPER_ADMIN],
    };

    return this.jwtService.sign(payload);
  }

  async findUserById(userId: string) {
    return this.users.findById(userId);
  }
}