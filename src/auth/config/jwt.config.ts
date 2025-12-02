import { registerAs } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt'

export default registerAs(
    'Jwt',
     (): JwtModuleOptions => ({
        secret: process.env.JWT_SECRET, 
        signOptions: {
            expiresIn: (process.env.JWT_EXPIRE_IN || '60s') as unknown as any, 
        },
    }),
)