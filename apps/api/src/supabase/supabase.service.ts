import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@unitko/db";
import type { Env } from "../config/env";

// The single point where the service-role key touches code. This client bypasses
// RLS, so it must NEVER be exposed beyond the API process. All ownership/access
// checks are enforced in the service layer; RLS is kept on as a backstop.
@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient<Database>;

  constructor(config: ConfigService<Env, true>) {
    this.client = createClient<Database>(
      config.get("SUPABASE_URL", { infer: true }),
      config.get("SUPABASE_SERVICE_ROLE_KEY", { infer: true }),
      {
        auth: {
          // A server-side, stateless client: no session to persist or refresh.
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  // Repositories use this typed client; nothing else should import supabase-js.
  get db(): SupabaseClient<Database> {
    return this.client;
  }
}
