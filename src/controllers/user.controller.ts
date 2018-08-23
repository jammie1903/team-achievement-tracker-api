import { Controller, Autowired, IOnInit, Get, QueryParam, Post, Put, RequestBody } from "express-utils";
import { IUser } from "../interfaces/i-user";
import TokenContents from "../decorators/token.decorator";
import { IUserService } from "../services/user/i-user.service";
import { IEventService } from "../services/event/i-event.service";
import { IEvent } from "../interfaces/i-event";

@Controller("/user")
export default class UserController implements IOnInit {

    @Autowired()
    public userService: IUserService;

    @Autowired()
    public eventService: IEventService;

    public onInit(): void {
        console.log(this.constructor.name, "initialised");
    }

    @Get("/")
    public getUserDetails(@TokenContents() user: IUser): IUser {
        return user;
    }

    @Post("/")
    public newUser(@TokenContents() user: IUser): Promise<IUser> {
        return this.userService.createUser(user);
    }

    @Put("/")
    public updateUser(@TokenContents() user: IUser, @RequestBody() updates: IUser): Promise<IUser> {
        return this.userService.updateUser(user, updates);
    }

    @Get("/events")
    public getUserEvents(@TokenContents() user: IUser): Promise<IEvent[]> {
        return this.eventService.getEventsForTeam(user);
    }

}
