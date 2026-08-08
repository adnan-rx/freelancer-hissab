import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { invoices, invoiceItems, clients } from '../../database/schema';
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
      whereClause = and(whereClause, ilike(invoices.invoiceNumber, `%${query.search}%`));
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

    let invoiceNumber = dto.invoiceNumber;
    if (!invoiceNumber) {
      const countResult = await this.db.select({ id: invoices.id }).from(invoices).where(eq(invoices.userId, userId));
      invoiceNumber = `FH-2026-${(countResult.length + 1).toString().padStart(4, '0')}`;
    }

    let subtotal = 0;
    dto.items.forEach((item) => {
      subtotal += item.quantity * item.rate;
    });

    const taxAmount = subtotal * ((dto.taxRate || 0) / 100);
    const total = subtotal + taxAmount - (dto.discountAmount || 0);
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
