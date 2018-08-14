import { Controller, Autowired, IOnInit, Get, QueryParam, Post } from "express-utils";
import { IUser } from "../interfaces/i-user";
import TokenContents from "../decorators/token.decorator";
import { IUserService } from "../services/user/i-user.service";

@Controller("/users")
export default class UsersController implements IOnInit {

    @Autowired()
    public userService: IUserService;

    public onInit(): void {
        console.log(this.constructor.name, "initialised");
    }

    @Get("/team-leads")
    public getTeamLeads(@TokenContents() token: IUser): Promise<IUser[]> {
        return this.userService.getTeamLeads();
    }

}
