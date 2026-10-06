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
import { compraQuerySchema } from '../../modules/compras/dto/compra.dto';
import { ComprasService } from '../../modules/compras/compras.service';
import type { GraphqlContext } from '../graphql.options';
import { parseArgs } from '../parse-args';

const idSchema = z.object({ id: z.coerce.number().int().positive() });

@Resolver()
export class ComprasResolver {
  constructor(
    @Inject(ComprasService) private readonly compras: ComprasService,
  ) {}

  @Query('compras')
  comprasPage(@Args() args: unknown) {
    return this.compras.list(parseArgs(compraQuerySchema, args));
  }

  @Query('compra')
  compra(@Args() args: { id: number }) {
    return this.compras.findOne(parseArgs(idSchema, args).id);
  }
}

@Resolver('Compra')
export class CampoCompraResolver {
  /**
   * A listagem do REST não carrega os itens; aqui eles vêm em lote (1 consulta
   * para todas as compras da página). No detalhe, aproveita o que já veio.
   */
  @ResolveField('itens')
  itens(
    @Parent() compra: { id: number; itens?: unknown[] },
    @Context() ctx: GraphqlContext,
  ) {
    return compra.itens ?? ctx.loaders.itensPorCompra.load(compra.id);
  }
}
