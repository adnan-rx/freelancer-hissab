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
