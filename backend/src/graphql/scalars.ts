import { GraphQLScalarType } from 'graphql';

/** Datas trafegam como ISO-8601, igual ao JSON do REST. */
export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  serialize: (value) =>
    value instanceof Date ? value.toISOString() : String(value),
});

/**
 * Decimais do Prisma trafegam como string (igual ao REST): evita a perda de
 * precisão em valores monetários que um Float introduziria.
 */
export const DecimalScalar = new GraphQLScalarType({
  name: 'Decimal',
  serialize: (value) => String(value),
});
