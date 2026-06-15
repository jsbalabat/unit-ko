import { Global, Module } from "@nestjs/common";
import { SupabaseService } from "./supabase.service";

// Global so any repository can inject SupabaseService without re-importing the
// module. There is exactly one service-role client for the whole process.
@Global()
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
