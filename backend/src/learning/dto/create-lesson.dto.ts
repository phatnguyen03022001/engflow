// @lifecycle ACTIVE — Create lesson DTO

import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { Difficulty } from '@prisma/client';

export class CreateLessonDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(Difficulty)
  difficulty!: Difficulty;

  @IsInt()
  @Min(0)
  order!: number;
}
