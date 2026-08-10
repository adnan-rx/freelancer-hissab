import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { DRIZZLE } from '../../database/database.module';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const mockUserId = 'user-1';

  // Shaped as the service's own `select({...})` projection would return it
  // (field renaming + the clients leftJoin), since the mock below stands in
  // for the whole query chain rather than a real Drizzle client.
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
    },
  ];

  const mockExpenses = [
    {
      id: 'exp-1',
      amount: '5000',
      amountPKR: '5000',
      currency: 'PKR',
      description: 'Internet Bill',
      category: 'Utilities',
      vendor: 'PTCL',
      expenseDate: '2026-08-05',
      createdAt: new Date('2026-08-05T10:00:00Z'),
    },
  ];

  async function buildService(income = mockIncome, expenses = mockExpenses) {
    const expenseWhereMock = jest.fn().mockResolvedValue(expenses);
    const expenseFromMock = jest.fn().mockReturnValue({ where: expenseWhereMock });

    const incomeWhereMock = jest.fn().mockResolvedValue(income);
    const incomeLeftJoinMock = jest.fn().mockReturnValue({ where: incomeWhereMock });
    const incomeFromMock = jest.fn().mockReturnValue({ leftJoin: incomeLeftJoinMock });

    const dbMock = {
      select: jest.fn().mockImplementation((schema) => {
        // The expense fetch calls select() with no projection object; the income
        // fetch always passes one, so this alone is enough to tell them apart.
        if (!schema) return { from: expenseFromMock };
        return { from: incomeFromMock };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionsService, { provide: DRIZZLE, useValue: dbMock }],
    }).compile();

    return module.get<TransactionsService>(TransactionsService);
  }

  it('returns combined, sorted transactions with pagination metadata', async () => {
    service = await buildService();
    const result = await service.findAll(mockUserId, {});

    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    // Sort should put newest first (expense on Aug 5, income on Aug 1)
    expect(result.data[0].id).toBe('exp-1');
    expect(result.data[0].type).toBe('EXPENSE');
    expect(result.data[1].id).toBe('inc-1');
    expect(result.data[1].type).toBe('INCOME');
    expect(result.data[1].amount).toBe(28000); // mapped from amountPKR
  });

  it('filters by type INCOME', async () => {
    service = await buildService();
    const result = await service.findAll(mockUserId, { type: 'INCOME' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].type).toBe('INCOME');
  });

  it('filters by search keyword (case insensitive)', async () => {
    service = await buildService();
    const result = await service.findAll(mockUserId, { search: 'ptcl' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].entity).toBe('PTCL');
  });

  describe('date range', () => {
    it('includes a transaction dated exactly on the start boundary', async () => {
      service = await buildService();
      const result = await service.findAll(mockUserId, { startDate: '2026-08-01' });
      expect(result.data.map((t) => t.id).sort()).toEqual(['exp-1', 'inc-1']);
    });

    it('excludes a transaction dated before the start boundary', async () => {
      service = await buildService();
      const result = await service.findAll(mockUserId, { startDate: '2026-08-02' });
      expect(result.data.map((t) => t.id)).toEqual(['exp-1']);
    });

    it('includes a transaction dated exactly on the end boundary', async () => {
      service = await buildService();
      const result = await service.findAll(mockUserId, { endDate: '2026-08-05' });
      expect(result.data.map((t) => t.id).sort()).toEqual(['exp-1', 'inc-1']);
    });

    it('excludes a transaction dated after the end boundary', async () => {
      service = await buildService();
      const result = await service.findAll(mockUserId, { endDate: '2026-08-04' });
      expect(result.data.map((t) => t.id)).toEqual(['inc-1']);
    });

    it('combines start and end into a closed range that can exclude everything', async () => {
      service = await buildService();
      const result = await service.findAll(mockUserId, { startDate: '2026-08-03', endDate: '2026-08-04' });
      expect(result.data).toHaveLength(0);
    });
  });

  describe('pagination', () => {
    it('slices results by page and pageSize', async () => {
      service = await buildService();
      const page1 = await service.findAll(mockUserId, { pageSize: 1, page: 1 });
      const page2 = await service.findAll(mockUserId, { pageSize: 1, page: 2 });

      expect(page1.data).toHaveLength(1);
      expect(page1.total).toBe(2);
      expect(page1.totalPages).toBe(2);
      expect(page2.data).toHaveLength(1);
      expect(page1.data[0].id).not.toBe(page2.data[0].id);
    });

    it('clamps a page number beyond the last page to the last page', async () => {
      service = await buildService();
      const result = await service.findAll(mockUserId, { pageSize: 1, page: 99 });
      expect(result.page).toBe(2);
      expect(result.data).toHaveLength(1);
    });

    it('clamps a page number below 1 to the first page', async () => {
      service = await buildService();
      const result = await service.findAll(mockUserId, { page: 0 });
      expect(result.page).toBe(1);
    });

    it('defaults to page size 20 when unset', async () => {
      service = await buildService();
      const result = await service.findAll(mockUserId, {});
      expect(result.pageSize).toBe(20);
    });

    it('caps pageSize at 200 so a caller cannot request the whole table in one page', async () => {
      service = await buildService();
      const result = await service.findAll(mockUserId, { pageSize: 5000 });
      expect(result.pageSize).toBe(200);
    });

    it('returns an empty page with totalPages 1 when there are no rows', async () => {
      service = await buildService([], []);
      const result = await service.findAll(mockUserId, {});
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(1);
      expect(result.page).toBe(1);
    });
  });
});
