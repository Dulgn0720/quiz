import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Socket.IO server with CORS taken from the environment and the Redis
 * adapter, so broadcasts reach clients connected to any API instance.
 */
export class GameIoAdapter extends IoAdapter {
  private adapter?: ReturnType<typeof createAdapter>;

  constructor(
    app: INestApplicationContext,
    private readonly corsOrigins: string[],
  ) {
    super(app);
  }

  async connectToRedis(url: string): Promise<void> {
    const pub = new Redis(url, { lazyConnect: true });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    this.adapter = createAdapter(pub, sub, { key: 'quiz:io' });
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigins },
      // Payloads are small JSON messages; refuse anything large.
      maxHttpBufferSize: 64 * 1024,
    }) as Server;
    if (this.adapter) server.adapter(this.adapter);
    return server;
  }
}
