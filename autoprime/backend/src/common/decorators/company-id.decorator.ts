import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticated-user';

/**
 * Extrai o companyId do usuário autenticado. Lança erro se o usuário não
 * pertencer a nenhuma empresa (só acontece para SUPER_ADMIN) — usado em
 * todos os endpoints de negócio, que são sempre escopados por empresa e
 * nunca acessíveis por SUPER_ADMIN.
 */
export const CompanyId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  const user: AuthenticatedUser = request.user;
  if (!user?.companyId) {
    throw new ForbiddenException('Esta ação exige um usuário vinculado a uma empresa.');
  }
  return user.companyId;
});
