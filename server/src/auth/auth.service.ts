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
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '7d';
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get<boolean>('COOKIE_SECURE') ?? isProduction,
      path: '/',
      maxAge: this.parseExpiry(expiresIn)
    };
  }

  private parseExpiry(expiresIn: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const ms = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
    return value * ms;
  }
}
