import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { DRIZZLE } from '../../database/database.module';
import { invoices, invoiceItems, clients, users } from '../../database/schema';
import { createMockDb, mockExchangeRateService } from '../../common/testing/mock-db';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';

describe('InvoicesService Editing & Compliance Rules', () => {
  let service: InvoicesService;
  const mockDbInstance: any = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    // Multi-table writes are wrapped in a transaction now; the mock just runs the callback.
    transaction: jest.fn(async (fn: any) => fn(mockDbInstance)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: DRIZZLE,
          useValue: mockDbInstance,
        },
        {
          provide: ExchangeRateService,
          useValue: mockExchangeRateService,
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  const setupFindOneMock = (invoiceData: any, itemsData: any[] = []) => {
    mockDbInstance.select.mockImplementation(() => ({
      from: jest.fn().mockImplementation((table: any) => {
        if (table === invoices) {
          return {
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(
                  invoiceData ? [{ invoice: invoiceData, client: { id: invoiceData.clientId, name: 'Test Client' } }] : []
                ),
              }),
            }),
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([]),
            }),
          };
        }
        if (table === invoiceItems) {
          return {
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockResolvedValue(itemsData),
            }),
          };
        }
        return {
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        };
      }),
    }));
  };

  it('rejects editing paid invoices with a compliance error', async () => {
    setupFindOneMock({
      id: 'inv-1',
      userId: 'user-1',
      clientId: 'client-1',
      invoiceNumber: 'FH-2026-0001',
      status: 'paid',
      subtotal: '100',
      total: '100',
      totalPKR: '28000',
      exchangeRate: '280',
    });

    await expect(
      service.update('user-1', 'inv-1', {
        notes: 'Trying to update notes on paid invoice',
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects editing cancelled invoices with an audit trail error', async () => {
    setupFindOneMock({
      id: 'inv-2',
      userId: 'user-1',
      clientId: 'client-1',
      invoiceNumber: 'FH-2026-0002',
      status: 'cancelled',
      subtotal: '100',
      total: '100',
      totalPKR: '28000',
      exchangeRate: '280',
    });

    await expect(
      service.update('user-1', 'inv-2', {
        notes: 'Trying to edit cancelled invoice',
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('locks invoiceNumber and preserves client on sent/overdue invoices', async () => {
    setupFindOneMock(
      {
        id: 'inv-3',
        userId: 'user-1',
        clientId: 'client-original',
        invoiceNumber: 'FH-2026-0003',
        status: 'sent',
        currency: 'USD',
        exchangeRate: '280',
        subtotal: '100',
        taxRate: '0',
        taxAmount: '0',
        discountAmount: '0',
        total: '100',
        totalPKR: '28000',
      },
      [
        {
          id: 'item-1',
          invoiceId: 'inv-3',
          description: 'Dev work',
          quantity: '1',
          rate: '100',
          amount: '100',
          sortOrder: 0,
        },
      ]
    );

    const updateSetMock = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([{ id: 'inv-3' }]),
    });
    mockDbInstance.update.mockReturnValue({ set: updateSetMock });
    mockDbInstance.delete.mockReturnValue({ where: jest.fn().mockResolvedValue([]) });
    mockDbInstance.insert.mockReturnValue({ values: jest.fn().mockResolvedValue([]) });

    await service.update('user-1', 'inv-3', {
      invoiceNumber: 'FH-2026-MODIFIED', // Should be ignored because status is sent
      clientId: 'client-malicious', // Should be ignored because status is sent
      items: [{ description: 'Updated task', quantity: 2, rate: 150 }],
    });

    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: 'FH-2026-0003', // Retained original
        clientId: 'client-original', // Retained original
        subtotal: '300',
        total: '300',
        totalPKR: '84000', // 300 * 280
      })
    );
  });

  it('allows draft invoices to update invoiceNumber if unique', async () => {
    setupFindOneMock(
      {
        id: 'inv-4',
        userId: 'user-1',
        clientId: 'client-1',
        invoiceNumber: 'FH-2026-0004',
        status: 'draft',
        currency: 'USD',
        exchangeRate: '280',
        subtotal: '100',
        total: '100',
        totalPKR: '28000',
      },
      [
        {
          id: 'item-1',
          invoiceId: 'inv-4',
          description: 'Draft work',
          quantity: '1',
          rate: '100',
          amount: '100',
          sortOrder: 0,
        },
      ]
    );

    const updateSetMock = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([{ id: 'inv-4' }]),
    });
    mockDbInstance.update.mockReturnValue({ set: updateSetMock });
    mockDbInstance.delete.mockReturnValue({ where: jest.fn().mockResolvedValue([]) });
    mockDbInstance.insert.mockReturnValue({ values: jest.fn().mockResolvedValue([]) });

    await service.update('user-1', 'inv-4', {
      invoiceNumber: 'CUSTOM-INV-001',
      items: [{ description: 'Draft work', quantity: 1, rate: 100 }],
    });

    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: 'CUSTOM-INV-001',
      })
    );
  });

  it('recalculates tax, discount, and PKR conversion accurately on edit', async () => {
    setupFindOneMock(
      {
        id: 'inv-5',
        userId: 'user-1',
        clientId: 'client-1',
        invoiceNumber: 'FH-2026-0005',
        status: 'draft',
        currency: 'USD',
        exchangeRate: '280',
        subtotal: '100',
        total: '100',
        totalPKR: '28000',
      },
      []
    );

    const updateSetMock = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([{ id: 'inv-5' }]),
    });
    mockDbInstance.update.mockReturnValue({ set: updateSetMock });
    mockDbInstance.delete.mockReturnValue({ where: jest.fn().mockResolvedValue([]) });
    mockDbInstance.insert.mockReturnValue({ values: jest.fn().mockResolvedValue([]) });

    await service.update('user-1', 'inv-5', {
      exchangeRate: 285.5,
      taxRate: 10,
      discountAmount: 50,
      items: [
        { description: 'Item 1', quantity: 2, rate: 200 }, // 400
        { description: 'Item 2', quantity: 1, rate: 100 }, // 100
      ], // Subtotal = 500. Tax = 50. Discount = 50. Total = 500. TotalPKR = 500 * 285.5 = 142750.
    });

    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: '500',
        taxRate: '10',
        taxAmount: '50',
        discountAmount: '50',
        total: '500',
        totalPKR: '142750',
      })
    );
  });

  it('rejects update if total calculates to negative amount', async () => {
    setupFindOneMock({
      id: 'inv-6',
      userId: 'user-1',
      clientId: 'client-1',
      invoiceNumber: 'FH-2026-0006',
      status: 'draft',
      currency: 'USD',
      exchangeRate: '280',
      subtotal: '100',
      total: '100',
      totalPKR: '28000',
    });

    await expect(
      service.update('user-1', 'inv-6', {
        discountAmount: 500, // Subtotal 100 - Discount 500 = -400
        items: [{ description: 'Work', quantity: 1, rate: 100 }],
      })
    ).rejects.toThrow(BadRequestException);
  });
});
