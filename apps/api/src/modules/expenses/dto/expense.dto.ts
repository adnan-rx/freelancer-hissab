import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @IsNumber()
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  category!: string;

  @IsString()
  description!: string;

  @IsString()
  @IsOptional()
  vendor?: string;

  @Type(() => Date)
  @IsOptional()
  expenseDate?: Date;
}
