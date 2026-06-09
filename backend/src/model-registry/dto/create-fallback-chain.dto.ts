/* @lifecycle ACTIVE — DTO for creating a fallback chain (ADR-010) */

import {
  IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, Min,
} from 'class-validator';

export class CreateFallbackChainDto {
  @IsString() @IsNotEmpty()
  chainId: string;

  @IsString() @IsNotEmpty()
  primaryModelId: string;

  @IsString() @IsNotEmpty()
  fallbackModelId: string;

  @IsOptional() @IsInt() @Min(1)
  priority?: number;

  @IsOptional() @IsInt()
  triggerOnHttpCode?: number;

  @IsOptional() @IsInt() @Min(0)
  triggerOnTimeoutMs?: number;

  @IsOptional() @IsInt() @Min(0)
  maxRetries?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
