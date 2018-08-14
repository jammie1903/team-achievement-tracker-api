import { Db } from "mongodb";

export interface IMongoService {
    run<T>(fn: (db: Db) => T | Promise<T>): Promise<T>;
}
