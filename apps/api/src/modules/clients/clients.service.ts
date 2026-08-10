import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { eq, and, or, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { clients, income, invoices } from '../../database/schema';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findAll(userId: string, query?: { search?: string; status?: string; platform?: string }) {
    let whereClause: any = eq(clients.userId, userId);

    if (query?.search) {
      // Search every field the UI claims to search, otherwise the client-side
      // filter never sees rows the server already excluded.
      const term = `%${query.search}%`;
      whereClause = and(
        whereClause,
        or(ilike(clients.name, term), ilike(clients.email, term), ilike(clients.company, term)),
      );
    }
    if (query?.status) {
      whereClause = and(whereClause, eq(clients.status, query.status as any));
    }
    if (query?.platform) {
      whereClause = and(whereClause, eq(clients.platform, query.platform as any));
    }

    const clientList = await this.db.select().from(clients).where(whereClause);
    const userIncomes = await this.db.select().from(income).where(eq(income.userId, userId));
    const userInvoices = await this.db.select().from(invoices).where(eq(invoices.userId, userId));

    return clientList.map((client: any) => {
      const clientIncomes = userIncomes.filter((inc: any) => inc.clientId === client.id);
      const clientInvoices = userInvoices.filter((inv: any) => inv.clientId === client.id);

      const incomeUSD = clientIncomes.reduce((sum: number, inc: any) => sum + Number(inc.amount || 0), 0);
      const invoiceUSD = clientInvoices.reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0);

      const incomePKR = clientIncomes.reduce((sum: number, inc: any) => sum + Number(inc.amountPKR || (Number(inc.amount || 0) * 280.50)), 0);
      const invoicePKR = clientInvoices.reduce((sum: number, inv: any) => sum + Number(inv.totalPKR || 0), 0);

      const totalEarnings = incomeUSD > 0 ? incomeUSD : invoiceUSD;
      const totalEarningsPKR = incomePKR > 0 ? incomePKR : invoicePKR;

      return {
        ...client,
        totalEarnings,
        totalEarningsPKR,
        totalIncome: totalEarnings,
      };
    });
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

    const incomeRecords = await this.db
      .select()
      .from(income)
      .where(and(eq(income.clientId, id), eq(income.userId, userId)));

    const totalIncome = incomeRecords.reduce((sum: number, record: any) => {
      return sum + Number(record.amount || 0);
    }, 0);

    return { ...client, totalIncome, totalEarnings: totalIncome };
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

  /**
   * Deleting a client cascades to their invoices (FK) and orphans their income rows.
   * That is destructive and used to happen silently, so the first call reports what
   * would be lost and refuses; the caller must repeat with `force` to proceed.
   */
  async delete(userId: string, id: string, force = false) {
    const client = await this.findOne(userId, id);

    // Counted WITHOUT the userId scope on purpose: the FK cascades, so the true
    // blast radius is every referencing row, not just this user's. Scoping it
    // reported "0 invoices" while the delete removed rows created before
    // cross-tenant references were blocked at write time.
    const relatedInvoices = await this.db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.clientId, id));

    const relatedIncome = await this.db
      .select({ id: income.id })
      .from(income)
      .where(eq(income.clientId, id));

    if (!force && (relatedInvoices.length > 0 || relatedIncome.length > 0)) {
      throw new ConflictException({
        message:
          `"${client.name}" has ${relatedInvoices.length} invoice(s) and ${relatedIncome.length} income record(s). ` +
          `Deleting the client will permanently delete those invoices; income records will be kept but unlinked.`,
        code: 'CLIENT_HAS_RELATED_RECORDS',
        invoiceCount: relatedInvoices.length,
        incomeCount: relatedIncome.length,
        requiresForce: true,
      });
    }

    const result = await this.db
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .returning();

    if (!result.length) {
      throw new NotFoundException('Client not found');
    }
    return { ...result[0], deletedInvoiceCount: relatedInvoices.length, unlinkedIncomeCount: relatedIncome.length };
  }
}
