export interface IUser {
    id: string,
    email: string,
    firstName: string,
    lastName: string,
    name: string,
    isTeamLead: boolean,
    teamLead: string | IUser;
}
