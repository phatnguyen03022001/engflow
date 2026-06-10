/* @lifecycle ACTIVE — Reusable pagination query DTO */

import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Reusable pagination query parameters.
 * Use in any list/search endpoint that requires skip/take pagination.
 *
 * @example
 * class QueryMyEntityDto extends QueryPaginationDto {
 *   @IsOptional() @IsString() search?: string;
 * }
 */
export class QueryPaginationDto {
  /**
   * Number of records to skip (offset). Defaults to 0.
   */
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(0)
  skip?: number;

  /**
   * Number of records to return (limit). Defaults to 20, max 100.
   */
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== null ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
