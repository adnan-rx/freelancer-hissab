import { IsOptional, IsString } from 'class-validator';

export class ImportCsvDto {
  @IsString()
  @IsOptional()
  csvText?: string;

  @IsString()
  @IsOptional()
  exchangeRate?: string;

  @IsString()
  @IsOptional()
  platform?: string;
}
