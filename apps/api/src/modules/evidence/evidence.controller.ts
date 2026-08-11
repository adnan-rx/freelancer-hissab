import { Controller, Post, Get, Delete, Param, UseInterceptors, UploadedFile, Body, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'stream';
import { FileInterceptor } from '@nestjs/platform-express';
import { EvidenceService, MAX_EVIDENCE_BYTES } from './evidence.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post('upload')
  // Multer rejects oversized files before they are buffered into memory;
  // EvidenceService re-checks size and type so the API is safe on its own.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_EVIDENCE_BYTES, files: 1 } }))
  uploadFile(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string,
    @Body('incomeId') incomeId?: string,
    @Body('expenseId') expenseId?: string,
    @Body('notes') notes?: string,
  ) {
    return this.evidenceService.uploadFile(user.id, file, documentType, incomeId, expenseId, notes);
  }

  @Get('income/:incomeId')
  getIncomeDocs(@CurrentUser() user: any, @Param('incomeId') incomeId: string) {
    return this.evidenceService.getDocumentsForIncome(user.id, incomeId);
  }

  @Get('expense/:expenseId')
  getExpenseDocs(@CurrentUser() user: any, @Param('expenseId') expenseId: string) {
    return this.evidenceService.getDocumentsForExpense(user.id, expenseId);
  }

  /**
   * Streams a private blob after re-checking ownership. Bypasses the global
   * response envelope (`@Res` without passthrough) because the body is a file.
   */
  @Get(':id/download')
  async download(@CurrentUser() user: any, @Param('id') documentId: string, @Res() res: Response) {
    const { doc, stream } = await this.evidenceService.getDocumentContent(user.id, documentId);

    res.setHeader('Content-Type', doc.fileType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
    res.setHeader('Cache-Control', 'private, no-store');

    Readable.fromWeb(stream as any).pipe(res);
  }

  @Delete(':id')
  deleteDoc(@CurrentUser() user: any, @Param('id') documentId: string) {
    return this.evidenceService.deleteDocument(user.id, documentId);
  }
}
