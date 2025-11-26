import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductDataService } from './product-data/product-data.service';
import { UserDataService } from './user-data/user-data.service';
import { Product } from '../datastore/models/product';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
  ],
  providers: [ProductDataService, UserDataService],
  exports: [UserDataService, ProductDataService],
})
export class DataserviceModule {}
