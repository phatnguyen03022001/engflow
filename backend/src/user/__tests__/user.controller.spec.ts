/* @lifecycle ACTIVE — Unit tests for UserController IDOR prevention */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UserController } from '../user.controller';
import { UserService } from '../user.service';
import { UpdateUserDto } from '../dto/update-user.dto';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  const mockUserService = {
    findById: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    updateAvatar: jest.fn(),
  };

  const mockUser = {
    id: 'user-a-uuid',
    email: 'alice@example.com',
    name: 'Alice',
    role: UserRole.STUDENT,
    avatarUrl: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── GET /users/me ──────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should call userService.findById with req.user.id', async () => {
      mockUserService.findById.mockResolvedValue(mockUser);
      const req = { user: { id: 'user-a-uuid', role: UserRole.STUDENT } };

      const result = await controller.getProfile(req);

      expect(userService.findById).toHaveBeenCalledWith('user-a-uuid');
      expect(result).toEqual(mockUser);
    });
  });

  // ─── GET /users/:id ─────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should allow access when id matches req.user.id (self)', async () => {
      mockUserService.findById.mockResolvedValue(mockUser);
      const req = { user: { id: 'user-a-uuid', role: UserRole.STUDENT } };

      const result = await controller.findById('user-a-uuid', req);

      expect(userService.findById).toHaveBeenCalledWith('user-a-uuid');
      expect(result).toEqual(mockUser);
    });

    it('should throw ForbiddenException when id differs from req.user.id (non-admin)', () => {
      const req = { user: { id: 'user-a-uuid', role: UserRole.STUDENT } };

      expect(() => controller.findById('user-b-uuid', req)).toThrow(ForbiddenException);

      expect(userService.findById).not.toHaveBeenCalled();
    });

    it('should allow access when id differs but user is ADMIN', async () => {
      mockUserService.findById.mockResolvedValue({
        ...mockUser,
        id: 'user-b-uuid',
        email: 'bob@example.com',
        name: 'Bob',
      });
      const req = { user: { id: 'user-a-uuid', role: UserRole.ADMIN } };

      const result = await controller.findById('user-b-uuid', req);

      expect(userService.findById).toHaveBeenCalledWith('user-b-uuid');
      expect(result.email).toBe('bob@example.com');
    });

    it('should throw ForbiddenException for non-existent target user (non-admin)', () => {
      const req = { user: { id: 'user-a-uuid', role: UserRole.STUDENT } };

      expect(() => controller.findById('nonexistent-id', req)).toThrow(ForbiddenException);

      expect(userService.findById).not.toHaveBeenCalled();
    });
  });

  // ─── GET /users ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should call userService.findAll', async () => {
      const mockUsers = [mockUser];
      mockUserService.findAll.mockResolvedValue(mockUsers);

      const result = await controller.findAll();

      expect(userService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });
  });

  // ─── PATCH /users/me ────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('should call userService.update with req.user.id and DTO', async () => {
      const dto: UpdateUserDto = { name: 'Updated Name' };
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      mockUserService.update.mockResolvedValue(updatedUser);
      const req = { user: { id: 'user-a-uuid', role: UserRole.STUDENT } };

      const result = await controller.updateProfile(req, dto);

      expect(userService.update).toHaveBeenCalledWith('user-a-uuid', dto);
      expect(result.name).toBe('Updated Name');
    });
  });
});
