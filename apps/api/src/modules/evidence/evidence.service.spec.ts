import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { DRIZZLE } from '../../database/database.module';
import { evidenceDocuments, income, expenses } from '../../database/schema';
import { createMockDb } from '../../common/testing/mock-db';

jest.mock('@vercel/blob', () => ({
  put: jest.fn(async (name: string) => ({ url: `https://blob.example/${name}` })),
  del: jest.fn(async () => undefined),
}));

const OWNER = 'user-1';
const OTHER = 'user-2';

function file(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    originalname: 'prc.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('pdf'),
    ...overrides,
  } as Express.Multer.File;
}

async function buildService(rows: Map<any, any[]>) {
  const db = createMockDb(rows);
  const module: TestingModule = await Test.createTestingModule({
    providers: [EvidenceService, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return { service: module.get<EvidenceService>(EvidenceService), db };
}

const ownedIncome = () => [{ id: 'inc-1', userId: OWNER }];

describe('EvidenceService', () => {
  describe('upload validation', () => {
    it('accepts a PDF attached to the caller’s own income record', async () => {
      const { service } = await buildService(
        new Map<any, any[]>([[income, ownedIncome()], [expenses, []], [evidenceDocuments, []]]),
      );

      const doc = await service.uploadFile(OWNER, file(), 'PRC', 'inc-1');
      expect(doc.fileName).toBe('prc.pdf');
      expect(doc.documentType).toBe('PRC');
    });

    // Regression: the advertised 5MB cap was not enforced anywhere.
    it('rejects a file over 5MB', async () => {
      const { service } = await buildService(
        new Map<any, any[]>([[income, ownedIncome()], [expenses, []], [evidenceDocuments, []]]),
      );

      const big = file({ size: 6 * 1024 * 1024 });
      await expect(service.uploadFile(OWNER, big, 'PRC', 'inc-1')).rejects.toThrow(BadRequestException);
    });

    // Regression: `accept` only filtered the file dialog; an .exe renamed to .pdf uploaded fine.
    it('rejects an executable renamed to look like a PDF', async () => {
      const { service } = await buildService(
        new Map<any, any[]>([[income, ownedIncome()], [expenses, []], [evidenceDocuments, []]]),
      );

      const disguised = file({ originalname: 'malware.pdf', mimetype: 'application/x-msdownload' });
      await expect(service.uploadFile(OWNER, disguised, 'PRC', 'inc-1')).rejects.toThrow(/PDF, JPG and PNG/);
    });

    it('rejects an empty file', async () => {
      const { service } = await buildService(
        new Map<any, any[]>([[income, ownedIncome()], [expenses, []], [evidenceDocuments, []]]),
      );

      await expect(service.uploadFile(OWNER, file({ size: 0 }), 'PRC', 'inc-1')).rejects.toThrow(BadRequestException);
    });

    it('requires a parent record', async () => {
      const { service } = await buildService(
        new Map<any, any[]>([[income, ownedIncome()], [expenses, []], [evidenceDocuments, []]]),
      );

      await expect(service.uploadFile(OWNER, file(), 'PRC')).rejects.toThrow(/income or expense/i);
    });

    it('refuses to attach a document to another user’s income record', async () => {
      const { service } = await buildService(
        new Map<any, any[]>([[income, ownedIncome()], [expenses, []], [evidenceDocuments, []]]),
      );

      await expect(service.uploadFile(OTHER, file(), 'PRC', 'inc-1')).rejects.toThrow(NotFoundException);
    });

    it('strips path separators from the stored filename', async () => {
      const { service } = await buildService(
        new Map<any, any[]>([[income, ownedIncome()], [expenses, []], [evidenceDocuments, []]]),
      );

      const doc = await service.uploadFile(OWNER, file({ originalname: '../../etc/passwd.pdf' }), 'PRC', 'inc-1');
      expect(doc.fileName).not.toContain('/');
    });

    it('rejects an unknown document type', async () => {
      const { service } = await buildService(
        new Map<any, any[]>([[income, ownedIncome()], [expenses, []], [evidenceDocuments, []]]),
      );

      await expect(service.uploadFile(OWNER, file(), 'SOMETHING_ELSE', 'inc-1')).rejects.toThrow(/documentType/);
    });
  });

  describe('access control', () => {
    // Regression: reads were filtered by record id only, so any signed-in user could
    // fetch another user's document metadata and public blob URL.
    it('does not return another user’s documents', async () => {
      const { service } = await buildService(
        new Map<any, any[]>([
          [income, ownedIncome()],
          [expenses, []],
          [evidenceDocuments, [{ id: 'doc-1', incomeId: 'inc-1', userId: OWNER, blobUrl: 'https://blob/x' }]],
        ]),
      );

      expect(await service.getDocumentsForIncome(OWNER, 'inc-1')).toHaveLength(1);
      expect(await service.getDocumentsForIncome(OTHER, 'inc-1')).toHaveLength(0);
    });

    it('refuses to delete a document owned by someone else', async () => {
      const { service } = await buildService(
        new Map<any, any[]>([
          [income, ownedIncome()],
          [expenses, []],
          [evidenceDocuments, [{ id: 'doc-1', incomeId: 'inc-1', userId: OWNER, blobUrl: 'https://blob/x' }]],
        ]),
      );

      await expect(service.deleteDocument(OTHER, 'doc-1')).rejects.toThrow(NotFoundException);
      await expect(service.deleteDocument(OWNER, 'doc-1')).resolves.toEqual({ success: true, id: 'doc-1' });
    });
  });
});
