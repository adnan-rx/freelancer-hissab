import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CsvService, MAX_CSV_BYTES } from './csv.service';
import { ImportCsvDto } from './dto/import-csv.dto';

@Controller('csv')
@UseGuards(JwtAuthGuard)
export class CsvController {
  constructor(private readonly csvService: CsvService) {}

  @Post('import')
  // The 5MB cap used to exist only in the browser modal, so it was trivially
  // bypassed by posting to the API directly.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_CSV_BYTES, files: 1 } }))
  async importCSV(
    @CurrentUser() user: any,
    @Body() dto: ImportCsvDto,
    @UploadedFile() file?: any,
  ) {
    const userId = typeof user === 'string' ? user : (user?.id || user);
    if (!userId || typeof userId !== 'string') {
      throw new BadRequestException('Invalid user identification token.');
    }

    let buffer: Buffer;

    if (file && file.buffer) {
      buffer = file.buffer;
    } else if (dto?.csvText && dto.csvText.trim() !== '') {
      buffer = Buffer.from(dto.csvText, 'utf-8');
    } else {
      throw new BadRequestException('No CSV file or csvText body provided.');
    }

    // Only override the live rate when the caller explicitly supplies one.
    const exchangeRate = dto?.exchangeRate ? parseFloat(dto.exchangeRate) : undefined;
    return this.csvService.parseAndImport(userId, buffer, exchangeRate);
  }
}
