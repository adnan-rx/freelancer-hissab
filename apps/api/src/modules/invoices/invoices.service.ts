import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { eq, and, or, ilike } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { invoices, invoiceItems, clients, users } from '../../database/schema';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';

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

    const items = await this.db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id))
      .orderBy(invoiceItems.sortOrder);

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
      if (Number(item.quantity) <= 0) {
        throw new BadRequestException('Item quantity must be greater than zero');
      }
      if (Number(item.rate) < 0) {
        throw new BadRequestException('Item rate cannot be negative');
      }
      subtotal += Number(item.quantity) * Number(item.rate);
    });

    const taxAmount = subtotal * ((dto.taxRate || 0) / 100);
    const total = subtotal + taxAmount - (dto.discountAmount || 0);

    if (total < 0) {
      throw new BadRequestException('Invoice total cannot be negative — check the discount amount');
    }

    const exchangeRate = dto.exchangeRate || 280;
    const totalPKR = total * exchangeRate;
    const initialStatus = dto.status === 'draft' ? 'draft' : 'sent';

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
      status: initialStatus,
    }).returning();

    if (dto.items && dto.items.length > 0) {
      const itemsToInsert = dto.items.map((item, idx) => ({
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity.toString(),
        rate: item.rate.toString(),
        amount: (Number(item.quantity) * Number(item.rate)).toString(),
        sortOrder: idx,
      }));
      await this.db.insert(invoiceItems).values(itemsToInsert);
    }

    return this.findOne(userId, invoice.id);
  }

  async update(userId: string, id: string, dto: UpdateInvoiceDto) {
    const existing = await this.findOne(userId, id);

    if (existing.status === 'paid') {
      throw new BadRequestException('Paid invoices are legally locked to maintain tax compliance & PRC audit records and cannot be edited.');
    }

    if (existing.status === 'cancelled') {
      throw new BadRequestException('Cancelled invoices are archived for audit trail purposes and cannot be edited.');
    }

    const isDraft = existing.status === 'draft';

    let targetClientId = existing.clientId;
    if (isDraft && dto.clientId && dto.clientId !== existing.clientId) {
      targetClientId = dto.clientId;
    }

    let invoiceNumber = existing.invoiceNumber;
    if (isDraft && dto.invoiceNumber && dto.invoiceNumber.trim() !== existing.invoiceNumber) {
      const trimmed = dto.invoiceNumber.trim();
      const existingWithSameNumber = await this.db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.userId, userId), eq(invoices.invoiceNumber, trimmed)))
        .limit(1);

      if (existingWithSameNumber.length > 0 && existingWithSameNumber[0].id !== id) {
        throw new ConflictException(`Invoice number "${trimmed}" already exists. Choose a different number.`);
      }
      invoiceNumber = trimmed;
    }

    const currency = dto.currency || existing.currency || 'USD';
    const exchangeRate = dto.exchangeRate !== undefined ? Number(dto.exchangeRate) : Number(existing.exchangeRate || 1);
    const taxRate = dto.taxRate !== undefined ? Number(dto.taxRate) : Number(existing.taxRate || 0);
    const discountAmount = dto.discountAmount !== undefined ? Number(dto.discountAmount) : Number(existing.discountAmount || 0);
    const dueDate = dto.dueDate !== undefined
      ? (dto.dueDate ? (typeof dto.dueDate === 'string' ? dto.dueDate : (dto.dueDate as any).toISOString().split('T')[0]) : null)
      : (existing.dueDate || null);
    const notes = dto.notes !== undefined ? dto.notes : existing.notes;

    // Status transition rules
    let newStatus = existing.status;
    if (dto.status) {
      if (dto.status === 'paid') {
        throw new BadRequestException('Use the status update endpoint or record income remittance to mark an invoice as paid.');
      }
      if (!isDraft && dto.status === 'draft') {
        throw new BadRequestException('Issued invoices cannot be reverted to draft status.');
      }
      newStatus = dto.status as any;
    }

    // Line items & recalculation
    if (dto.items && dto.items.length === 0) {
      throw new BadRequestException('An invoice must contain at least one line item');
    }

    const itemsToProcess: Array<{ description: string; quantity: number; rate: number }> =
      dto.items && dto.items.length > 0
        ? dto.items.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity),
            rate: Number(it.rate),
          }))
        : (existing.items || []).map((it: any) => ({
            description: it.description,
            quantity: Number(it.quantity),
            rate: Number(it.rate),
          }));

    if (itemsToProcess.length === 0) {
      throw new BadRequestException('An invoice must contain at least one line item');
    }

    let subtotal = 0;
    itemsToProcess.forEach((item) => {
      if (Number(item.quantity) <= 0) {
        throw new BadRequestException('Item quantity must be greater than zero');
      }
      if (Number(item.rate) < 0) {
        throw new BadRequestException('Item rate cannot be negative');
      }
      subtotal += Number(item.quantity) * Number(item.rate);
    });

    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount - discountAmount;

    if (total < 0) {
      throw new BadRequestException('Invoice total cannot be negative — check the discount amount');
    }

    const totalPKR = total * exchangeRate;

    await this.db
      .update(invoices)
      .set({
        clientId: targetClientId,
        invoiceNumber,
        dueDate,
        currency,
        exchangeRate: exchangeRate.toString(),
        subtotal: subtotal.toString(),
        taxRate: taxRate.toString(),
        taxAmount: taxAmount.toString(),
        discountAmount: discountAmount.toString(),
        total: total.toString(),
        totalPKR: totalPKR.toString(),
        status: newStatus,
        notes,
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));

    if (dto.items && dto.items.length > 0) {
      await this.db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      const itemsToInsert = dto.items.map((item, idx) => ({
        invoiceId: id,
        description: item.description,
        quantity: item.quantity.toString(),
        rate: item.rate.toString(),
        amount: (Number(item.quantity) * Number(item.rate)).toString(),
        sortOrder: idx,
      }));
      await this.db.insert(invoiceItems).values(itemsToInsert);
    }

    return this.findOne(userId, id);
  }

  async updateStatus(userId: string, id: string, status: string) {
    const updateData: Record<string, any> = { status: status as any, updatedAt: new Date() };
    if (status === 'paid') {
      updateData.paidAt = new Date();
    }

    const result = await this.db
      .update(invoices)
      .set(updateData)
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

