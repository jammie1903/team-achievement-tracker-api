export type IMongoItem<T extends {}> = T & {
    _id: string
}
