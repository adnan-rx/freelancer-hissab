import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { users } from '../../database/schema';

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

  async create(data: { email: string; passwordHash: string; name: string; businessName?: string }) {
    const result = await this.db.insert(users).values({
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name,
      businessName: data.businessName || null,
      defaultCurrency: 'PKR',
    }).returning();
    return result[0];
  }
}
