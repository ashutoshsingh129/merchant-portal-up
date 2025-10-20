import { Injectable } from '@nestjs/common';
import { ProductDataService } from 'src/dataservice/product-data/product-data.service';
@Injectable()
export class ProductUsecaseService {
    constructor(
        private productService:ProductDataService
    ){}

    async findAll(){
        return this.productService.findAll()
    }

    async create(data:any){
        return this.productService.create(data);
    }

    async findOne(id:number){
        return this.productService.findById(id);
    }

    async update(id:number,data:any){
        return this.productService.update(id,data);
    }
}
