import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RemindersController } from "./reminders.controller";
import { RemindersService } from "./reminders.service";
import { RemindersRepository } from "./reminders.repository";

@Module({
  imports: [AuthModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersRepository],
})
export class RemindersModule {}
