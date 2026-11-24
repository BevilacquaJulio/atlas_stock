import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  isValidCpfCnpj,
  onlyDigits,
} from '../../../common/validators/documents';

const optionalStr = (max: number) =>
  z.string().trim().max(max).optional().nullable();

// Base sem `.default()`: no Zod 4, `.partial()` aplica os defaults e um PATCH
// parcial reativaria o cadastro ou trocaria PJ por PF.
const clienteBaseSchema = z.object({
  tipo: z.enum(['PF', 'PJ']),
  nomeCompleto: z.string().trim().min(2).max(200),
  cpfCnpj: z
    .string()
    .transform(onlyDigits)
    .refine(isValidCpfCnpj, {
      message: 'CPF/CNPJ inválido.',
    }),
  telefone: z
    .string()
    .transform(onlyDigits)
    .optional()
    .nullable(),
  email: z.string().trim().email().max(180).optional().or(z.literal('')).nullable(),
  cep: optionalStr(15),
  rua: optionalStr(200),
  numero: optionalStr(20),
  complemento: optionalStr(120),
  bairro: optionalStr(120),
  cidade: optionalStr(120),
  estado: z.string().trim().length(2).optional().or(z.literal('')).nullable(),
  observacoes: optionalStr(2000),
  ativo: z.boolean(),
});

export const createClienteSchema = clienteBaseSchema.extend({
  tipo: z.enum(['PF', 'PJ']).default('PF'),
  ativo: z.boolean().default(true),
});
export class CreateClienteDto extends createZodDto(createClienteSchema) {}

export const updateClienteSchema = clienteBaseSchema.partial();
export class UpdateClienteDto extends createZodDto(updateClienteSchema) {}

export type CreateClienteInput = z.infer<typeof createClienteSchema>;
export type UpdateClienteInput = z.infer<typeof updateClienteSchema>;
