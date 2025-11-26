import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Post('logout')
    async logout() {
        return {
            message: 'Logout successful',
            success: true,
        };
    }

    @Get('me')
    @UseGuards(AuthGuard('jwt'))
    async getMe(@Request() req) {
        return {
            authenticated: true,
            user: {
                id: req.user.id,
                stripeId: req.user.stripeId,
                username: req.user.username,
                email: req.user.email,
                name: req.user.name,
                isMaster: req.user.isMaster,
            },
        };
    }
}

