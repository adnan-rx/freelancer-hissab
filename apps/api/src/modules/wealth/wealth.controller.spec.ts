import { Test, TestingModule } from '@nestjs/testing';
import { WealthController } from './wealth.controller';

describe('WealthController', () => {
  let controller: WealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WealthController],
    }).compile();

    controller = module.get<WealthController>(WealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
