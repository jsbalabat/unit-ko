import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ResponsesController } from "./responses.controller";
import { TenantResponsesController } from "./tenant-responses.controller";
import { ResponsesService } from "./responses.service";
import { ResponsesRepository } from "./responses.repository";

// One service/repository serves both sides of the tenant bill-response flow;
// AuthModule supplies SupabaseJwtGuard (landlord) and TenantSessionGuard (tenant).
@Module({
  imports: [AuthModule],
  controllers: [ResponsesController, TenantResponsesController],
  providers: [ResponsesService, ResponsesRepository],
})
export class ResponsesModule {}
