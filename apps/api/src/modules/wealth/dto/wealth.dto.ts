import { IsString, IsNumber, IsOptional, Min, IsEnum } from 'class-validator';

export enum AssetType {
  CASH = 'CASH',
  PROPERTY = 'PROPERTY',
  VEHICLE = 'VEHICLE',
  INVESTMENT = 'INVESTMENT',
  OTHER = 'OTHER',
}

export class CreateAssetDto {
  @IsString()
  taxYear: string;

  @IsEnum(AssetType)
  type: AssetType;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  balance?: number;

  @IsNumber()
  @Min(0)
  valuePKR: number;
}

export class UpdateAssetDto {
  @IsEnum(AssetType)
  @IsOptional()
  type?: AssetType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  balance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  valuePKR?: number;
}

export class CreateLiabilityDto {
  @IsString()
  taxYear: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  amountPKR: number;
}

export class UpdateLiabilityDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amountPKR?: number;
}

export class UpdateWealthStatementDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  openingWealthPKR?: number;

  @IsNumber()
  @IsOptional()
  otherAdjustmentsPKR?: number;
}
