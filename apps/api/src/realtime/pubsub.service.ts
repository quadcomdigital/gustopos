import { Injectable, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { getRedisUrl } from "../config/redis.config";

@Injectable()
export class RealtimePubSubService implements OnModuleInit, OnApplicationShutdown {
  private readonly channel = "gustopos:realtime";
  private readonly instanceId = `${process.pid}-${Math.random().toString(36).slice(2)}`;

  private publisher!: Redis;
  private subscriber!: Redis;

  private listeners = new Set<(event: string, payload: unknown) => void>();

  async onModuleInit(): Promise<void> {
    const redisUrl = getRedisUrl();
    this.publisher = new Redis(redisUrl, { lazyConnect: false });
    this.subscriber = new Redis(redisUrl, { lazyConnect: false });

    await this.subscriber.subscribe(this.channel);
    this.subscriber.on("message", (_channel, raw) => {
      const parsed = JSON.parse(raw) as {
        source: string;
        event: string;
        payload: unknown;
      };

      if (parsed.source === this.instanceId) {
        return;
      }

      for (const listener of this.listeners) {
        listener(parsed.event, parsed.payload);
      }
    });
  }

  onMessage(listener: (event: string, payload: unknown) => void): void {
    this.listeners.add(listener);
  }

  async publish(event: string, payload: unknown): Promise<void> {
    const message = JSON.stringify({
      source: this.instanceId,
      event,
      payload,
    });

    await this.publisher.publish(this.channel, message);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([this.publisher?.quit(), this.subscriber?.quit()]);
  }
}
