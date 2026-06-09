// @lifecycle ACTIVE — Learning controller

import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LearningService } from './learning.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Learning')
@ApiBearerAuth('JWT-auth')
@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('lessons')
  @ApiOperation({ summary: 'List all lessons' })
  getLessons() {
    return this.learningService.getLessons();
  }

  @Get('lessons/:id')
  @ApiOperation({ summary: 'Get a lesson by ID' })
  getLesson(@Param('id') id: string) {
    return this.learningService.getLesson(id);
  }

  @Post('lessons')
  @ApiOperation({ summary: 'Create a new lesson' })
  createLesson(@Body() dto: CreateLessonDto) {
    return this.learningService.createLesson(dto);
  }
}
