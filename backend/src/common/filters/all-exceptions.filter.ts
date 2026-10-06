import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { ZodValidationException } from 'nestjs-zod';
import type { Request, Response } from 'express';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Filtro global de exceções. Padroniza toda resposta de erro no formato:
 *   { error: { code, message, details? } }
 * Nunca expõe stack trace ou detalhes internos ao cliente.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): GraphQLError | void {
    const { status, body } = this.buildError(exception);

    // Resolvers GraphQL: o valor retornado pelo filtro vira o erro da resposta.
    if (host.getType<string>() === 'graphql') {
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error(
          `graphql -> ${status}`,
          exception instanceof Error ? exception.stack : String(exception),
        );
      }
      return new GraphQLError(body.error.message, {
        extensions: {
          code: body.error.code,
          ...(body.error.details ? { details: body.error.details } : {}),
        },
      });
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private buildError(exception: unknown): {
    status: number;
    body: ErrorEnvelope;
  } {
    // Erros de validação Zod (nestjs-zod) -> 422 com detalhes dos campos
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError();
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Dados inválidos.',
            details: zodError.issues,
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as Record<string, unknown>)?.message as string) ??
            exception.message;
      return {
        status,
        body: {
          error: {
            code: this.codeFromStatus(status),
            message: Array.isArray(message) ? message.join('; ') : message,
          },
        },
      };
    }

    const prismaStatus = this.statusFromPrismaError(exception);
    if (prismaStatus) {
      return {
        status: prismaStatus.status,
        body: {
          error: {
            code: this.codeFromStatus(prismaStatus.status),
            message: prismaStatus.message,
          },
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor.',
        },
      },
    };
  }

  /** Mensagens fixas: nunca repassa texto do driver, tabela ou coluna. */
  private statusFromPrismaError(
    exception: unknown,
  ): { status: number; message: string } | undefined {
    if (
      !(exception instanceof Error) ||
      exception.name !== 'PrismaClientKnownRequestError'
    ) {
      return undefined;
    }
    switch ((exception as Error & { code?: string }).code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Já existe um registro com estes dados.',
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Registro vinculado a outros dados e não pode ser alterado.',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado.',
        };
      default:
        return undefined;
    }
  }

  private codeFromStatus(status: number): string {
    const map: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
    };
    return map[status] ?? 'ERROR';
  }
}
