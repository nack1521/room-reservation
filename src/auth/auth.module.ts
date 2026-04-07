import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../user/schemas/user.schema';
import { AuthService } from './auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import jwtConfig from './config/jwt.config';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';

@Module({
  imports: [
    UserModule,
    // make the User model provider available in this module
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
    PassportModule.register({ session: false }),
    ConfigModule.forFeature(jwtConfig),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService): Promise<import('@nestjs/jwt').JwtModuleOptions> => ({
        secret: configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET,
        signOptions: { expiresIn: (configService.get<string>('JWT_EXPIRE_IN') || process.env.JWT_EXPIRE_IN || '60m') as unknown as any },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, GoogleStrategy, LocalAuthGuard, JwtAuthGuard, GoogleAuthGuard],
  exports: [
    PassportModule,
    JwtModule,
    AuthService,
  ],
})
export class AuthModule {}
