import { Test, TestingModule } from '@nestjs/testing';
import { CsvService } from './csv.service';
import { DRIZZLE } from '../../database/database.module';

describe('CsvService', () => {
  let service: CsvService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnValue([]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: 'mock_client_id_1' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<CsvService>(CsvService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw BadRequestException if CSV file is empty', async () => {
    await expect(service.parseAndImport('user1', Buffer.from(''))).rejects.toThrow();
  });

  it('should parse Upwork CSV lines and categorize income vs fees', async () => {
    const upworkCSV = `Date,Ref ID,Type,Description,Agency,Amount,Balance
01/15/2026,98123741,Hourly,"Invoice for TechFlow Inc. - Fullstack Development",,1000.00,1000.00
01/15/2026,98123742,Service Fee,"Service Fee for TechFlow Inc.",,-100.00,900.00`;

    const result = await service.parseAndImport('user1', Buffer.from(upworkCSV), 280);

    expect(result.success).toBe(true);
    expect(result.totalParsed).toBe(2);
    expect(result.incomeCount).toBe(1);
    expect(result.expenseCount).toBe(1);
  });
});
