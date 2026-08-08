import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { DRIZZLE } from '../../database/database.module';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let dbMock: any;

  const mockUserId = 'user-1';
  
  const mockIncome = [
    {
      id: 'inc-1',
      amount: '28000',
      currency: 'USD',
      description: 'Upwork Project',
      category: 'Freelance',
      clientName: 'Acme Corp',
      date: new Date('2026-08-01T10:00:00Z'),
      createdAt: new Date('2026-08-01T10:00:00Z'),
    }
  ];

  const mockExpenses = [
    {
      id: 'exp-1',
      amount: '5000',
      currency: 'PKR',
      description: 'Internet Bill',
      category: 'Utilities',
      vendor: 'PTCL',
      expenseDate: '2026-08-05',
      createdAt: new Date('2026-08-05T10:00:00Z'),
    }
  ];

  beforeEach(async () => {
    // 1. Mock Expense chain
    const expenseWhereMock = jest.fn().mockResolvedValue(mockExpenses);
    const expenseFromMock = jest.fn().mockReturnValue({ where: expenseWhereMock });
    const expenseSelectMock = jest.fn().mockReturnValue({ from: expenseFromMock });

    // 2. Mock Income chain
    const incomeWhereMock = jest.fn().mockResolvedValue(mockIncome);
    const incomeLeftJoinMock = jest.fn().mockReturnValue({ where: incomeWhereMock });
    const incomeFromMock = jest.fn().mockReturnValue({ leftJoin: incomeLeftJoinMock });
    const incomeSelectMock = jest.fn().mockReturnValue({ from: incomeFromMock });

    dbMock = {
      select: jest.fn().mockImplementation((schema) => {
        if (!schema) {
          // expense fetch has empty select()
          return { from: expenseFromMock };
        }
        // income fetch has schema selected
        return { from: incomeFromMock };
      })
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: DRIZZLE,
          useValue: dbMock,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  it('should return combined, sorted transactions', async () => {
    const result = await service.findAll(mockUserId, {});
    
    expect(result).toHaveLength(2);
    // Sort should put newest first (expense on Aug 5, income on Aug 1)
    expect(result[0].id).toBe('exp-1');
    expect(result[0].type).toBe('EXPENSE');
    
    expect(result[1].id).toBe('inc-1');
    expect(result[1].type).toBe('INCOME');
    expect(result[1].amount).toBe(28000); // Verify it mapped amountPKR correctly
  });

  it('should filter by type INCOME', async () => {
    const result = await service.findAll(mockUserId, { type: 'INCOME' });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('INCOME');
  });

  it('should filter by search keyword (case insensitive)', async () => {
    const result = await service.findAll(mockUserId, { search: 'ptcl' });
    expect(result).toHaveLength(1);
    expect(result[0].entity).toBe('PTCL');
  });
});
