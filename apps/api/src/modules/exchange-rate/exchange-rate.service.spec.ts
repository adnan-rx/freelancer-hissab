import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeRateService } from './exchange-rate.service';

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExchangeRateService],
    }).compile();

    service = module.get<ExchangeRateService>(ExchangeRateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return 1.0 for same currency conversion', async () => {
    const rate = await service.getRate('PKR', 'PKR');
    expect(rate).toBe(1.0);
  });

  it('should convert USD to PKR with valid multiplier', async () => {
    const { amountPKR, exchangeRate } = await service.convertToPKR(100, 'USD');
    expect(exchangeRate).toBeGreaterThan(200);
    expect(amountPKR).toBe(Math.round(100 * exchangeRate * 100) / 100);
  });
});
