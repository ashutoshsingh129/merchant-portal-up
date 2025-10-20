import { Test, TestingModule } from '@nestjs/testing';
import { ProductDataService } from './product-data.service';

describe('ProductDataService', () => {
  let service: ProductDataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductDataService],
    }).compile();

    service = module.get<ProductDataService>(ProductDataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
