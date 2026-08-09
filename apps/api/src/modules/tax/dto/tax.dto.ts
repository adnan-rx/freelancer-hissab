import { IsBoolean, IsNumber, IsOptional, IsString, Min, Max, Matches, MaxLength } from 'class-validator';
import { PartialType, OmitType } from '@nestjs/swagger';

export class SimulateTaxDto {
  @IsNumber()
  @Min(0)
  incomePKR!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  expensesPKR?: number;

  /** Locally-sourced portion, taxed under the normal slabs. Expenses are deductible against this. */
  @IsNumber()
  @Min(0)
  @IsOptional()
  localIncomePKR?: number;

  @IsNumber()
  @Min(2000)
  @Max(2100)
  @IsOptional()
  year?: number;

  @IsBoolean()
  @IsOptional()
  pseb?: boolean;
}

export class CreateTaxRuleDto {
  /** "2025-26" */
  @Matches(/^\d{4}-\d{2,4}$/, { message: 'taxYear must look like "2025-26"' })
  taxYear!: string;

  @IsString()
  @MaxLength(50)
  incomeType!: string;

  /** Decimal fraction, e.g. 0.0025 for 0.25% */
  @IsNumber()
  @Min(0)
  @Max(1)
  rate!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  threshold?: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effectiveFrom must be YYYY-MM-DD' })
  effectiveFrom!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effectiveTo must be YYYY-MM-DD' })
  @IsOptional()
  effectiveTo?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}

export class UpdateTaxRuleDto extends PartialType(
  OmitType(CreateTaxRuleDto, ['taxYear', 'incomeType'] as const),
) {}
