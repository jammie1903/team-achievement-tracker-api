import { Service, Autowired } from "express-utils";
import { IEventService } from "./i-event.service";
import { BadRequest, Forbidden, NotFound } from "http-errors";
import { IUser } from "../../interfaces/i-user";
import { IMongoService } from "../mongo/i-mongo.service";
import { Db, Cursor } from "mongodb";
import { IMongoItem } from "../../interfaces/i-mongo-item";
import { IEvent } from "../../interfaces/i-event";
import { IUserService } from "../user/i-user.service";
import { IApproveEventResponse } from "../../interfaces/i-approve-event-response";

@Service("eventService")
export default class EventService implements IEventService {

    @Autowired()
    private mongoService: IMongoService;

    @Autowired()
    private userService: IUserService;

    public onInit(): void {
        console.log(this.constructor.name, "initialised");
    }

    public async getEventsForTeam(user: IUser) {
        const users = await this.userService.getTeam(user);
        return this.getEventsForUsers(users.map(user => user.id));
    }

    public async getEventsForUser(user: IUser, userId: string) {
        if (user.id !== userId) {
            const teamLeadId = user.isTeamLead ? user.id : ((user.teamLead || {}) as IUser).id;
            if (!teamLeadId || !await this.userService.isInTeam(teamLeadId, userId)) {
                throw new NotFound("No user by this id exists or you do not have access to them");
            }
        }
        return this.getEventsForUsers([userId]);
    }

    private getEventsForUsers(userIds: string[]) {
        return this.mongoService.run((db: Db) => {
            const query: any = {
                user: { $in: userIds }
            };

            const result: Cursor<IEvent> = db.collection("events").find(query);
            return new Promise<IEvent[]>((res, rej) => {
                const returnList: IEvent[] = [];
                result.forEach((event: IMongoItem<IEvent>) => {
                    event.id = event._id;
                    delete event._id;
                    returnList.push(event);
                }, (err) => {
                    err ? rej(err) : res(returnList);
                });
            });
        });
    }

    public approveEvent(user: IUser, eventId: string): Promise<IApproveEventResponse> {
        if (!user.isTeamLead) {
            throw new Forbidden("You do not have permission to approve events");
        }

        return this.mongoService.run(async (db: Db) => {
            const event = await db.collection("events").findOne({ _id: eventId })

            if (!event || !await this.userService.isInTeam(user.id, event.userId)) {
                throw new NotFound("This event could not be foundor you do not have access to it");
            }

            if (event.approved) {
                return {
                    message: "Event already approved",
                    approved: event.approved,
                }
            }
            const approved = Date.now();
            await db.collection("events").updateOne({ _id: eventId }, {$set: {approved, approvedBy: user.id}});
            return {
                message: "Success",
                approved: approved,
            }
        });
    }

    async addEvent(user: IUser, event: IEvent): Promise<IEvent> {
        const now = Date.now();
        const eventUserId: string = (event.user as string) || user.id;
        let approved = null;
        let approvedBy = null;

        if (user.isTeamLead) {
            if (user.id !== eventUserId && !await this.userService.isInTeam(user.id, eventUserId)) {
                throw new NotFound("No user by this id exists or you do not have access to them");
            }
            approved = now;
            approvedBy = user.id;
        } else if (user.id !== eventUserId) {
            throw new Forbidden("You do not have permission to publish events for other users");
        }

        const time = isNaN(Number(event.time)) ? now : Math.min(now, event.time);

        const parsedEvent: Partial<IEvent> = {
            author: user.id,
            eventType: event.eventType,
            summary: event.summary,
            approved,
            approvedBy,
            user: eventUserId,
            time
        };

        return this.mongoService.run((db: Db) => {
            return db.collection("events").insertOne(parsedEvent)
                .then(result => {
                    parsedEvent.id = result.insertedId.toHexString();
                    return parsedEvent as IEvent;
                });
        });
    }
}
