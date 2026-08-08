import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto, RefreshDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email address is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      businessName: dto.businessName,
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateTokens(user);
  }

  async refresh(dto: RefreshDto) {
    try {
      const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fh_dev_refresh_secret_key_2026_pk';
      const payload = this.jwtService.verify(dto.refreshToken, { secret: refreshSecret });
      
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens(user);
    } catch (e: any) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email };
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fh_dev_refresh_secret_key_2026_pk';
    
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '2m' }),
      this.jwtService.signAsync(payload, { expiresIn: '30d', secret: refreshSecret }),
    ]);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        businessName: user.businessName || '',
        defaultCurrency: user.defaultCurrency || 'PKR',
      },
    };
  }
}

