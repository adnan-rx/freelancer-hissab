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

    console.log('[AUTH] Register - generating tokens for user:', user.id);
    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    console.log('[AUTH] Login attempt for email:', dto.email);
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    console.log('[AUTH] Login successful - generating tokens for user:', user.id);
    return this.generateTokens(user);
  }

  async refresh(dto: RefreshDto) {
    console.log('[AUTH] ===== REFRESH TOKEN REQUEST =====');
    console.log('[AUTH] Refresh token received (first 50 chars):', dto.refreshToken?.substring(0, 50) + '...');
    console.log('[AUTH] Refresh token length:', dto.refreshToken?.length);

    try {
      const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fh_dev_refresh_secret_key_2026_pk';
      console.log('[AUTH] Using refresh secret (first 10 chars):', refreshSecret.substring(0, 10) + '...');

      // First, decode WITHOUT verification to see the payload
      const decoded = this.jwtService.decode(dto.refreshToken);
      console.log('[AUTH] Decoded token (no verification):', JSON.stringify(decoded));
      if (decoded && typeof decoded === 'object' && decoded.exp) {
        const expDate = new Date(decoded.exp * 1000);
        const now = new Date();
        console.log('[AUTH] Token exp:', expDate.toISOString());
        console.log('[AUTH] Current time:', now.toISOString());
        console.log('[AUTH] Token expired?', now > expDate);
        console.log('[AUTH] Time until expiry (seconds):', decoded.exp - Math.floor(now.getTime() / 1000));
      }

      // Now verify with the refresh secret
      console.log('[AUTH] Attempting to verify refresh token with refresh secret...');
      const payload = this.jwtService.verify(dto.refreshToken, { secret: refreshSecret });
      console.log('[AUTH] ✅ Refresh token verification PASSED. Payload:', JSON.stringify(payload));

      const user = await this.usersService.findById(payload.sub);
      console.log('[AUTH] User lookup result:', user ? `Found user ${user.id}` : 'NOT FOUND');
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      console.log('[AUTH] Generating new token pair for user:', user.id);
      const result = await this.generateTokens(user);
      console.log('[AUTH] ✅ New tokens generated successfully');
      console.log('[AUTH] New access token (first 50 chars):', result.accessToken.substring(0, 50) + '...');
      console.log('[AUTH] New refresh token (first 50 chars):', result.refreshToken.substring(0, 50) + '...');
      console.log('[AUTH] ===== REFRESH TOKEN SUCCESS =====');
      return result;
    } catch (e: any) {
      console.error('[AUTH] ❌ REFRESH TOKEN FAILED');
      console.error('[AUTH] Error name:', e?.name);
      console.error('[AUTH] Error message:', e?.message);
      console.error('[AUTH] Full error:', e);

      // Try verifying with the ACCESS secret to check if it was signed with wrong secret
      try {
        const accessSecret = process.env.JWT_SECRET || 'fh_dev_access_secret_key_2026_pk';
        const testPayload = this.jwtService.verify(dto.refreshToken, { secret: accessSecret });
        console.error('[AUTH] ⚠️  TOKEN VERIFIES WITH ACCESS SECRET! This token was signed with the access secret, not the refresh secret.');
        console.error('[AUTH] ⚠️  This means the token was issued before the separate-secret fix was deployed. User needs to re-login.');
      } catch {
        console.error('[AUTH] Token also fails with access secret - token is fully invalid');
      }

      console.error('[AUTH] ===== REFRESH TOKEN FAILURE =====');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email };
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fh_dev_refresh_secret_key_2026_pk';
    const accessSecret = process.env.JWT_SECRET || 'fh_dev_access_secret_key_2026_pk';

    console.log('[AUTH] generateTokens() - access secret (first 10):', accessSecret.substring(0, 10) + '...');
    console.log('[AUTH] generateTokens() - refresh secret (first 10):', refreshSecret.substring(0, 10) + '...');
    console.log('[AUTH] generateTokens() - secrets are different?', accessSecret !== refreshSecret);
    
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '2m' }),
      this.jwtService.signAsync(payload, { expiresIn: '30d', secret: refreshSecret }),
    ]);

    // Decode to verify the tokens were signed correctly
    const decodedAccess = this.jwtService.decode(accessToken, { complete: false });
    const decodedRefresh = this.jwtService.decode(refreshToken, { complete: false });
    console.log('[AUTH] Decoded access token:', JSON.stringify(decodedAccess));
    console.log('[AUTH] Decoded refresh token:', JSON.stringify(decodedRefresh));

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

