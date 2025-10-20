import { Module } from '@nestjs/common';
import { ProductDataService } from './product-data/product-data.service';

@Module({
  providers: [ProductDataService]
})
export class DataserviceModule {}
