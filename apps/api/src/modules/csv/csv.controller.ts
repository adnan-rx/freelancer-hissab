import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/authenticated-user';
import { CsvService, MAX_CSV_BYTES } from './csv.service';
import { ImportCsvDto } from './dto/import-csv.dto';

/** The subset of Multer's file that this controller reads. */
interface UploadedCsv {
  buffer?: Buffer;
}

const uploadOptions = { limits: { fileSize: MAX_CSV_BYTES, files: 1 } };

@Controller('csv')
@UseGuards(JwtAuthGuard)
export class CsvController {
  constructor(private readonly csvService: CsvService) {}

  /** Dry run — the user sees exactly what would be imported before confirming. */
  @Post('preview')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  async previewCSV(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportCsvDto,
    @UploadedFile() file?: UploadedCsv,
  ) {
    return this.csvService.previewImport(user.id, this.readCsv(dto, file), this.rateOf(dto), dto?.platform);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  async importCSV(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportCsvDto,
    @UploadedFile() file?: UploadedCsv,
  ) {
    return this.csvService.parseAndImport(user.id, this.readCsv(dto, file), this.rateOf(dto), dto?.platform);
  }

  /**
   * The 5MB cap is enforced here, not just in the browser — posting straight to
   * the API used to bypass the modal's check.
   */
  private readCsv(dto: ImportCsvDto, file?: UploadedCsv): Buffer {
    if (file?.buffer) return file.buffer;
    if (dto?.csvText && dto.csvText.trim() !== '') return Buffer.from(dto.csvText, 'utf-8');
    throw new BadRequestException('No CSV file or csvText body provided.');
  }

  /** Only override the live rate when the caller explicitly supplies one. */
  private rateOf(dto: ImportCsvDto): number | undefined {
    if (!dto?.exchangeRate) return undefined;
    const parsed = parseFloat(dto.exchangeRate);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
}
