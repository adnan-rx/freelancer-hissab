import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { DRIZZLE } from '../../database/database.module';
import { NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';

describe('UsersService', () => {
  let service: UsersService;
  let dbMock: any;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    name: 'Test User',
    businessName: null,
    bankName: null,
    iban: null,
  };

  beforeEach(async () => {
    // Mock the chained Drizzle DB calls
    const limitMock = jest.fn().mockResolvedValue([mockUser]);
    const whereMock = jest.fn().mockReturnValue({ limit: limitMock });
    const fromMock = jest.fn().mockReturnValue({ where: whereMock });
    const selectMock = jest.fn().mockReturnValue({ from: fromMock });

    const returningMock = jest.fn().mockResolvedValue([{ ...mockUser, name: 'Updated Name', bankName: 'Meezan Bank' }]);
    const whereUpdateMock = jest.fn().mockReturnValue({ returning: returningMock });
    const setMock = jest.fn().mockReturnValue({ where: whereUpdateMock });
    const updateMock = jest.fn().mockReturnValue({ set: setMock });

    dbMock = {
      select: selectMock,
      update: updateMock,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DRIZZLE,
          useValue: dbMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return a user profile if user exists', async () => {
      const result = await service.getProfile(mockUserId);
      expect(result).toEqual(mockUser);
      expect(dbMock.select).toHaveBeenCalled();
    });

    it('should return null if user does not exist', async () => {
      dbMock.select().from().where().limit.mockResolvedValueOnce([]);
      const result = await service.getProfile('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update and return the user profile with new fields', async () => {
      const updateDto: UpdateProfileDto = {
        name: 'Updated Name',
        bankName: 'Meezan Bank',
      };

      const result = await service.updateProfile(mockUserId, updateDto);

      expect(dbMock.update).toHaveBeenCalled();
      expect(result.name).toEqual('Updated Name');
      expect(result.bankName).toEqual('Meezan Bank');
    });

    it('should throw NotFoundException if user to update does not exist', async () => {
      dbMock.select().from().where().limit.mockResolvedValueOnce([]);
      
      await expect(service.updateProfile('missing-id', { name: 'New' }))
        .rejects
        .toThrow(NotFoundException);
    });
  });
});
