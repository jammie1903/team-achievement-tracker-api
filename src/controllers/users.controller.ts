import { Controller, Autowired, IOnInit, Get, QueryParam, Post } from "express-utils";
import { IUser } from "../interfaces/i-user";
import TokenContents from "../decorators/token.decorator";
import { IUserService } from "../services/user/i-user.service";
import { IEventService } from "../services/event/i-event.service";
import { IEvent } from "../interfaces/i-event";

@Controller("/users")
export default class UsersController implements IOnInit {

    @Autowired()
    public userService: IUserService;

    @Autowired()
    public eventService: IEventService;


    public onInit(): void {
        console.log(this.constructor.name, "initialised");
    }

    @Get("/team-leads")
    public getTeamLeads(@TokenContents() token: IUser): Promise<IUser[]> {
        return this.userService.getTeamLeads();
    }


    @Get("/team")
    public getTeam(@TokenContents() user: IUser): Promise<IUser[]> {
        return this.userService.getTeam(user);
    }

    @Get("/team/events")
    public getTeamEvents(@TokenContents() user: IUser): Promise<IEvent[]> {
        return this.eventService.getEventsForTeam(user);
    }

}
