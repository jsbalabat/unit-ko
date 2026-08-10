import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { TENANT_SESSION_COOKIE } from "./auth/tenant-session";
import type { Env } from "./config/env";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Read the tenant session cookie on incoming requests.
  app.use(cookieParser());

  // Browser calls the API cross-origin and must send the session cookie, so we
  // allow credentials from exactly the web origin (never a wildcard).
  app.enableCors({
    origin: config.get("WEB_ORIGIN", { infer: true }),
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  // Browsable OpenAPI docs, dev only — they expose the full route surface, so
  // never mount them in production. Routes are auto-introspected; request/response
  // schemas are attached per-route from the @unitko/shared Zod contract.
  if (process.env.NODE_ENV !== "production") {
    const docConfig = new DocumentBuilder()
      .setTitle("unitko API")
      .setDescription(
        "Landlord endpoints use a Bearer JWT (Supabase Auth); tenant endpoints use the session cookie.",
      )
      .setVersion("0.1.0")
      .addBearerAuth(undefined, "landlord-jwt")
      .addCookieAuth(TENANT_SESSION_COOKIE, undefined, "tenant-session")
      .build();
    const document = SwaggerModule.createDocument(app, docConfig);
    SwaggerModule.setup("docs", app, document);
  }

  const port = config.get("PORT", { infer: true });
  // Bind all interfaces (not Node's default IPv6-only `::`) so container
  // platforms that probe for an open port over IPv4 can detect and route to us.
  await app.listen(port, "0.0.0.0");
  const logger = new Logger("Bootstrap");
  logger.log(`@unitko/api listening on http://localhost:${port}`);
  if (process.env.NODE_ENV !== "production") {
    logger.log(`API docs at http://localhost:${port}/docs`);
  }
}

void bootstrap();
