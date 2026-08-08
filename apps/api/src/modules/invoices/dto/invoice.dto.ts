import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { invoiceStatusEnum } from '../../../database/schema/enums';

export class CreateInvoiceItemDto {
  @IsString()
  description!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  rate!: number;
}

export class CreateInvoiceDto {
  @IsString()
  clientId!: string;

  @IsString()
  @IsOptional()
  invoiceNumber?: string;

  @Type(() => Date)
  @IsOptional()
  dueDate?: Date;

  @IsString()
  currency!: string;

  @IsNumber()
  @IsOptional()
  exchangeRate?: number;

  @IsNumber()
  @IsOptional()
  taxRate?: number;

  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];
}

export class UpdateInvoiceStatusDto {
  @IsEnum(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'])
  status!: string;
}
