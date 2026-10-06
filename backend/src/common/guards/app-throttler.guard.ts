import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard que também funciona em resolvers GraphQL, para que o mesmo
 * limite de requisições proteja REST e GraphQL (o guard padrão só entende HTTP).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    if (context.getType<string>() === 'graphql') {
      const { req, res } = GqlExecutionContext.create(context).getContext<{
        req: Record<string, unknown>;
        res: Record<string, unknown>;
      }>();
      return { req, res };
    }
    return super.getRequestResponse(context);
  }
}
