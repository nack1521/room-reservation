import { Controller, Post, UseGuards, Request, Get, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from 'src/user/user.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import * as express from 'express';


@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async profile(@Request() req) {
    // debug logs
    console.log('[auth.profile] headers:', req.headers);
    console.log('[auth.profile] cookies:', req.cookies);
    console.log('[auth.profile] req.user:', req.user);

    // fetch fresh user from DB
    const id = req.user?.id ?? req.user?.sub ?? req.user?.profile?._id;
    console.log('[auth.profile] resolved user id:', id);
    return this.userService.findById(id);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth(@Request() req) {
    // Initiates the Google OAuth process
    console.log('[auth.google] initiating google oauth, headers:', req.headers);
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Request() req, @Res({ passthrough: true }) res: express.Response) {
    try {
      console.log('[auth.google.callback] req.user (from strategy):', req.user);
      const user = await this.authService.validateOAuthLogin(req.user);
      console.log('[auth.google.callback] upserted user:', user);
      const tokens = await this.authService.login(user); // { access_token: '...' }
      console.log('[auth.google.callback] tokens:', tokens);

      res.cookie('jwt', tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });

      // return token JSON so Postman can read it too
      return { user, tokens };
    } catch (err) {
      console.error('[auth.google.callback] error:', err);
      throw err;
    }
  }

  // เพิ่ม logout
  @Get('logout')
  async logout(@Res() res: express.Response) {
    console.log('[auth.logout] clearing jwt cookie');
    res.clearCookie('jwt');
    return { message: 'logged out' };
  }
}