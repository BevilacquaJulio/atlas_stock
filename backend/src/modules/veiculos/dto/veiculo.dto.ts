import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// Base sem `.default()`: no Zod 4, `.partial()` aplicaria os defaults no PATCH.
const veiculoBaseSchema = z.object({
  clienteId: z.coerce.number().int().positive(),
  placa: z
    .string()
    .trim()
    .toUpperCase()
    .min(5)
    .max(10),
  marca: z.string().trim().min(1).max(80),
  modelo: z.string().trim().min(1).max(120),
  ano: z.string().trim().max(10).optional().nullable(),
  cor: z.string().trim().max(40).optional().nullable(),
  observacoesTecnicas: z.string().trim().max(2000).optional().nullable(),
  ativo: z.boolean(),
});

export const createVeiculoSchema = veiculoBaseSchema.extend({
  ativo: z.boolean().default(true),
});
export class CreateVeiculoDto extends createZodDto(createVeiculoSchema) {}

export const updateVeiculoSchema = veiculoBaseSchema.partial();
export class UpdateVeiculoDto extends createZodDto(updateVeiculoSchema) {}

export type CreateVeiculoInput = z.infer<typeof createVeiculoSchema>;
export type UpdateVeiculoInput = z.infer<typeof updateVeiculoSchema>;

export const veiculoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  clienteId: z.coerce.number().int().positive().optional(),
  ativo: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export class VeiculoQueryDto extends createZodDto(veiculoQuerySchema) {}
export type VeiculoQuery = z.infer<typeof veiculoQuerySchema>;
