/* @lifecycle ACTIVE — DTO for querying lessons with search/filter/pagination */

import { IsOptional, IsString, IsEnum, IsDate, IsInt, Min, Max, MinLength, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { Difficulty } from '@prisma/client';

/**
 * Query parameters for the advanced lesson search endpoint.
 * Supports multi-field filtering and pagination.
 */
export class QueryLessonsDto {
  /**
   * Text search — matches against lesson title OR description (case-insensitive).
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  search?: string;

  /**
   * Filter by difficulty category.
   */
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  /**
   * Filter lessons created on or after this date (ISO 8601 string).
   */
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  dateFrom?: Date;

  /**
   * Filter lessons created on or before this date (ISO 8601 string).
   */
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  dateTo?: Date;

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
