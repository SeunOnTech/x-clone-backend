import { EventEmitter } from "events";
import { Response } from "express";

export interface StreamEvent {
  id: string;
  type: string;
  timestamp: string;
  payload: any;
}

class EventStreamService extends EventEmitter {
  private clients: Response[] = [];

  addClient(res: Response) {
    this.clients.push(res);
  }

  removeClient(res: Response) {
    this.clients = this.clients.filter(c => c !== res);
  }

  broadcast(event: StreamEvent) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      client.write(data);
    }
    this.emit("event", event);
  }

  getClientCount() {
    return this.clients.length;
  }
}

export const eventStream = new EventStreamService();
