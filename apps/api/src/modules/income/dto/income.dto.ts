import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIncomeDto {
  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  invoiceId?: string;

  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @IsString()
  platform!: string;

  @IsString()
  description!: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  sbpPurposeCode?: string;

  @IsString()
  @IsOptional()
  prcReferenceNumber?: string;

  @Type(() => Date)
  @IsOptional()
  receivedAt?: Date;
}
