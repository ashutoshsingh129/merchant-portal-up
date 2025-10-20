export abstract class BaseRepository<T> {
  

    abstract findAll(): Promise<T[]>;

    abstract findById(id: number): Promise<T | null> ;

    abstract create(data: Partial<T>): Promise<T> ;

    abstract update(id: number, data: Partial<T>): Promise<object>;

    abstract delete(id: number): Promise<object> ;
}