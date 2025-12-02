import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserDataService } from '../../dataservice/user-data/user-data.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly userDataService: UserDataService,
        private readonly jwtService: JwtService,
    ) {}

    async login(loginDto: LoginDto) {
        const { username, password } = loginDto;

        const user = await this.userDataService.findUserByUsername(username);

        if (!user || !user.passwordHash) {
            throw new UnauthorizedException('Invalid username or password');
        }

        const isValid = await this.userDataService.validatePassword(
            password,
            user.passwordHash,
        );

        if (!isValid) {
            throw new UnauthorizedException('Invalid username or password');
        }

        const isMaster = user.stripeId && user.stripeId.startsWith('MASTER_ADMIN_');
        const payload = {
            id: user.id,
            stripeId: user.stripeId,
            username: user.username,
            email: user.email,
            name: user.name,
            isMaster,
        };

        const token = this.jwtService.sign(payload);

        return {
            message: 'Login successful',
            user: {
                id: user.id,
                stripeId: user.stripeId,
                username: user.username,
                email: user.email,
                name: user.name,
                isMaster,
            },
            token,
        };
    }

    async validateUser(payload: any) {
        const user = await this.userDataService.findUserById(payload.id);
        if (!user) {
            return null;
        }
        const isMaster = user.stripeId && user.stripeId.startsWith('MASTER_ADMIN_');
        return {
            id: user.id,
            stripeId: user.stripeId,
            username: user.username,
            email: user.email,
            name: user.name,
            isMaster,
        };
    }
}


