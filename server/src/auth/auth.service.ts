import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { Response } from 'express';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService
  ) {}

  async login(dto: LoginDto, response: Response) {
    const user = await this.usersService.findByUsernameWithPassword(dto.username);
    if (!user) throw new UnauthorizedException('Invalid username or password');

    const validPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!validPassword) throw new UnauthorizedException('Invalid username or password');

    this.setAuthCookie(response, user._id.toString(), user.username);
    return this.usersService.toResponse(user);
  }

  logout(response: Response) {
    response.clearCookie(this.config.getOrThrow<string>('COOKIE_NAME'), this.cookieOptions());
    return { ok: true };
  }

  private setAuthCookie(response: Response, userId: string, username: string) {
    const token = this.jwtService.sign({ sub: userId, username });
    response.cookie(this.config.getOrThrow<string>('COOKIE_NAME'), token, this.cookieOptions());
  }

  private cookieOptions() {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get<boolean>('COOKIE_SECURE') ?? isProduction,
      path: '/'
    };
  }
}
