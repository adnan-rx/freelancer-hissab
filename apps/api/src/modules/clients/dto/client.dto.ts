import { IsString, IsEmail, IsOptional, IsEnum, ValidateIf } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'TechFlow Inc.' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'billing@techflow.com', required: false })
  @IsOptional()
  @ValidateIf((o) => o.email !== '' && o.email !== null && o.email !== undefined)
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'TechFlow LLC', required: false })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiProperty({ example: 'upwork', enum: ['upwork', 'fiverr', 'freelancer', 'direct', 'other'], required: false })
  @IsOptional()
  @IsEnum(['upwork', 'fiverr', 'freelancer', 'direct', 'other'])
  platform?: string;

  @ApiProperty({ example: 'USD', default: 'USD', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'Active client since 2024', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 'active', enum: ['active', 'archived'], required: false })
  @IsOptional()
  @IsEnum(['active', 'archived'])
  status?: string;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {}
