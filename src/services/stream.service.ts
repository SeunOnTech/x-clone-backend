// ============================================================================
// FILE 1: src/services/stream.service.ts
// Manages connected stream clients and broadcasts posts
// ============================================================================

import { Response } from "express";

type StreamClient = {
  id: string;
  res: Response;
};

const clients: StreamClient[] = [];

export const StreamService = {
  addClient(res: Response) {
    const id = Date.now().toString();
    clients.push({ id, res });
    console.log(`✅ Stream client connected: ${id}, total ${clients.length}`);

    res.on("close", () => {
      console.log(`❌ Stream client disconnected: ${id}`);
      const index = clients.findIndex(c => c.id === id);
      if (index !== -1) clients.splice(index, 1);
    });
  },

  broadcast(data: any) {
    if (clients.length === 0) return;
    
    const json = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach(client => {
      try {
        client.res.write(json);
      } catch (err) {
        console.error(`Failed to write to client ${client.id}:`, err);
      }
    });
    
    console.log(`📡 Broadcasted to ${clients.length} client(s)`);
  },

  getClientCount() {
    return clients.length;
  }
};
