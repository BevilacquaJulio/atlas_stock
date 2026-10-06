import { ZodValidationException } from 'nestjs-zod';
import type { ZodTypeAny, z } from 'zod';

/**
 * Valida os argumentos do resolver com o MESMO schema Zod usado pelo REST,
 * produzindo o mesmo erro (VALIDATION_ERROR) e os mesmos limites.
 */
export function parseArgs<S extends ZodTypeAny>(
  schema: S,
  args: unknown,
): z.infer<S> {
  const result = schema.safeParse(args);
  if (!result.success) throw new ZodValidationException(result.error);
  return result.data;
}
