import { EventEmitter } from "events";

export interface StreamEvent {
  id: string;
  type: string;
  timestamp: string;
  payload: any;
}

export const eventBus = new EventEmitter();
