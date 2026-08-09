import { IsNumber, IsOptional, IsString, IsPositive, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

export const INCOME_PLATFORMS = ['upwork', 'fiverr', 'freelancer', 'direct', 'other'] as const;

export class CreateIncomeDto {
  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  invoiceId?: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @MaxLength(3)
  currency!: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  exchangeRate?: number;

  @IsIn(INCOME_PLATFORMS as unknown as string[])
  platform!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  category?: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  sbpPurposeCode?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  prcReferenceNumber?: string;

  @Type(() => Date)
  @IsOptional()
  receivedAt?: Date;
}

export class UpdateIncomeDto extends PartialType(CreateIncomeDto) {}
