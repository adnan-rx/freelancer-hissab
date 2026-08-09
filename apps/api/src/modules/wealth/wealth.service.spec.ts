import { Test, TestingModule } from '@nestjs/testing';
import { WealthService } from './wealth.service';

describe('WealthService', () => {
  let service: WealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WealthService],
    }).compile();

    service = module.get<WealthService>(WealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
