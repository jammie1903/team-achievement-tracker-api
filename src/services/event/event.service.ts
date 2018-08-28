import { Service, Autowired } from "express-utils";
import { IEventService } from "./i-event.service";
import { BadRequest, Forbidden, NotFound } from "http-errors";
import { IUser } from "../../interfaces/i-user";
import { IMongoService } from "../mongo/i-mongo.service";
import { Db, Cursor, ObjectID } from "mongodb";
import { IMongoItem } from "../../interfaces/i-mongo-item";
import { IEvent } from "../../interfaces/i-event";
import { IUserService } from "../user/i-user.service";
import { IApproveEventResponse } from "../../interfaces/i-approve-event-response";
import { IEventComment } from "../../interfaces/i-event-comment";
import { IEventCounts } from "../../interfaces/i-event-counts";

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
        return this.getEventsForUsers(user.id, users.map(user => user.id));
    }

    public async getEventsForUser(user: IUser, userId: string) {
        if (user.id !== userId) {
            const teamLeadId = user.isTeamLead ? user.id : ((user.teamLead || {}) as IUser).id;
            if (!teamLeadId || !await this.userService.isInTeam(teamLeadId, userId)) {
                throw new NotFound("No user by this id exists or you do not have access to them");
            }
        }
        return this.getEventsForUsers(userId, [userId]);
    }

    private getEventsForUsers(userId: string, userIds: string[]) {
        return this.mongoService.run((db: Db) =>
            db.collection("events").aggregate([
                {
                    $match: {
                        user: { $in: userIds }
                    }
                },
                {
                    $lookup: {
                        from: "eventComments",
                        localField: "_id",
                        foreignField: "eventId",
                        as: "comments"
                    }
                },
                {
                    $addFields: {
                        commentByUser: {
                            $in: [userId, "$comments.user"]
                        },
                        comments: { $size: "$comments" },
                        likedByUser: {
                            $in: [userId, "$likes"]
                        },
                        likes: { $size: "$likes" },
                        id: "$_id"
                    }
                },
                {
                    $project: {
                        _id: 0
                    }
                },
                {
                    $sort: {
                        time: -1
                    }
                }
            ]).toArray()
        );
    }

    public getEventCount(user: IUser, to: number, from: number): Promise<IEventCounts[]> {

        const $match: any = {
            user: { $eq: user.id },

        };
        if (to || from) {
            $match.time = {};
            if (to) {
                $match.time.$lt = to;
            } if (from) {
                $match.time.$gte = from;
            }
        }
        const day = 1000 * 60 * 60 * 24;

        return this.mongoService.run((db: Db) =>
            db.collection("events").aggregate([
                {
                    $match
                },
                {
                    $addFields: {
                        day: { $multiply: [{ $floor: { $divide: ["$time", day] } }, day] }
                    }
                },
                {
                    $group: {
                        _id: { day: "$day", eventType: "$eventType" },
                        count: { $sum: 1 },
                        approvedCount: { $sum: { $cond: ["$approved", 1, 0] } }
                    }
                },
                {
                    $group: {
                        _id: "$_id.eventType",
                        days: { $push: { day: "$_id.day", count: '$count', approvedCount: '$approvedCount' } }
                    }
                },
                {
                    $addFields: {
                        eventType: "$_id"
                    }
                },
                {
                    $project: {
                        _id: 0
                    }
                },
            ]).toArray()
        );
    }

    public approveEvent(user: IUser, eventId: string): Promise<IApproveEventResponse> {
        if (!user.isTeamLead) {
            throw new Forbidden("You do not have permission to approve events");
        }

        if (!eventId || !eventId.trim) {
            throw new BadRequest("'eventId' must be provided in body");
        }

        return this.mongoService.run(async (db: Db) => {
            const event = await db.collection("events").findOne({ _id: new ObjectID(eventId.trim()) })

            if (!event || !await this.userService.isInTeam(user.id, event.user)) {
                throw new NotFound("This event could not be found or you do not have access to it");
            }

            if (event.approved) {
                return {
                    message: "Event already approved",
                    approved: event.approved,
                }
            }
            const approved = Date.now();
            await db.collection("events").updateOne({ _id: eventId }, { $set: { approved, approvedBy: user.id } });
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
            time,
            likes: [],
        };

        return this.mongoService.run((db: Db) => {
            return db.collection("events").insertOne(parsedEvent)
                .then(result => {
                    parsedEvent.id = result.insertedId.toHexString();
                    return parsedEvent as IEvent;
                });
        });
    }

    public addEventComment(user: IUser, eventId: string, text: string): Promise<IEventComment> {
        if (!eventId || !eventId.trim) {
            throw new BadRequest("'eventId' must be provided in body");
        }
        if (!text || !text.trim) {
            throw new BadRequest("'text' must be provided in body");
        }
        return this.mongoService.run(async (db: Db) => {
            const event = await db.collection("events").findOne({ _id: new ObjectID(eventId.trim()) })

            if (!event || !await this.userService.isInTeam(user.id, event.user)) {
                throw new NotFound("This event could not be found or you do not have access to it");
            }

            const comment: Partial<IEventComment> = {
                eventId: new ObjectID(eventId.trim()),
                text: text.trim(),
                time: Date.now(),
                user: user.id,
            }

            return db.collection("eventComments").insertOne(comment)
                .then(result => {
                    comment.id = result.insertedId.toHexString();
                    return comment as IEventComment;
                });
        });
    }

    public getEventComments(user: IUser, eventId: string): Promise<IEventComment[]> {
        if (!eventId || !eventId.trim) {
            throw new BadRequest("'eventId' must be provided");
        }

        return this.mongoService.run(async (db: Db) => {
            const event = await db.collection("events").findOne({ _id: new ObjectID(eventId.trim()) })
            if (!event || !await this.userService.isInTeam(user.id, event.user)) {
                throw new NotFound("This event could not be found or you do not have access to it");
            }

            const result: Cursor<IEventComment> = db.collection("eventComments").find({
                eventId
            });

            return new Promise<IEventComment[]>((res, rej) => {
                const returnList: IEventComment[] = [];
                result.forEach((comment: IMongoItem<IEventComment>) => {
                    comment.id = comment._id;
                    delete comment._id;
                    returnList.push(comment);
                }, (err) => {
                    err ? rej(err) : res(returnList);
                });
            });

        });
    }

    public async setLikeEvent(user: IUser, eventId: string, like: boolean): Promise<void> {
        if (!eventId || !eventId.trim) {
            throw new BadRequest("'eventId' must be provided");
        }

        return this.mongoService.run(async (db: Db) => {

            const event = await db.collection("events").findOne({ _id: new ObjectID(eventId.trim()) })
            if (!event || !await this.userService.isInTeam(user.id, event.user)) {
                throw new NotFound("This event could not be found or you do not have access to it");
            }
            const action = like ? "$addToSet" : "$pull";
            await db.collection("events").updateOne(
                {
                    _id: event._id
                },
                {
                    [action]: {
                        likes: user.id
                    }
                }
            )
        });
    }
}
