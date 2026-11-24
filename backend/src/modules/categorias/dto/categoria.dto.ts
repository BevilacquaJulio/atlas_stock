import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Base sem `.default()`: no Zod 4, `.partial()` aplicaria os defaults no PATCH.
const categoriaBaseSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  descricao: z.string().trim().max(2000).optional().nullable(),
  ativo: z.boolean(),
});

export const createCategoriaSchema = categoriaBaseSchema.extend({
  ativo: z.boolean().default(true),
});
export class CreateCategoriaDto extends createZodDto(createCategoriaSchema) {}

export const updateCategoriaSchema = categoriaBaseSchema.partial();
export class UpdateCategoriaDto extends createZodDto(updateCategoriaSchema) {}

export type CreateCategoriaInput = z.infer<typeof createCategoriaSchema>;
export type UpdateCategoriaInput = z.infer<typeof updateCategoriaSchema>;
