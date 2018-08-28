import { IEventCount } from "./i-event-count";

export interface IEventCounts {
    eventType: string,
    days: IEventCount[];
}