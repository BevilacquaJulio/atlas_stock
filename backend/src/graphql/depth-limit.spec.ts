import { describe, it, expect } from 'vitest';
import { buildSchema, parse, validate } from 'graphql';
import { depthLimit } from './depth-limit';

const schema = buildSchema(`
  type No { filho: No valor: Int }
  type Query { raiz: No }
`);

const erros = (query: string, max: number) =>
  validate(schema, parse(query), [depthLimit(max)]).map((e) => e.message);

describe('depthLimit', () => {
  it('aceita consulta dentro do limite', () => {
    expect(erros('{ raiz { valor } }', 2)).toEqual([]);
  });

  it('rejeita consulta mais profunda que o limite', () => {
    const [msg] = erros('{ raiz { filho { filho { valor } } } }', 3);
    expect(msg).toContain('profundidade máxima de 3');
  });

  it('conta profundidade através de fragments', () => {
    const q = `
      query { raiz { ...A } }
      fragment A on No { filho { ...B } }
      fragment B on No { filho { valor } }
    `;
    expect(erros(q, 3)).toHaveLength(1);
  });

  it('não entra em loop com fragments cíclicos', () => {
    const q = `
      query { raiz { ...A } }
      fragment A on No { filho { ...A } }
    `;
    expect(() => erros(q, 5)).not.toThrow();
  });
});
