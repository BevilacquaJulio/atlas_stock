import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  isValidCpfCnpj,
  onlyDigits,
} from '../../../common/validators/documents';

// Base sem `.default()`: no Zod 4, `.partial()` aplicaria os defaults no PATCH.
const fornecedorBaseSchema = z.object({
  nomeRazaoSocial: z.string().trim().min(2).max(200),
  cpfCnpj: z
    .string()
    .transform(onlyDigits)
    .refine(isValidCpfCnpj, {
      message: 'CPF/CNPJ inválido.',
    }),
  telefone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(180).optional().or(z.literal('')).nullable(),
  ativo: z.boolean(),
});

export const createFornecedorSchema = fornecedorBaseSchema.extend({
  ativo: z.boolean().default(true),
});
export class CreateFornecedorDto extends createZodDto(createFornecedorSchema) {}

export const updateFornecedorSchema = fornecedorBaseSchema.partial();
export class UpdateFornecedorDto extends createZodDto(updateFornecedorSchema) {}

export type CreateFornecedorInput = z.infer<typeof createFornecedorSchema>;
export type UpdateFornecedorInput = z.infer<typeof updateFornecedorSchema>;
