import { Controller, Post, Get, Delete, Param, UseInterceptors, UploadedFile, Body, UseGuards } from '@nestjs/common';
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

  @Delete(':id')
  deleteDoc(@CurrentUser() user: any, @Param('id') documentId: string) {
    return this.evidenceService.deleteDocument(user.id, documentId);
  }
}
