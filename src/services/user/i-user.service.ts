import { IUser } from "../../interfaces/i-user";

export interface IUserService {
    getUser(token: string): Promise<IUser>;
    createUser(user: IUser): Promise<IUser>;
    updateUser(user: IUser, updates: IUser): Promise<IUser>;
    getTeamLeads(): Promise<IUser[]>;
}