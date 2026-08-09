import { Test, TestingModule } from '@nestjs/testing';
import { FilingController } from './filing.controller';

describe('FilingController', () => {
  let controller: FilingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FilingController],
    }).compile();

    controller = module.get<FilingController>(FilingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
