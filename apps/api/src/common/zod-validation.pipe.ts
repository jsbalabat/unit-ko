import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { ZodError, ZodSchema } from "zod";

// Validate-at-the-boundary: controllers annotate a body/query param with
// `new ZodValidationPipe(schema)` and downstream code receives the parsed,
// typed value. The schema lives in @unitko/shared so FE and BE share one
// contract. Usage: @Body(new ZodValidationPipe(tenantLoginSchema)) dto: TenantLoginDto
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: "Validation failed",
          issues: error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }
      throw error;
    }
  }
}
