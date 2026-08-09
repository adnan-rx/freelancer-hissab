import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested, ArrayMinSize, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceItemDto {
  @IsString()
  @MaxLength(500)
  description!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  rate!: number;
}

export class CreateInvoiceDto {
  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  clientName?: string;

  @IsString()
  @IsOptional()
  clientEmail?: string;

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

  @IsNumber()
  @IsOptional()
  subtotal?: number;

  @IsNumber()
  @IsOptional()
  total?: number;

  @IsNumber()
  @IsOptional()
  totalPKR?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'An invoice must contain at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];
}

export class UpdateInvoiceStatusDto {
  @IsEnum(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'])
  status!: string;
}
