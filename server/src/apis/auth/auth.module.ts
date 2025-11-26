import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { DataserviceModule } from '../../dataservice/dataservice.module';
import { ValidateKeysController } from './validate-keys.controller';
import { ValidateKeysService } from './validate-keys.service';

@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'stripe-connect-jwt-secret-2025',
            signOptions: { expiresIn: '24h' },
        }),
        DataserviceModule,
    ],
    controllers: [AuthController, ValidateKeysController],
    providers: [AuthService, JwtStrategy, ValidateKeysService],
    exports: [AuthService, JwtStrategy, PassportModule],
})
export class AuthModule {}

