import { BaseRepository } from './base.repository';
import { Entity,Repository,EntityTarget,UpdateResult } from 'typeorm';
//import { LoggerService } from 'src/utilities/logger.service';
export abstract class DataBaseRepository<T> extends BaseRepository<T>{
        protected repository:Repository<T>;
    constructor(protected model:Repository<T>){
      super()
      this.model=model;
    }
    async create(data: T): Promise<T> {
         // this.logger.log('Create',DataBaseRepository.name);
          let result=await this.model.save(data);
          return result;
    }
    async findAll(): Promise<T[]> {
     // this.logger.log('findAll',DataBaseRepository.name);
        let result=await this.model.find();
        return result;
    }
    async findById(id: number): Promise<T|null> {
     // this.logger.log('find by Id',DataBaseRepository.name);
      let result=await this.model.findOne({where:{id}as any});
      return result;
    }

   async update(id: any, data:any): Promise<UpdateResult> {
     // this.logger.log('Update',DataBaseRepository.name);
      return this.model.update({id} ,data)
      
    }
    async delete(id: number): Promise<object> {
     // this.logger.log('Delete',DataBaseRepository.name);
        let result=await this.model.update({status:'inactive'} as any,{id}as any);
        return result;
    }
}