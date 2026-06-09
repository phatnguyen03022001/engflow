/* @lifecycle ACTIVE — Joi validation schema for environment variables (TASK-030) */

import * as Joi from 'joi';

export const appConfigSchema = Joi.object({
  // Server
  PORT: Joi.number().default(3001),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  // Database
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql'] })
    .required()
    .messages({
      'string.uri': 'DATABASE_URL must be a valid PostgreSQL connection string',
      'any.required': 'DATABASE_URL is required',
    }),

  // JWT
  JWT_SECRET: Joi.string().min(16).required().messages({
    'string.min': 'JWT_SECRET must be at least 16 characters',
    'any.required': 'JWT_SECRET is required',
  }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // Frontend
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  // Agent
  AGENT_API_KEY: Joi.string().min(8).required().messages({
    'string.min': 'AGENT_API_KEY must be at least 8 characters',
    'any.required': 'AGENT_API_KEY is required',
  }),

  // Throttling (optional with defaults)
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),
});

export type AppConfig = {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  FRONTEND_URL: string;
  AGENT_API_KEY: string;
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;
};
