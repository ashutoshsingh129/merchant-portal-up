import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { UsecaseModule } from 'src/usecase/usecase.module';
@Module({
  imports:[UsecaseModule],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
