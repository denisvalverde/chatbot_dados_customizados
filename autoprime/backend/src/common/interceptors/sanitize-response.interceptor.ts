import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const SENSITIVE_KEYS = new Set(['passwordHash', 'twoFactorSecret']);

/**
 * Remove campos sensíveis (hash de senha, segredo 2FA) de qualquer resposta,
 * mesmo que um service inclua a relação `user` inteira via Prisma. Isso evita
 * vazamentos acidentais quando novos endpoints/includes forem adicionados.
 */
@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => this.sanitize(data)));
  }

  private sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item, seen));
    }

    if (value && typeof value === 'object') {
      // Só reconstrói objetos "plain" (literais ou instâncias do Prisma sem
      // prototype especial). Instâncias como Decimal, Date, Buffer, etc.
      // têm sua própria serialização (toJSON) e devem passar intactas —
      // caso contrário perderíamos essa lógica ao desmontar em chaves soltas.
      const proto = Object.getPrototypeOf(value);
      const isPlain = proto === Object.prototype || proto === null;
      if (!isPlain) return value;

      if (seen.has(value as object)) return value;
      seen.add(value as object);

      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEYS.has(key)) continue;
        result[key] = this.sanitize(val, seen);
      }
      return result;
    }

    return value;
  }
}
