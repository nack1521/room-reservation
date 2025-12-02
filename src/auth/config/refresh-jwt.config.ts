import { registerAs } from '@nestjs/config';

export default registerAs('refreshJwt', () => ({
  secret: process.env.REFRESH_JWT_SECRET,
  expiresIn: process.env.REFRESH_JWT_EXPIRATION || '7d',
}));