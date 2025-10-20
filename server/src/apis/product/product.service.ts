import { Injectable } from '@nestjs/common';
import { ProductUsecaseService } from 'src/usecase/product-usecase/product-usecase.service';
@Injectable()
export class ProductService {
   
    constructor(private readonly productService:ProductUsecaseService){}

    async findAll(){
        return this.productService.findAll();
    }

    async create(data:any){
        return this.productService.create(data);
    }

    async findById(id:number){
        return this.productService.findOne(id);
    }

    async update(id:number,data:any){
        return this.productService.update(id,data);
    }
}
