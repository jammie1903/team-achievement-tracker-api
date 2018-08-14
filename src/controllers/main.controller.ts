import { Controller, Get, IOnInit } from "express-utils";

@Controller("/")
export default class MainController implements IOnInit {

    public onInit(): void {
        console.log(this.constructor.name, "initialised");
    }

    @Get("/")
    public ping(): string {
        return "ping";
    }
}
