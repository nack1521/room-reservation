import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

type SafeObject = Record<string, unknown>;

@Injectable()
export class ControllerLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const now = Date.now();
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const controllerName = context.getClass().name;
    const handlerName = context.getHandler().name;

    const method = req?.method || 'UNKNOWN';
    const path = req?.originalUrl || req?.url || 'unknown-path';
    const userId = req?.user?.id || req?.user?.sub || req?.user?._id || 'anonymous';

    const body = this.sanitize(req?.body);
    const query = this.sanitize(req?.query);

    this.logger.log(
      `[IN] ${method} ${path} -> ${controllerName}.${handlerName} user=${userId} query=${JSON.stringify(query)} body=${JSON.stringify(body)}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - now;
          const statusCode = res?.statusCode || 200;
          this.logger.log(
            `[OUT] ${method} ${path} <- ${controllerName}.${handlerName} status=${statusCode} ${duration}ms`,
          );
        },
        error: (error) => {
          const duration = Date.now() - now;
          const statusCode =
            (typeof error?.status === 'number' && error.status) ||
            (typeof error?.statusCode === 'number' && error.statusCode) ||
            500;
          const message = error?.message || 'Unknown error';
          this.logger.error(
            `[ERR] ${method} ${path} <- ${controllerName}.${handlerName} status=${statusCode} ${duration}ms message=${message}`,
          );
        },
      }),
    );
  }

  private sanitize(input: unknown): unknown {
    if (!input || typeof input !== 'object') {
      return input;
    }

    const clone: SafeObject = { ...(input as SafeObject) };
    const hiddenFields = ['password', 'token', 'access_token', 'refresh_token'];
    for (const key of hiddenFields) {
      if (key in clone) {
        clone[key] = '***';
      }
    }

    return clone;
  }
}
