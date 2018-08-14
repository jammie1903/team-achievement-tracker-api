import { Controller, Autowired, IOnInit, Get, QueryParam, Post, Put, RequestBody } from "express-utils";
import { IUser } from "../interfaces/i-user";
import TokenContents from "../decorators/token.decorator";
import { IUserService } from "../services/user/i-user.service";

@Controller("/user")
export default class UserController implements IOnInit {

    @Autowired()
    public userService: IUserService;

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

}
