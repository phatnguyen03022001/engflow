// @lifecycle ACTIVE — DTO for querying execution traces

import { IsOptional, IsString } from 'class-validator';

export class QueryExecutionsDto {
  @IsOptional() @IsString()
  routerRoute?: string;

  @IsOptional() @IsString()
  finalOutcome?: string;

  @IsOptional() @IsString()
  skip?: string;

  @IsOptional() @IsString()
  take?: string;

  @IsOptional() @IsString()
  from?: string;

  @IsOptional() @IsString()
  to?: string;
}
