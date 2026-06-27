import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
  // Unauthenticated liveness probe — used to confirm the API is up
  // (turbo dev gate, container healthchecks later).
  @Get()
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        service: { type: "string", example: "@unitko/api" },
      },
    },
  })
  check() {
    return { status: "ok", service: "@unitko/api" };
  }
}
