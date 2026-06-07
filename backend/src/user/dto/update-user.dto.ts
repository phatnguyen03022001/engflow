// @lifecycle ACTIVE — Update user DTO

import { IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
