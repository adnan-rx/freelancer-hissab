import { Controller, Post, Get, Delete, Param, UseInterceptors, UploadedFile, Body, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EvidenceService } from './evidence.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string,
    @Body('incomeId') incomeId?: string,
    @Body('expenseId') expenseId?: string,
    @Body('notes') notes?: string,
  ) {
    const userId = typeof user === 'string' ? user : (user?.id || user);
    return this.evidenceService.uploadFile(userId, file, documentType, incomeId, expenseId, notes);
  }

  @Get('income/:incomeId')
  getIncomeDocs(@CurrentUser() user: any, @Param('incomeId') incomeId: string) {
    const userId = typeof user === 'string' ? user : (user?.id || user);
    return this.evidenceService.getDocumentsForIncome(userId, incomeId);
  }

  @Get('expense/:expenseId')
  getExpenseDocs(@CurrentUser() user: any, @Param('expenseId') expenseId: string) {
    const userId = typeof user === 'string' ? user : (user?.id || user);
    return this.evidenceService.getDocumentsForExpense(userId, expenseId);
  }

  @Delete(':id')
  deleteDoc(@CurrentUser() user: any, @Param('id') documentId: string) {
    const userId = typeof user === 'string' ? user : (user?.id || user);
    return this.evidenceService.deleteDocument(userId, documentId);
  }
}
