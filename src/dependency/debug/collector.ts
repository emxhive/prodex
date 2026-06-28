import { ResolutionDebugEvent } from "./types";

export class DebugCollector {
	private events: ResolutionDebugEvent[] = [];

	emit(category: string, data: Record<string, any> = {}, message?: string): ResolutionDebugEvent {
		const event: ResolutionDebugEvent = {
			category,
			timestamp: Date.now(),
			data,
			message
		};
		this.events.push(event);
		return event;
	}

	getEvents(): ResolutionDebugEvent[] {
		return [...this.events];
	}

	clear(): void {
		this.events = [];
	}
}
