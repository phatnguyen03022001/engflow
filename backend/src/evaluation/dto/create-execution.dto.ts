// @lifecycle ACTIVE — DTO for creating an execution trace

import {
  IsString, IsNotEmpty, IsOptional, IsNumber,
  IsInt, IsBoolean, IsArray, Min, Max,
} from 'class-validator';

export class CreateExecutionDto {
  @IsString() @IsNotEmpty()
  executionId: string;

  @IsString() @IsNotEmpty()
  requestSummary: string;

  @IsString() @IsNotEmpty()
  routerRoute: string;

  @IsNumber() @Min(0) @Max(1)
  routerConfidence: number;

  @IsString() @IsNotEmpty()
  routerRisk: string;

  @IsString() @IsNotEmpty()
  routerReason: string;

  @IsOptional() @IsString()
  planSummary?: string;

  @IsOptional() @IsInt() @Min(0)
  planTaskCount?: number;

  @IsOptional() @IsBoolean()
  archReviewed?: boolean;

  @IsOptional() @IsBoolean()
  archRevisionNeeded?: boolean;

  @IsOptional() @IsString()
  preVerifyDecision?: string;

  @IsOptional() @IsArray()
  preVerifyFlags?: string[];

  @IsOptional() @IsInt() @Min(0)
  codeAttempts?: number;

  @IsOptional() @IsBoolean()
  codeFirstAttemptSuccess?: boolean;

  @IsOptional() @IsString()
  postVerifyDecision?: string;

  @IsOptional() @IsArray()
  postVerifyIssues?: string[];

  @IsOptional() @IsInt() @Min(0)
  retryCount?: number;

  @IsOptional() @IsBoolean()
  debugSuccess?: boolean;

  @IsString() @IsNotEmpty()
  finalOutcome: string;

  @IsOptional() @IsInt() @Min(0)
  totalDurationMs?: number;

  @IsOptional()
  committedAt?: string;
}
