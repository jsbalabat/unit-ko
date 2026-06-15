import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BillingController } from "./billing.controller";
import { PaymentsController } from "./payments.controller";
import { BillingService } from "./billing.service";
import { PaymentsService } from "./payments.service";
import { BillingRepository } from "./billing.repository";
import { PaymentsRepository } from "./payments.repository";

// Billing reads + payment writes live together: recording a payment refreshes a
// billing entry, so PaymentsService reuses BillingService to return it.
@Module({
  imports: [AuthModule],
  controllers: [BillingController, PaymentsController],
  providers: [
    BillingService,
    PaymentsService,
    BillingRepository,
    PaymentsRepository,
  ],
  exports: [BillingService], // reused by the tenant dashboard
})
export class BillingModule {}
