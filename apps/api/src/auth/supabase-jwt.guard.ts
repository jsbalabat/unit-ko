import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Request } from "express";
import type { Env } from "../config/env";

// Verifies the landlord's Supabase Auth access token. Supabase signs these with
// asymmetric keys (ES256) and publishes the public keys at the project's JWKS
// endpoint, so we verify against that — no shared secret. On success it attaches
// { id, email } from the token's `sub`/`email` claims (the trusted identity);
// ownership checks downstream compare against this id, never a client value.
@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseJwtGuard.name);
  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(config: ConfigService<Env, true>) {
    const baseUrl = config
      .get("SUPABASE_URL", { infer: true })
      .replace(/\/+$/, "");
    // e.g. http://127.0.0.1:54321/auth/v1 (local) or https://<ref>.supabase.co/auth/v1
    this.issuer = `${baseUrl}/auth/v1`;
    // The local stack's JWKS route sits behind Kong's apikey gate; send the
    // service-role key (server-side only) so the fetch is accepted. It's a
    // harmless extra header if the endpoint is public.
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
      {
        headers: {
          apikey: config.get("SUPABASE_SERVICE_ROLE_KEY", { infer: true }),
        },
      },
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = header.slice("Bearer ".length).trim();

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: "authenticated",
      });
      if (!payload.sub) {
        throw new UnauthorizedException("Token has no subject");
      }

      req.landlord = {
        id: payload.sub,
        email: typeof payload.email === "string" ? payload.email : undefined,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      // Surface the real cause (JWKS fetch, signature, issuer/audience) in the
      // server log while keeping the client response generic.
      this.logger.warn(
        `Landlord token verification failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
