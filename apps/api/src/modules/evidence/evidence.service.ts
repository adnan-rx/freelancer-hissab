import { Injectable, Inject } from '@nestjs/common';
import { put, del } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { evidenceDocuments } from '../../database/schema';

@Injectable()
export class EvidenceService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  async uploadFile(
    userId: string, 
    file: Express.Multer.File, 
    documentType: string, 
    incomeId?: string, 
    expenseId?: string, 
    notes?: string
  ) {
    const filename = `${userId}/${Date.now()}-${file.originalname}`;
    
    // Upload to Vercel Blob
    const blob = await put(filename, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
    });

    // Save to DB
    const [doc] = await this.db.insert(evidenceDocuments).values({
      userId,
      incomeId: incomeId || null,
      expenseId: expenseId || null,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      blobUrl: blob.url,
      documentType,
      notes
    }).returning();

    return doc;
  }

  async getDocumentsForIncome(userId: string, incomeId: string) {
    return this.db.select().from(evidenceDocuments).where(eq(evidenceDocuments.incomeId, incomeId));
  }

  async getDocumentsForExpense(userId: string, expenseId: string) {
    return this.db.select().from(evidenceDocuments).where(eq(evidenceDocuments.expenseId, expenseId));
  }

  async deleteDocument(userId: string, documentId: string) {
    const [doc] = await this.db.select().from(evidenceDocuments).where(eq(evidenceDocuments.id, documentId)).limit(1);
    if (!doc || doc.userId !== userId) throw new Error("Document not found");

    await del(doc.blobUrl);
    await this.db.delete(evidenceDocuments).where(eq(evidenceDocuments.id, documentId));
    return { success: true };
  }
}
