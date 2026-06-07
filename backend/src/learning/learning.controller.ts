// @lifecycle ACTIVE — Learning controller

import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { LearningService } from './learning.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('lessons')
  getLessons() {
    return this.learningService.getLessons();
  }

  @Get('lessons/:id')
  getLesson(@Param('id') id: string) {
    return this.learningService.getLesson(id);
  }

  @Post('lessons')
  createLesson(@Body() dto: CreateLessonDto) {
    return this.learningService.createLesson(dto);
  }
}
