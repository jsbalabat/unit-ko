import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReminderDispatcher } from "./reminder-dispatcher.service";
import { RemindersController } from "./reminders.controller";
import { RemindersService } from "./reminders.service";
import { RemindersRepository } from "./reminders.repository";

@Module({
  imports: [AuthModule],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersRepository, ReminderDispatcher],
})
export class RemindersModule {}
