import { IEvent } from "../../interfaces/i-event";
import { IUser } from "../../interfaces/i-user";
import { IApproveEventResponse } from "../../interfaces/i-approve-event-response";


export interface IEventService {
    addEvent(user: IUser, event: IEvent): Promise<IEvent>;
    getEventsForUser(user: IUser, userId: string): Promise<IEvent[]>;
    getEventsForTeam(user: IUser): Promise<IEvent[]>;
    approveEvent(user: IUser, eventId: string): Promise<IApproveEventResponse>;
}
