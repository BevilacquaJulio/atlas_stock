import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Ativar/inativar um cadastro tem o mesmo peso da exclusão lógica (DELETE),
 * restrita a gerente e administrador. Sem isso, o operador inativaria pelo PATCH.
 */
export function assertPodeAlterarStatus(
  user: AuthenticatedUser,
  dto: { ativo?: boolean | null },
): void {
  if (dto.ativo === undefined) return;
  if (user.cargo === 'ADMINISTRADOR' || user.cargo === 'GERENTE') return;
  throw new ForbiddenException(
    'Somente gerente ou administrador pode ativar ou inativar cadastros.',
  );
}
