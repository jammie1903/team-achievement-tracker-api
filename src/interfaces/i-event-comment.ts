import { IUser } from "./i-user";
import { ObjectID } from "bson";

export interface IEventComment {
    id: string,
    eventId: ObjectID,
    time: number,
    text: string, 
    user: string | IUser;
}
