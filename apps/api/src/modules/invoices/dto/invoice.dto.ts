import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceItemDto {
  @IsString()
  @MaxLength(500)
  description!: string;

  /** Must be > 0; `@Min(0)` alone let zero-quantity lines through to the service. */
  @IsNumber()
  @Min(0.01, { message: 'Item quantity must be greater than zero' })
  @Max(1_000_000)
  quantity!: number;

  @IsNumber()
  @Min(0, { message: 'Item rate cannot be negative' })
  @Max(1_000_000_000)
  rate!: number;
}

export class CreateInvoiceDto {
  @IsUUID(undefined, { message: 'clientId must be a valid id' })
  @IsOptional()
  clientId?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  clientName?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  clientEmail?: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  invoiceNumber?: string;

  @Type(() => Date)
  @IsOptional()
  dueDate?: Date;

  @IsString()
  @MaxLength(3)
  currency!: string;

  @IsNumber()
  @Min(0.0001)
  @Max(100_000)
  @IsOptional()
  exchangeRate?: number;

  // Bounded so a negative rate can never produce negative tax, and an oversized
  // one can never overflow `decimal(5, 2)` into a raw 500.
  @IsNumber()
  @Min(0, { message: 'Tax rate cannot be negative' })
  @Max(100, { message: 'Tax rate cannot exceed 100%' })
  @IsOptional()
  taxRate?: number;

  @IsNumber()
  @Min(0, { message: 'Discount amount cannot be negative' })
  @IsOptional()
  discountAmount?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'An invoice must contain at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items!: CreateInvoiceItemDto[];
}

const INVOICE_STATUSES = ['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'] as const;

export class UpdateInvoiceStatusDto {
  @IsEnum(INVOICE_STATUSES, { message: `status must be one of: ${INVOICE_STATUSES.join(', ')}` })
  status!: string;
}

export class UpdateInvoiceDto {
  @IsUUID(undefined, { message: 'clientId must be a valid id' })
  @IsOptional()
  clientId?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  clientName?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  clientEmail?: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  invoiceNumber?: string;

  @Type(() => Date)
  @IsOptional()
  dueDate?: Date;

  @IsString()
  @MaxLength(3)
  @IsOptional()
  currency?: string;

  @IsNumber()
  @Min(0.0001)
  @Max(100_000)
  @IsOptional()
  exchangeRate?: number;

  @IsNumber()
  @Min(0, { message: 'Tax rate cannot be negative' })
  @Max(100, { message: 'Tax rate cannot exceed 100%' })
  @IsOptional()
  taxRate?: number;

  @IsNumber()
  @Min(0, { message: 'Discount amount cannot be negative' })
  @IsOptional()
  discountAmount?: number;

  @IsString()
  @IsOptional()
  @IsEnum(INVOICE_STATUSES, { message: `status must be one of: ${INVOICE_STATUSES.join(', ')}` })
  status?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  notes?: string;

  @IsArray()
  @IsOptional()
  @ArrayMinSize(1, { message: 'An invoice must contain at least one line item' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items?: CreateInvoiceItemDto[];
}
