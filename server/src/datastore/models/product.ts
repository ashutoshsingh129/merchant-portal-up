import { Entity,PrimaryColumn,Column,PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Product{
    @PrimaryGeneratedColumn()
    id:number;

    @Column()
    name:string;

    @Column({name:'product_status'})
    status:string;
}