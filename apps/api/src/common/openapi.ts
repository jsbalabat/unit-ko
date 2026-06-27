import type { OpenAPIObject } from "@nestjs/swagger";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// @nestjs/swagger doesn't export SchemaObject directly (and nodenext blocks the
// deep path), so reach it through the publicly-exported OpenAPIObject: the values
// of components.schemas are exactly the `SchemaObject | ReferenceObject` that
// @ApiBody / @ApiResponse `schema` accepts.
type OpenApiSchema = NonNullable<
  NonNullable<OpenAPIObject["components"]>["schemas"]
>[string];

// Render a @unitko/shared Zod schema as an OpenAPI 3 schema so the docs are
// generated from the one Zod contract and can't drift from validation.
// `$refStrategy: "none"` inlines subschemas (OpenAPI resolves $refs under
// #/components, which these route-level schemas don't populate).
export function zodSchema(schema: ZodTypeAny): OpenApiSchema {
  return zodToJsonSchema(schema, {
    target: "openApi3",
    $refStrategy: "none",
  }) as OpenApiSchema;
}

export function zodArraySchema(schema: ZodTypeAny): OpenApiSchema {
  return { type: "array", items: zodSchema(schema) };
}
