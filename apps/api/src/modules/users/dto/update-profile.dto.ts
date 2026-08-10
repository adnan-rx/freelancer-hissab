import { IsString, IsOptional, IsBoolean, MaxLength, MinLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  accountTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  // Pakistani IBANs are PK + 2 check digits + 4-letter bank code + 16 alphanumerics.
  // Kept permissive enough for foreign accounts, strict enough to catch typos.
  @Matches(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/, {
    message: 'iban must be a valid IBAN, e.g. PK36MEZN0001020304050607',
  })
  iban?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  psebId?: string;

  @IsOptional()
  @IsBoolean()
  isFiler?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  invoicePrefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  invoiceNotes?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @MaxLength(128)
  @Matches(/[A-Za-z]/, { message: 'New password must contain a letter' })
  @Matches(/[0-9]/, { message: 'New password must contain a number' })
  newPassword!: string;
}
