import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { eq, and, or, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { invoices, invoiceItems, clients, users } from '../../database/schema';
import { CreateInvoiceDto } from './dto/invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async findAll(userId: string, query?: { status?: string; clientId?: string; search?: string }) {
    let whereClause: any = eq(invoices.userId, userId);

    if (query?.status) {
      whereClause = and(whereClause, eq(invoices.status, query.status as any));
    }
    if (query?.clientId) {
      whereClause = and(whereClause, eq(invoices.clientId, query.clientId));
    }
    if (query?.search) {
      // Match on invoice number or client name — the UI offers both.
      const term = `%${query.search}%`;
      whereClause = and(whereClause, or(ilike(invoices.invoiceNumber, term), ilike(clients.name, term)));
    }

    const result = await this.db
      .select({
        invoice: invoices,
        client: clients,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(whereClause);

    return result.map((r: any) => ({ ...r.invoice, client: r.client }));
  }

  async findOne(userId: string, id: string) {
    const invoiceResult = await this.db
      .select({
        invoice: invoices,
        client: clients,
      })
      .from(invoices)
      .leftJoin(clients, eq(invoices.clientId, clients.id))
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .limit(1);

    if (!invoiceResult.length) {
      throw new NotFoundException('Invoice not found');
    }

    const items = await this.db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));

    return { ...invoiceResult[0].invoice, client: invoiceResult[0].client, items };
  }

  async create(userId: string, dto: CreateInvoiceDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('An invoice must contain at least one line item');
    }

    let targetClientId = dto.clientId;

    if (!targetClientId || typeof targetClientId !== 'string' || targetClientId.length !== 36) {
      const clientName = dto.clientName || 'Direct Client';
      const existingClient = await this.db
        .select()
        .from(clients)
        .where(and(eq(clients.userId, userId), eq(clients.name, clientName)))
        .limit(1);

      if (existingClient.length > 0) {
        targetClientId = existingClient[0].id;
      } else {
        const [newClient] = await this.db
          .insert(clients)
          .values({
            userId,
            name: clientName,
            email: dto.clientEmail || null,
            platform: 'direct',
            currency: dto.currency || 'USD',
          })
          .returning();
        targetClientId = newClient.id;
      }
    }

    const existingNumbers = await this.db
      .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(eq(invoices.userId, userId));

    let invoiceNumber = dto.invoiceNumber?.trim();

    if (invoiceNumber) {
      // The DB has a unique (invoice_number, user_id) index; surface a readable
      // conflict instead of letting the raw constraint error escape as a 500.
      if (existingNumbers.some((inv: any) => inv.invoiceNumber === invoiceNumber)) {
        throw new ConflictException(`Invoice number "${invoiceNumber}" already exists. Choose a different number.`);
      }
    } else {
      // Honour the prefix the user configured in Settings.
      const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
      const prefix = user?.invoicePrefix || `FH-${new Date().getFullYear()}-`;
      const taken = new Set(existingNumbers.map((inv: any) => inv.invoiceNumber));
      let sequence = existingNumbers.length + 1;
      do {
        invoiceNumber = `${prefix}${sequence.toString().padStart(4, '0')}`;
        sequence++;
      } while (taken.has(invoiceNumber));
    }

    let subtotal = 0;
    dto.items.forEach((item) => {
      subtotal += item.quantity * item.rate;
    });

    const taxAmount = subtotal * ((dto.taxRate || 0) / 100);
    const total = subtotal + taxAmount - (dto.discountAmount || 0);

    if (total < 0) {
      throw new BadRequestException('Invoice total cannot be negative — check the discount amount');
    }

    const exchangeRate = dto.exchangeRate || 280;
    const totalPKR = total * exchangeRate;

    const [invoice] = await this.db.insert(invoices).values({
      userId,
      clientId: targetClientId,
      invoiceNumber,
      dueDate: dto.dueDate ? (typeof dto.dueDate === 'string' ? dto.dueDate : (dto.dueDate as any).toISOString().split('T')[0]) : null,
      currency: dto.currency,
      exchangeRate: exchangeRate.toString(),
      subtotal: subtotal.toString(),
      taxRate: (dto.taxRate || 0).toString(),
      taxAmount: taxAmount.toString(),
      discountAmount: (dto.discountAmount || 0).toString(),
      total: total.toString(),
      totalPKR: totalPKR.toString(),
      notes: dto.notes,
      status: 'sent',
    }).returning();

    if (dto.items && dto.items.length > 0) {
      const itemsToInsert = dto.items.map((item) => ({
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity.toString(),
        rate: item.rate.toString(),
        amount: (item.quantity * item.rate).toString(),
      }));
      await this.db.insert(invoiceItems).values(itemsToInsert);
    }

    return invoice;
  }

  async updateStatus(userId: string, id: string, status: string) {
    const result = await this.db
      .update(invoices)
      .set({ status: status as any, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .returning();

    if (!result.length) {
      throw new NotFoundException('Invoice not found');
    }
    return result[0];
  }

  async delete(userId: string, id: string) {
    await this.db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    
    const result = await this.db
      .delete(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .returning();

    if (!result.length) {
      throw new NotFoundException('Invoice not found');
    }
    return result[0];
  }
}
