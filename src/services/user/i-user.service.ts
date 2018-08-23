import { IUser } from "../../interfaces/i-user";

export interface IUserService {
    getUser(token: string): Promise<IUser>;
    getTeam(user: IUser): Promise<IUser[]>;
    isInTeam(teamLeadId: string, userId: string): Promise<boolean>;
    createUser(user: IUser): Promise<IUser>;
    updateUser(user: IUser, updates: IUser): Promise<IUser>;
    getTeamLeads(): Promise<IUser[]>;
}