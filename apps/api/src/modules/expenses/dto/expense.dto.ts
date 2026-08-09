import { IsNumber, IsOptional, IsString, IsPositive, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

/** Must stay in sync with the `expense_category` pg enum in database/schema/enums.ts */
export const EXPENSE_CATEGORIES = [
  'software',
  'hardware',
  'internet',
  'office',
  'travel',
  'food',
  'marketing',
  'education',
  'tax',
  'other',
] as const;

export class CreateExpenseDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @MaxLength(3)
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  exchangeRate?: number;

  @IsIn(EXPENSE_CATEGORIES as unknown as string[], {
    message: `category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`,
  })
  category!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  vendor?: string;

  @Type(() => Date)
  @IsOptional()
  expenseDate?: Date;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
