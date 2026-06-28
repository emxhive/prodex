export interface ResolutionDebugEvent {
	category: string;
	timestamp: number;
	data: Record<string, any>;
	message?: string;
}
