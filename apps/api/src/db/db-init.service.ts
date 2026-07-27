import { Injectable, OnModuleInit } from "@nestjs/common";
import { seedInitialData } from "./seed";

@Injectable()
export class DbInitService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await seedInitialData();
  }
}
