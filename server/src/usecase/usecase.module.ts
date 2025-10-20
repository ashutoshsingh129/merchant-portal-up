import { Module } from '@nestjs/common';
import { ProductUsecaseService } from './product-usecase/product-usecase.service';
import { DataserviceModule } from 'src/dataservice/dataservice.module';
@Module({
  imports:[DataserviceModule],
  providers: [ProductUsecaseService]
})
export class UsecaseModule {}
