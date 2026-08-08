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
import { CsvService } from './csv.service';
import { ImportCsvDto } from './dto/import-csv.dto';

@Controller('csv')
@UseGuards(JwtAuthGuard)
export class CsvController {
  constructor(private readonly csvService: CsvService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
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

    const exchangeRate = dto?.exchangeRate ? parseFloat(dto.exchangeRate) : 280.50;
    return this.csvService.parseAndImport(userId, buffer, exchangeRate);
  }
}
