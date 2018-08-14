import { Service, Autowired } from "express-utils";
import { IUserService } from "./i-user.service";
import fetch from "node-fetch";
import { IUser } from "../../interfaces/i-user";
import { IMongoService } from "../mongo/i-mongo.service";
import { Db, Cursor } from "mongodb";
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
        for(const key of keys) {
            if (this.userCache[key].user.id === user.id) {
                this.userCache[key] = {user, time: Date.now()};
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
        const user = {
            id: json.id,
            email: json.email,
            firstName: json.user_metadata.firstName,
            lastName: json.user_metadata.lastName,
            name: json.user_metadata.full_name,
            isTeamLead: json.user_metadata.isTeamLead,
            teamLead: null,
        }
        const dbUser = this.readUserFromDb(user.id);
        if (dbUser) {
            Object.assign(user, dbUser);
        }
        this.userCache[token] = {user, time: Date.now()};
        return user;
    }

    private readUserFromDb(id: string, getTeamLead = true): Promise<IUser> {
        const query: any = {
            _id: id
        };
        return this.mongoService.run((db: Db) =>
            db.collection("users").findOne(query)
                .then(async (user: IMongoItem<IUser>) => {
                    if (!user) return null;
                    user.id = user._id;
                    delete user._id;
                    if (user.teamLead && getTeamLead) {
                        user.teamLead = await this.readUserFromDb(user.teamLead as string, false);
                    }
                    return user;
                })
        );

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
            if(updates.firstName && updates.firstName.trim()) {
                firstName = updates.firstName.trim();
                dbUser.firstName = firstName;
            }

            let lastName = user.lastName;
            if(updates.lastName && updates.lastName.trim()) {
                lastName = updates.lastName.trim();
                dbUser.lastName = lastName;
            }

            const fullName = `${firstName} ${lastName}`;
            if(user.name !== fullName) {
                dbUser.name = fullName;
            }

            if (updates.isTeamLead !== undefined) {
                dbUser.isTeamLead = !!updates.isTeamLead;
            }

            if (updates.teamLead !== undefined) {
                if (updates.teamLead && typeof updates.teamLead === "string") {
                    const teamLead = await this.readUserFromDb(updates.teamLead as string);
                    dbUser.teamLead = teamLead && teamLead.isTeamLead && teamLead.id !== user.id ? teamLead : null;
                } else {
                    dbUser.teamLead = null;
                }
            }

            if(Object.keys(dbUser).length === 0) {
                return;
            }

            return db.collection("users").updateOne(query, { $set: dbUser })
                .then(() => {
                   const updatedUser = Object.assign({}, user, dbUser);
                   this.updateCache(updatedUser);
                   return updatedUser;
                });
        });
    }

    getTeamLeads(): Promise<IUser[]> {
        return this.mongoService.run((db: Db) => {
            const query: any = {
                isTeamLead: true
            };

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
        });
    }
}
