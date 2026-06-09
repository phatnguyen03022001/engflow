// @lifecycle ACTIVE — Shared module (global providers)

import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { HealthModule } from './health/health.module';
import { appConfigSchema } from './config/app-config.schema';

@Global()
@Module({
  imports: [
    // Config validation via Joi
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: appConfigSchema,
      validationOptions: {
        abortEarly: true,
        allowUnknown: true,
      },
    }),
    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10) * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
      },
    ]),
    HealthModule,
  ],
  providers: [
    PrismaService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
  exports: [PrismaService, HealthModule],
})
export class SharedModule {}
