import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import type { Request, Response } from 'express';
import type { PrismaService } from '../prisma/prisma.service';
import { depthLimit } from './depth-limit';
import { createLoaders } from './loaders';
import type { Loaders } from './loaders';
import { DateTimeScalar, DecimalScalar } from './scalars';
import { typeDefs } from './schema';

export const GRAPHQL_MAX_DEPTH = 6;

export interface GraphqlOptionsInput {
  production: boolean;
  maxDepth?: number;
}

export interface GraphqlContext {
  req: Request;
  res: Response;
  loaders: Loaders;
}

export function buildGraphqlOptions(
  { production, maxDepth = GRAPHQL_MAX_DEPTH }: GraphqlOptionsInput,
  prisma: PrismaService,
): Omit<ApolloDriverConfig, 'driver'> {
  return {
    typeDefs,
    resolvers: { DateTime: DateTimeScalar, Decimal: DecimalScalar },
    path: '/graphql',
    useGlobalPrefix: true,
    sortSchema: true,
    // Introspecção e landing page só fora de produção.
    introspection: !production,
    plugins: production ? [ApolloServerPluginLandingPageDisabled()] : [],
    includeStacktraceInErrorResponses: false,
    validationRules: [depthLimit(maxDepth)],
    // Loaders novos por requisição: o cache nunca vaza entre usuários.
    context: ({
      req,
      res,
    }: {
      req: Request;
      res: Response;
    }): GraphqlContext => ({
      req,
      res,
      loaders: createLoaders(prisma),
    }),
  };
}
