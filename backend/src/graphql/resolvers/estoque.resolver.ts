import { Inject } from '@nestjs/common';
import {
  Args,
  Context,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { z } from 'zod';
import { paginationSchema } from '../../common/dto/pagination.dto';
import { CategoriasService } from '../../modules/categorias/categorias.service';
import { ProdutosService } from '../../modules/produtos/produtos.service';
import type { GraphqlContext } from '../graphql.options';
import { parseArgs } from '../parse-args';

const idSchema = z.object({ id: z.coerce.number().int().positive() });

type ProdutosArgs = {
  page?: number;
  limit?: number;
  search?: string;
  ativo?: boolean;
};

/** Consultas de catálogo: delegam aos services do REST (regras únicas). */
@Resolver()
export class EstoqueResolver {
  constructor(
    @Inject(ProdutosService) private readonly produtos: ProdutosService,
    @Inject(CategoriasService) private readonly categorias: CategoriasService,
  ) {}

  @Query('categorias')
  categoriasPage(@Args() args: Omit<ProdutosArgs, 'ativo'>) {
    return this.categorias.list(parseArgs(paginationSchema, args));
  }

  @Query('produtos')
  produtosPage(@Args() args: ProdutosArgs) {
    // O schema do REST recebe o filtro `ativo` como texto de query string.
    const { ativo, ...resto } = args;
    return this.produtos.list(
      parseArgs(paginationSchema, {
        ...resto,
        ...(ativo === undefined || ativo === null ? {} : { ativo: String(ativo) }),
      }),
    );
  }

  @Query('produto')
  produto(@Args() args: { id: number }) {
    return this.produtos.findOne(parseArgs(idSchema, args).id);
  }
}

@Resolver('Produto')
export class CampoProdutoResolver {
  /** 1 consulta por requisição, independente do tamanho da página. */
  @ResolveField('categoria')
  categoria(
    @Parent() produto: { categoriaId: number | null },
    @Context() ctx: GraphqlContext,
  ) {
    return produto.categoriaId === null || produto.categoriaId === undefined
      ? null
      : ctx.loaders.categoria.load(produto.categoriaId);
  }
}

@Resolver('Categoria')
export class CampoCategoriaResolver {
  @ResolveField('totalProdutos')
  totalProdutos(
    @Parent() categoria: { id: number },
    @Context() ctx: GraphqlContext,
  ) {
    return ctx.loaders.totalProdutos.load(categoria.id);
  }
}
