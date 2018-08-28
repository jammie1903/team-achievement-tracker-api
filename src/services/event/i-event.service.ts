import { IEvent } from "../../interfaces/i-event";
import { IUser } from "../../interfaces/i-user";
import { IApproveEventResponse } from "../../interfaces/i-approve-event-response";
import { IEventComment } from "../../interfaces/i-event-comment";
import { IEventCounts } from "../../interfaces/i-event-counts";


export interface IEventService {
    addEvent(user: IUser, event: IEvent): Promise<IEvent>;
    addEventComment(user: IUser, eventId: string, text: string): Promise<IEventComment>;
    getEventComments(user: IUser, eventId: string): Promise<IEventComment[]>;
    setLikeEvent(user: IUser, eventId: string, like: boolean): Promise<void>;
    getEventsForUser(user: IUser, userId: string): Promise<IEvent[]>;
    getEventsForTeam(user: IUser): Promise<IEvent[]>;
    approveEvent(user: IUser, eventId: string): Promise<IApproveEventResponse>;
    getEventCount(user: IUser, to: number, from: number): Promise<IEventCounts[]>
}
