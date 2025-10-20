import { Injectable } from '@nestjs/common';
import { Product } from 'src/datastore/models/product';
import { DataBaseRepository } from 'src/datastore/data.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
@Injectable()
export class ProductDataService extends DataBaseRepository<Product> {
    constructor(
        @InjectRepository(Product) productRepo:Repository<Product>
    ){
        super(productRepo)
    }
    //add additional methods or customized methods at this layer
}
