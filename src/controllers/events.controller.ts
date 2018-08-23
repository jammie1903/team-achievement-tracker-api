import { Controller, Autowired, IOnInit, QueryParam, Post, RequestBody } from "express-utils";
import { IUser } from "../interfaces/i-user";
import { BadRequest} from "http-errors";
import TokenContents from "../decorators/token.decorator";
import { IEventService } from "../services/event/i-event.service";
import { IEvent } from "../interfaces/i-event";
import { IApproveEventResponse } from "../interfaces/i-approve-event-response";

@Controller("/event")
export default class EventsController implements IOnInit {

    @Autowired()
    public eventService: IEventService;

    public onInit(): void {
        console.log(this.constructor.name, "initialised");
    }

    @Post("/")
    public createEvent(@TokenContents() user: IUser, @RequestBody() eventBody: IEvent): Promise<IEvent> {
        return this.eventService.addEvent(user, eventBody);
    }

    @Post("/approve")
    public approveEvent(@TokenContents() user: IUser, @QueryParam("id") eventId: string): Promise<IApproveEventResponse> {
        if(!eventId || !eventId.trim) {
            throw new BadRequest("'id' query parameter is required");
        }
        return this.eventService.approveEvent(user, eventId);
    }
}
