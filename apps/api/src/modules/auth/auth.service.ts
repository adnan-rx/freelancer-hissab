import { ConflictException, Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { DRIZZLE } from '../../database/database.module';
import { refreshTokens } from '../../database/schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject(DRIZZLE) private readonly db: any,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

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

  /**
   * Revokes the presented refresh token so the session is genuinely over.
   * Logout previously only cleared the cookie, leaving the token valid in the
   * database for its full 7-day life — anyone holding a copy could refresh.
   */
  async logout(refreshTokenStr?: string) {
    if (!refreshTokenStr) return { message: 'Logged out successfully' };

    await this.db
      .update(refreshTokens)
      .set({ isRevoked: true, updatedAt: new Date() })
      .where(eq(refreshTokens.hashedToken, this.hashToken(refreshTokenStr)));

    return { message: 'Logged out successfully' };
  }

  async refresh(refreshTokenStr: string) {
    try {
      const refreshSecret = process.env.JWT_REFRESH_SECRET as string;
      const payload = this.jwtService.verify(refreshTokenStr, { secret: refreshSecret });
      
      const hashedToken = this.hashToken(refreshTokenStr);
      const [storedToken] = await this.db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.hashedToken, hashedToken))
        .limit(1);

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (storedToken.isRevoked) {
        // Token reuse detected! Revoke all tokens for this user
        await this.db
          .update(refreshTokens)
          .set({ isRevoked: true })
          .where(eq(refreshTokens.userId, payload.sub));
        throw new UnauthorizedException('Token reuse detected');
      }

      if (new Date() > storedToken.expiresAt) {
        throw new UnauthorizedException('Refresh token expired');
      }
      
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Mark the old token as revoked
      await this.db
        .update(refreshTokens)
        .set({ isRevoked: true })
        .where(eq(refreshTokens.id, storedToken.id));

      return this.generateTokens(user);
    } catch (e: any) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email };
    // Validated at boot (see main.ts) — no committed development fallback.
    const refreshSecret = process.env.JWT_REFRESH_SECRET as string;
    
    const [accessToken, refreshTokenStr] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: (process.env.JWT_EXPIRATION || '15m') as any }),
      this.jwtService.signAsync(payload, { expiresIn: (process.env.JWT_REFRESH_EXPIRATION || '7d') as any, secret: refreshSecret }),
    ]);

    const hashedToken = this.hashToken(refreshTokenStr);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.db.insert(refreshTokens).values({
      userId: user.id,
      hashedToken,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: refreshTokenStr,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        businessName: user.businessName || '',
        defaultCurrency: user.defaultCurrency || 'PKR',
        psebId: user.psebId || null,
        // Drives the "Personal Information" step of the filing wizard.
        hasPseb: !!user.psebId,
        isFiler: user.isFiler ?? true,
        isAdmin: user.isAdmin ?? false,
      },
    };
  }
}


