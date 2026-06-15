import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
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

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  new Logger("Bootstrap").log(`@unitko/api listening on http://localhost:${port}`);
}

void bootstrap();
