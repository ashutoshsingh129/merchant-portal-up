import { Body, Controller,Get,Param,Post,Put } from '@nestjs/common';
import { ProductService } from './product.service';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async findAll(){
    return this.productService.findAll();
  }

  @Post('/add')
  async create(data){
    return this.productService.create(data);
  }

  @Get('/:id')
  async getById(@Param('id') id:number)
  {
    return this.productService.findById(id);
  }

  @Put('/:id')
  async update(@Param('id') id:number,@Body() data:any)
  {
    return this.productService.update(id,data);
  }

}
