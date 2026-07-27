import { Injectable, OnApplicationShutdown } from "@nestjs/common";
import { pool } from "./client";

@Injectable()
export class DbShutdownService implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await pool.end();
  }
}
