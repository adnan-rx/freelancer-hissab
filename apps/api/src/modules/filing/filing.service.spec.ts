import { Test, TestingModule } from '@nestjs/testing';
import { FilingService } from './filing.service';

describe('FilingService', () => {
  let service: FilingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilingService],
    }).compile();

    service = module.get<FilingService>(FilingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
