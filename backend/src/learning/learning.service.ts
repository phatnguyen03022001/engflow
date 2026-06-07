// @lifecycle ACTIVE — Learning service

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async getLessons() {
    return this.prisma.lesson.findMany({
      orderBy: { order: 'asc' },
      include: { exercises: true },
    });
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
