import { Test, TestingModule } from '@nestjs/testing';
import { ProductUsecaseService } from './product-usecase.service';

describe('ProductUsecaseService', () => {
  let service: ProductUsecaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductUsecaseService],
    }).compile();

    service = module.get<ProductUsecaseService>(ProductUsecaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
