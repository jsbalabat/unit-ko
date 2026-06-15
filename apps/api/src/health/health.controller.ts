import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  // Unauthenticated liveness probe — used to confirm the API is up
  // (turbo dev gate, container healthchecks later).
  @Get()
  check() {
    return { status: "ok", service: "@unitko/api" };
  }
}
