// @lifecycle ACTIVE — Learning service

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { QueryLessonsDto } from './dto/query-lessons.dto';

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search, filter, and paginate lessons.
   * Supports text search (title/description), difficulty filter, date range, and pagination.
   */
  async searchLessons(dto: QueryLessonsDto) {
    const skip = dto.skip ?? 0;
    const take = Math.min(dto.take ?? 20, 100);

    const where: Prisma.LessonWhereInput = {};

    // Text search — matches title OR description (case-insensitive)
    if (dto.search) {
      where.OR = [
        { title: { contains: dto.search, mode: 'insensitive' as Prisma.QueryMode } },
        { description: { contains: dto.search, mode: 'insensitive' as Prisma.QueryMode } },
      ];
    }

    // Category filter — difficulty enum
    if (dto.difficulty) {
      where.difficulty = dto.difficulty;
    }

    // Date range filter — createdAt
    if (dto.dateFrom || dto.dateTo) {
      where.createdAt = {};
      if (dto.dateFrom) {
        where.createdAt.gte = dto.dateFrom;
      }
      if (dto.dateTo) {
        where.createdAt.lte = dto.dateTo;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where,
        skip,
        take,
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          difficulty: true,
          order: true,
          createdAt: true,
        },
      }),
      this.prisma.lesson.count({ where }),
    ]);

    return { items, total };
  }

  async getLesson(id: string) {
    return this.prisma.lesson.findUnique({
      where: { id },
      include: { exercises: { orderBy: { order: 'asc' } } },
    });
  }

  async createLesson(dto: CreateLessonDto) {
    return this.prisma.lesson.create({ data: dto });
  }
}
