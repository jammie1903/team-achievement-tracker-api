import { IUser } from "./i-user";

export interface IEvent {
    id: string,
    eventType: string,
    time: number,
    summary: string, 
    user: string | IUser;
    author: string | IUser;
    approved: number;
    approvedBy: string | IUser;
}
