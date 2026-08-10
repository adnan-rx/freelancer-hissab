import { Test, TestingModule } from '@nestjs/testing';
import { WealthController } from './wealth.controller';
import { WealthService } from './wealth.service';

describe('WealthController', () => {
  let controller: WealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WealthController],
      providers: [{ provide: WealthService, useValue: {} }],
    }).compile();

    controller = module.get<WealthController>(WealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
