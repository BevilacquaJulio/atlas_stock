import { GraphQLError, Kind } from 'graphql';
import type {
  FragmentDefinitionNode,
  SelectionSetNode,
  ValidationRule,
} from 'graphql';

type Fragments = Record<string, FragmentDefinitionNode>;

function medir(
  selectionSet: SelectionSetNode | undefined,
  fragments: Fragments,
  visitados: ReadonlySet<string>,
): number {
  if (!selectionSet) return 0;

  let maior = 0;
  for (const selecao of selectionSet.selections) {
    let profundidade = 0;
    if (selecao.kind === Kind.FIELD) {
      profundidade = 1 + medir(selecao.selectionSet, fragments, visitados);
    } else if (selecao.kind === Kind.INLINE_FRAGMENT) {
      profundidade = medir(selecao.selectionSet, fragments, visitados);
    } else {
      const nome = selecao.name.value;
      // Fragments cíclicos são rejeitados por outra regra; aqui só evitamos loop.
      if (!visitados.has(nome) && fragments[nome]) {
        profundidade = medir(
          fragments[nome].selectionSet,
          fragments,
          new Set([...visitados, nome]),
        );
      }
    }
    maior = Math.max(maior, profundidade);
  }
  return maior;
}

/**
 * Regra de validação que limita a profundidade de aninhamento de campos,
 * contando através de fragments. Barra consultas que explodem o custo da
 * resposta mesmo quando cada nível é barato.
 */
export function depthLimit(max: number): ValidationRule {
  return (context) => {
    const fragments: Fragments = {};
    for (const def of context.getDocument().definitions) {
      if (def.kind === Kind.FRAGMENT_DEFINITION) {
        fragments[def.name.value] = def;
      }
    }

    return {
      OperationDefinition(node) {
        const profundidade = medir(node.selectionSet, fragments, new Set());
        if (profundidade > max) {
          context.reportError(
            new GraphQLError(
              `Consulta excede a profundidade máxima de ${max} níveis.`,
              { nodes: [node] },
            ),
          );
        }
      },
    };
  };
}
