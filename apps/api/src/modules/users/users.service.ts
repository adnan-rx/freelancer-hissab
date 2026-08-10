import { Injectable, Inject, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DRIZZLE } from '../../database/database.module';
import { users, refreshTokens } from '../../database/schema';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findByEmail(email: string) {
    const result = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] || null;
  }

  async findById(id: string) {
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] || null;
  }

  async getProfile(id: string) {
    return this.findById(id);
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundException('User account not found');
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.businessName !== undefined) updateData.businessName = dto.businessName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.bankName !== undefined) updateData.bankName = dto.bankName;
    if (dto.accountTitle !== undefined) updateData.accountTitle = dto.accountTitle;
    if (dto.iban !== undefined) updateData.iban = dto.iban;
    if (dto.psebId !== undefined) updateData.psebId = dto.psebId;
    if (dto.isFiler !== undefined) updateData.isFiler = dto.isFiler;
    if (dto.invoicePrefix !== undefined) updateData.invoicePrefix = dto.invoicePrefix;
    if (dto.paymentTerms !== undefined) updateData.paymentTerms = dto.paymentTerms;
    if (dto.invoiceNotes !== undefined) updateData.invoiceNotes = dto.invoiceNotes;

    const [updated] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    return updated;
  }

  /**
   * Verifies the current password before rotating the hash, then revokes every
   * refresh token so any other signed-in session is forced back to the login screen.
   */
  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    if (!user.passwordHash) {
      throw new BadRequestException('This account does not use password authentication');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isSame = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSame) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
    await this.db.update(refreshTokens).set({ isRevoked: true }).where(eq(refreshTokens.userId, id));

    return { success: true, message: 'Password updated. Please sign in again on your other devices.' };
  }

  async create(data: { email: string; passwordHash: string; name: string; businessName?: string }) {
    const result = await this.db.insert(users).values({
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      businessName: data.businessName || null,
      defaultCurrency: 'PKR',
      // Explicit rather than relying on the column's static DEFAULT
      // ('FH-2026-'), which would otherwise stamp every account created from
      // 2027 onward with an already-wrong prefix.
      invoicePrefix: `FH-${new Date().getFullYear()}-`,
    }).returning();
    return result[0];
  }
}
