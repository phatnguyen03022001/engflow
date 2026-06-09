/* @lifecycle ACTIVE — DTO for creating a model provider (ADR-010) */

import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateProviderDto {
  @IsString() @IsNotEmpty()
  providerId: string;

  @IsString() @IsNotEmpty()
  name: string;

  @IsString() @IsNotEmpty()
  apiBaseUrl: string;

  @IsString() @IsNotEmpty()
  apiKeyEnv: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
