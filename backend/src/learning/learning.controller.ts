// @lifecycle ACTIVE — Learning controller

import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { LearningService } from './learning.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { QueryLessonsDto } from './dto/query-lessons.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Learning')
@ApiBearerAuth('JWT-auth')
@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('lessons')
  @ApiOperation({ summary: 'Search and paginate lessons' })
  @ApiQuery({ name: 'search', required: false, description: 'Text search (title or description)' })
  @ApiQuery({ name: 'difficulty', required: false, enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], description: 'Filter by difficulty' })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Filter from date (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'Filter to date (ISO 8601)' })
  @ApiQuery({ name: 'skip', required: false, description: 'Records to skip (offset)' })
  @ApiQuery({ name: 'take', required: false, description: 'Records to return (limit, max 100)' })
  getLessons(@Query() query: QueryLessonsDto) {
    return this.learningService.searchLessons(query);
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
