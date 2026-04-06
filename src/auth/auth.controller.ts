import { Controller, Post, UseGuards, Request, Get, Res, ForbiddenException, Query } from '@nestjs/common';
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
  async googleAuthRedirect(@Request() req, @Res() res: express.Response) {
    try {
      console.log('[auth.google.callback] user:', req.user);
      
      // Find or create user in database
      const user = await this.authService.findOrCreateUser(req.user);
      
      // Check if user exists
      if (!user) {
        throw new Error('Failed to create or find user');
      }
      
      // Generate JWT token
      const token = await this.authService.generateToken(user);
      
      // Set HTTP-only cookie for JWT guard extractor
      res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      
      // ✅ Send HTML that posts message and closes popup
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Login Success</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
              }
              .message {
                text-align: center;
                padding: 2rem;
              }
              .spinner {
                border: 3px solid rgba(255,255,255,0.3);
                border-top: 3px solid white;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 1rem;
              }
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            </style>
          </head>
          <body>
            <div class="message">
              <div class="spinner"></div>
              <p>Login successful! Redirecting...</p>
            </div>
            <script>
              (function() {
                try {
                  if (window.opener) {
                    window.opener.postMessage(
                      {
                        success: true,
                        user: {
                          name: ${JSON.stringify(user.name || '')},
                          email: ${JSON.stringify(user.email)},
                          picture: ${JSON.stringify(user.picture || '')},
                          roles: ${JSON.stringify((user as any).roles || ['user'])}
                        }
                      },
                      '${frontendUrl}'
                    );
                    setTimeout(() => window.close(), 500);
                  } else {
                    // Fallback if no opener (shouldn't happen with popup)
                    window.location.href = '${frontendUrl}/login?success=true&user=${encodeURIComponent(user.name || '')}&email=${encodeURIComponent(user.email)}&picture=${encodeURIComponent(user.picture || '')}&roles=${encodeURIComponent(JSON.stringify((user as any).roles || ['user']))}';
                  }
                } catch (error) {
                  console.error('Error posting message:', error);
                  window.location.href = '${frontendUrl}/login?success=true';
                }
              })();
            </script>
          </body>
        </html>
      `);
    
    } catch (error) {
      console.error('[auth.google.callback] error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Login Failed</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
              }
              .message {
                text-align: center;
                padding: 2rem;
              }
            </style>
          </head>
          <body>
            <div class="message">
              <p>❌ Authentication failed</p>
              <p style="font-size: 0.875rem; opacity: 0.8;">This window will close automatically...</p>
            </div>
            <script>
              (function() {
                try {
                  if (window.opener) {
                    window.opener.postMessage(
                      {
                        success: false,
                        error: 'Authentication failed'
                      },
                      '${frontendUrl}'
                    );
                    setTimeout(() => window.close(), 2000);
                  } else {
                    window.location.href = '${frontendUrl}/login?success=false&error=Authentication%20failed';
                  }
                } catch (error) {
                  console.error('Error posting message:', error);
                  window.location.href = '${frontendUrl}/login?success=false';
                }
              })();
            </script>
          </body>
        </html>
      `);
    }
  }

  @Get('test/admin-token')
  async getTestingAdminToken(@Query('email') email?: string, @Res({ passthrough: true }) res?: express.Response) {
    if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
      throw new ForbiddenException('This endpoint is disabled in production');
    }

    const token = this.authService.generateTestingAdminToken(email);

    res?.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      message: 'Testing admin JWT generated',
      token,
      usage: {
        authorizationHeader: `Bearer ${token}`,
        cookie: `jwt=${token}`,
      },
      roles: ['admin', 'super_admin'],
    };
  }
  
  @Get('me')
  @UseGuards(JwtAuthGuard) // Your JWT guard
  async getProfile(@Request() req) {
    const id = req.user?.id ?? req.user?.sub ?? req.user?.profile?._id;
    const user = await this.authService.findUserById(id);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return {
      user: {
        name: user.name,
        email: user.email,
        picture: user.picture,
        roles: (user as any).roles || [],
      },
    };
  }

  // เพิ่ม logout
  @Get('logout')
  async logout(@Res() res: express.Response) {
    console.log('[auth.logout] clearing jwt cookie');
    res.clearCookie('jwt');
    return { message: 'logged out' };
  }
}