import { IsString, IsEmail, IsOptional, IsEnum, IsNotEmpty, ValidateIf, MaxLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: 'TechFlow Inc.' })
  @MaxLength(255)
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  @ApiProperty({ example: 'billing@techflow.com', required: false })
  @IsOptional()
  @ValidateIf((o) => o.email !== '' && o.email !== null && o.email !== undefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiProperty({ example: 'TechFlow LLC', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  company?: string;

  @ApiProperty({ example: 'upwork', enum: ['upwork', 'fiverr', 'freelancer', 'direct', 'other'], required: false })
  @IsOptional()
  @IsEnum(['upwork', 'fiverr', 'freelancer', 'direct', 'other'])
  platform?: string;

  @ApiProperty({ example: 'USD', default: 'USD', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiProperty({ example: 'Active client since 2024', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({ example: 'active', enum: ['active', 'archived'], required: false })
  @IsOptional()
  @IsEnum(['active', 'archived'])
  status?: string;
}

export class UpdateClientDto extends PartialType(CreateClientDto) {}
