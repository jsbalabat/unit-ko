import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { ZodError, ZodType, ZodTypeDef } from "zod";

// Validate-at-the-boundary: controllers annotate a body/query param with
// `new ZodValidationPipe(schema)` and downstream code receives the parsed,
// typed value. The schema lives in @unitko/shared so FE and BE share one
// contract. Usage: @Body(new ZodValidationPipe(tenantLoginSchema)) dto: TenantLoginDto
//
// Generic over output (TOut) AND input (TIn): schemas that transform or apply
// defaults legitimately have a different input type than output type (e.g. a
// "true"/"false" query string parsed to boolean), so we must not force them equal.
@Injectable()
export class ZodValidationPipe<TOut, TIn = unknown>
  implements PipeTransform<unknown, TOut>
{
  constructor(private readonly schema: ZodType<TOut, ZodTypeDef, TIn>) {}

  transform(value: unknown): TOut {
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
