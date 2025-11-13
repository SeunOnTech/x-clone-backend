import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { eventStream, StreamEvent } from "../services/event-stream.service";

export class StreamAPIController {
  public streamLive = (req: Request, res: Response): void => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    eventStream.addClient(res);
    console.log(`🔗 New SSE client connected (${eventStream.getClientCount()} total)`);

    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 10000);

    req.on("close", () => {
      clearInterval(heartbeat);
      eventStream.removeClient(res);
      console.log(`❌ Client disconnected (${eventStream.getClientCount()} total)`);
    });
  };

  public emitEvent = (req: Request, res: Response): void => {
    const { type, payload } = req.body;
    if (!type) {
      res.status(400).json({ error: "type is required" });
      return;
    }


    const event: StreamEvent = {
      id: uuidv4(),
      type,
      timestamp: new Date().toISOString(),
      payload,
    };

    console.log("📢 Broadcasting event:", event);
    console.log("Clients connected:", eventStream.getClientCount());

    eventStream.broadcast(event);
    res.json({ ok: true, event });
  };
}
