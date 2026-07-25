import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = request.method as string;

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const user = request.user;
        this.prisma.auditLog
          .create({
            data: {
              userId: user?.id ?? null,
              action: method,
              entity: request.route?.path ?? request.url,
              entityId: request.params?.id ?? null,
              ipAddress: request.ip,
              metadata: { body: this.redact(request.body) } as Prisma.InputJsonValue,
            },
          })
          .catch(() => undefined);
      }),
    );
  }

  private redact(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;
    const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const key of ['password', 'passwordHash', 'token', 'refreshToken']) {
      if (key in clone) clone[key] = '***';
    }
    return clone;
  }
}
