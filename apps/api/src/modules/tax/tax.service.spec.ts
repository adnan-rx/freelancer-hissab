import { Test, TestingModule } from '@nestjs/testing';
import { TaxService } from './tax.service';
import { DRIZZLE } from '../../database/database.module';

describe('TaxService', () => {
  let service: TaxService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockImplementation((condition) => {
        // Return test income/expense rows
        return [];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<TaxService>(TaxService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate 0.25% tax for PSEB registered exporter on USD income', async () => {
    mockDb.where = jest.fn().mockImplementation((condition) => {
      // Return sample income of 1,000,000 PKR
      return [
        { amountPKR: '1000000', currency: 'USD', platform: 'upwork' },
      ];
    });

    const result = await service.calculateTaxEstimate('user1', true, 2026);

    expect(result.totalGrossIncomePKR).toBe(1000000);
    expect(result.exportTaxRatePercentage).toBe(0.25);
    expect(result.exportTaxLiabilityPKR).toBe(2500); // 0.25% of 1M = 2,500 PKR
    expect(result.psebSavingsPKR).toBe(7500); // 0.75% of 1M saved = 7,500 PKR
  });

  it('should calculate 1.0% tax for non-PSEB exporter', async () => {
    mockDb.where = jest.fn().mockImplementation((condition) => {
      return [
        { amountPKR: '1000000', currency: 'USD', platform: 'upwork' },
      ];
    });

    const result = await service.calculateTaxEstimate('user1', false, 2026);

    expect(result.exportTaxRatePercentage).toBe(1.0);
    expect(result.exportTaxLiabilityPKR).toBe(10000); // 1% of 1M = 10,000 PKR
    expect(result.psebSavingsPKR).toBe(0);
  });
});
