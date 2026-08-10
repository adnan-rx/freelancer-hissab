import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { put, del, get } from '@vercel/blob';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { evidenceDocuments, income, expenses } from '../../database/schema';

export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024; // 5MB — matches the limit shown in the UI
export const ALLOWED_EVIDENCE_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const ALLOWED_EVIDENCE_EXT = ['.pdf', '.jpg', '.jpeg', '.png'];
const ALLOWED_DOCUMENT_TYPES = ['PRC', 'INVOICE', 'RECEIPT', 'BANK_STATEMENT', 'OTHER'];

@Injectable()
export class EvidenceService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /** Confirms the parent record exists *and* belongs to this user before attaching anything. */
  private async assertOwnsParent(userId: string, incomeId?: string, expenseId?: string) {
    if (!incomeId && !expenseId) {
      throw new BadRequestException('A document must be linked to an income or expense record');
    }
    if (incomeId && expenseId) {
      throw new BadRequestException('A document cannot be linked to both an income and an expense record');
    }

    if (incomeId) {
      const [row] = await this.db
        .select({ id: income.id })
        .from(income)
        .where(and(eq(income.id, incomeId), eq(income.userId, userId)))
        .limit(1);
      if (!row) throw new NotFoundException('Income record not found');
    }

    if (expenseId) {
      const [row] = await this.db
        .select({ id: expenses.id })
        .from(expenses)
        .where(and(eq(expenses.id, expenseId), eq(expenses.userId, userId)))
        .limit(1);
      if (!row) throw new NotFoundException('Expense record not found');
    }
  }

  private validateFile(file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file was uploaded');
    }
    if (file.size === 0) {
      throw new BadRequestException('The uploaded file is empty');
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      throw new BadRequestException(
        `File is ${(file.size / 1024 / 1024).toFixed(1)}MB. The maximum supported size is 5MB.`,
      );
    }

    const extension = (file.originalname.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
    const mimeOk = ALLOWED_EVIDENCE_MIME.includes(file.mimetype);
    const extOk = ALLOWED_EVIDENCE_EXT.includes(extension);

    // Both must agree — an .exe renamed to .pdf fails the MIME check, and a PDF
    // uploaded with a bogus extension fails the extension check.
    if (!mimeOk || !extOk) {
      throw new BadRequestException('Only PDF, JPG and PNG files are supported');
    }
  }

  async uploadFile(
    userId: string,
    file: Express.Multer.File,
    documentType: string,
    incomeId?: string,
    expenseId?: string,
    notes?: string,
  ) {
    this.validateFile(file);
    await this.assertOwnsParent(userId, incomeId, expenseId);

    const type = (documentType || 'OTHER').toUpperCase();
    if (!ALLOWED_DOCUMENT_TYPES.includes(type)) {
      throw new BadRequestException(`documentType must be one of: ${ALLOWED_DOCUMENT_TYPES.join(', ')}`);
    }

    // Strip path separators from the client-supplied filename before it reaches the blob key.
    const safeName = file.originalname.replace(/[/\\]/g, '_').slice(0, 200);
    const filename = `${userId}/${Date.now()}-${safeName}`;

    // Private, not public. These are PRCs, bank statements and receipts — a
    // public URL is readable forever by anyone it leaks to, with no revocation.
    // Content is served through `GET /evidence/:id/download`, which authenticates
    // and re-checks ownership on every read.
    const blob = await put(filename, file.buffer, {
      access: 'private',
      contentType: file.mimetype,
      addRandomSuffix: true,
    });

    const [doc] = await this.db
      .insert(evidenceDocuments)
      .values({
        userId,
        incomeId: incomeId || null,
        expenseId: expenseId || null,
        fileName: safeName,
        fileType: file.mimetype,
        fileSize: file.size,
        blobUrl: blob.url,
        documentType: type,
        notes,
      })
      .returning();

    return doc;
  }

  async getDocumentsForIncome(userId: string, incomeId: string) {
    // Scoped by userId as well as incomeId — an id alone must never expose another user's documents.
    return this.db
      .select()
      .from(evidenceDocuments)
      .where(and(eq(evidenceDocuments.incomeId, incomeId), eq(evidenceDocuments.userId, userId)));
  }

  async getDocumentsForExpense(userId: string, expenseId: string) {
    return this.db
      .select()
      .from(evidenceDocuments)
      .where(and(eq(evidenceDocuments.expenseId, expenseId), eq(evidenceDocuments.userId, userId)));
  }

  /** Ownership-checked read of a private blob, for the authenticated download route. */
  async getDocumentContent(userId: string, documentId: string) {
    const [doc] = await this.db
      .select()
      .from(evidenceDocuments)
      .where(and(eq(evidenceDocuments.id, documentId), eq(evidenceDocuments.userId, userId)))
      .limit(1);

    if (!doc) throw new NotFoundException('Document not found');

    const result = await get(doc.blobUrl, { access: 'private' });
    if (!result) throw new NotFoundException('Document content is no longer available');

    return { doc, stream: result.stream };
  }

  async deleteDocument(userId: string, documentId: string) {
    const [doc] = await this.db
      .select()
      .from(evidenceDocuments)
      .where(and(eq(evidenceDocuments.id, documentId), eq(evidenceDocuments.userId, userId)))
      .limit(1);

    if (!doc) throw new NotFoundException('Document not found');

    try {
      await del(doc.blobUrl);
    } catch {
      // The database row is the source of truth; a missing blob must not block cleanup.
    }

    await this.db.delete(evidenceDocuments).where(eq(evidenceDocuments.id, documentId));
    return { success: true, id: documentId };
  }
}
