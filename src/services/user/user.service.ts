import { Service, Autowired } from "express-utils";
import { IUserService } from "./i-user.service";
import fetch from "node-fetch";
import { Unauthorized } from "http-errors";
import { IUser } from "../../interfaces/i-user";
import { IMongoService } from "../mongo/i-mongo.service";
import { Db, Cursor, FilterQuery } from "mongodb";
import { IMongoItem } from "../../interfaces/i-mongo-item";

@Service("userService")
export default class UserService implements IUserService {

    @Autowired()
    private mongoService: IMongoService;

    private userCache = {};

    public onInit(): void {
        console.log(this.constructor.name, "initialised");

        setTimeout(() => this.spruceCache(), 60000);
    }

    spruceCache() {
        const cutOffTime = Date.now() - (1000 * 60 * 5);
        Object.keys(this.userCache).forEach(key => {
            if (this.userCache[key].time < cutOffTime) {
                delete this.userCache[key];
            }
        });
        setTimeout(() => this.spruceCache(), 60000);
    }

    private updateCache(user) {
        const keys = Object.keys(this.userCache)
        for (const key of keys) {
            if (this.userCache[key].user.id === user.id) {
                this.userCache[key] = { user, time: Date.now() };
                return;
            }
        };
    }

    async getUser(token: string): Promise<IUser> {
        if (this.userCache[token]) {
            return this.userCache[token].user;
        }
        const response = await fetch("https://team-achievement-tracker.netlify.com/.netlify/identity/user", { headers: { Authorization: "Bearer " + token } });
        const json = await response.json();
        if (!response.ok) {
            throw new Unauthorized();
        }
        const user = {
            id: json.id,
            email: json.email,
            firstName: json.user_metadata.firstName,
            lastName: json.user_metadata.lastName,
            name: json.user_metadata.full_name,
            isTeamLead: json.user_metadata.isTeamLead,
            teamLead: null,
        }
        const dbUser = await this.readUserFromDb(user.id);
        if (dbUser) {
            Object.assign(user, dbUser);
        }
        this.userCache[token] = { user, time: Date.now() };
        return user;
    }

    private readUserFromDb(id: string, getTeamLead = true): Promise<IUser> {
        return this.mongoService.run((db: Db) => this.doReadUserFromDb(db, id, getTeamLead));
    }

    private doReadUserFromDb(db: Db, id: string, getTeamLead = true): Promise<IUser> {
        const query: any = {
            _id: id
        };

        return db.collection("users").findOne(query)
            .then(async (user: IMongoItem<IUser>) => {
                if (!user) return null;
                user.id = user._id;
                delete user._id;
                if (user.teamLead && getTeamLead) {
                    user.teamLead = await this.doReadUserFromDb(db, user.teamLead as string, false);
                }
                return user;
            })

    }

    createUser(user: IUser): Promise<IUser> {
        return this.mongoService.run((db: Db) => {

            const dbUser = Object.assign({}, user, { _id: user.id });
            delete dbUser.id;

            return db.collection("users").insertOne(dbUser)
                .then(() => user);
        });
    }

    updateUser(user: IUser, updates: IUser): Promise<IUser> {
        return this.mongoService.run(async (db: Db) => {
            const query: any = {
                _id: user.id
            };

            const dbUser: IUser = {} as IUser;

            let firstName = user.firstName;
            if (updates.firstName && updates.firstName.trim()) {
                firstName = updates.firstName.trim();
                dbUser.firstName = firstName;
            }

            let lastName = user.lastName;
            if (updates.lastName && updates.lastName.trim()) {
                lastName = updates.lastName.trim();
                dbUser.lastName = lastName;
            }

            const fullName = `${firstName} ${lastName}`;
            if (user.name !== fullName) {
                dbUser.name = fullName;
            }
            let isTeamLead = user.isTeamLead;
            if (updates.isTeamLead !== undefined) {
                dbUser.isTeamLead = !!updates.isTeamLead;
                isTeamLead = dbUser.isTeamLead;
                if (!isTeamLead) {
                    dbUser.teamLead = null;
                }
            }

            let loadedTeamLead = null
            if (!isTeamLead && updates.teamLead !== undefined) {
                if (updates.teamLead && typeof updates.teamLead === "string") {
                    const teamLead = await this.doReadUserFromDb(db, updates.teamLead as string, false);
                    dbUser.teamLead = teamLead && teamLead.isTeamLead && teamLead.id !== user.id ? teamLead.id : null;
                    if (dbUser.teamLead) {
                        loadedTeamLead = teamLead;
                    }
                } else {
                    dbUser.teamLead = null;
                }
            }

            if (Object.keys(dbUser).length === 0) {
                return;
            }

            return db.collection("users").updateOne(query, { $set: dbUser })
                .then(() => {
                    const updatedUser = Object.assign({}, user, dbUser);
                    if (loadedTeamLead) {
                        updatedUser.teamLead = loadedTeamLead;
                    }
                    this.updateCache(updatedUser);
                    return updatedUser;
                });
        });
    }

    public getTeam(user: IUser): Promise<IUser[]> {
        const teamLeadId = user.isTeamLead ? user.id : ((user.teamLead || {}) as IUser).id;
        if (!teamLeadId) {
            return Promise.resolve([]);
        }
        return this.mongoService.run((db: Db) => {
            const query: any = {
                $or: [{ _id: teamLeadId }, { teamLead: teamLeadId }]
            };
            return this.getUsers(db, query);
        });
    }

    public isInTeam(teamLeadId: string, userId: string): Promise<boolean> {
        return this.mongoService.run(async (db: Db) => {
            const query: any = {
                $and: [
                    { $or: [{ _id: teamLeadId }, { teamLead: teamLeadId }] },
                    { _id: userId }
                ]
            };
            const count = await db.collection("users").countDocuments(query, {});
            return count > 0;
        });
    }

    public getTeamLeads(): Promise<IUser[]> {
        return this.mongoService.run((db: Db) => {
            const query: any = {
                isTeamLead: true
            };
            return this.getUsers(db, query);
        });
    }

    private getUsers(db: Db, query: FilterQuery<any>): Promise<IUser[]> {
        const result: Cursor<IUser> = db.collection("users").find(query);
        return new Promise<IUser[]>((res, rej) => {
            const returnList: IUser[] = [];
            result.forEach((user: IMongoItem<IUser>) => {
                user.id = user._id;
                delete user._id;
                returnList.push(user);
            }, (err) => {
                err ? rej(err) : res(returnList);
            });
        });
    }
}
