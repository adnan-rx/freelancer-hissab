import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { clients, income } from '../../database/schema';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findAll(userId: string, query?: { search?: string; status?: string; platform?: string }) {
    let whereClause: any = eq(clients.userId, userId);

    if (query?.search) {
      whereClause = and(whereClause, ilike(clients.name, `%${query.search}%`));
    }
    if (query?.status) {
      whereClause = and(whereClause, eq(clients.status, query.status as any));
    }
    if (query?.platform) {
      whereClause = and(whereClause, eq(clients.platform, query.platform as any));
    }

    return this.db.select().from(clients).where(whereClause);
  }

  async findOne(userId: string, id: string) {
    const clientResult = await this.db
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .limit(1);

    if (!clientResult.length) {
      throw new NotFoundException('Client not found');
    }

    const client = clientResult[0];

    // Calculate total income
    const incomeRecords = await this.db
      .select()
      .from(income)
      .where(and(eq(income.clientId, id), eq(income.userId, userId)));

    const totalIncome = incomeRecords.reduce((sum: number, record: any) => {
      return sum + Number(record.amount || 0);
    }, 0);

    return { ...client, totalIncome };
  }

  async create(userId: string, dto: CreateClientDto) {
    const result = await this.db.insert(clients).values({ ...dto, userId, platform: dto.platform as any }).returning();
    return result[0];
  }

  async update(userId: string, id: string, dto: UpdateClientDto) {
    const updateData: any = { ...dto, updatedAt: new Date() };
    if (dto.platform) updateData.platform = dto.platform as any;
    if (dto.status) updateData.status = dto.status as any;

    const result = await this.db
      .update(clients)
      .set(updateData)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .returning();

    if (!result.length) {
      throw new NotFoundException('Client not found');
    }
    return result[0];
  }

  async delete(userId: string, id: string) {
    const result = await this.db
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .returning();

    if (!result.length) {
      throw new NotFoundException('Client not found');
    }
    return result[0];
  }
}
