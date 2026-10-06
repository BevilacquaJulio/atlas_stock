import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FinanceiroService } from './financeiro.service';
import {
  CreateCategoriaDespesaDto,
  CreateDespesaDto,
  CreateReceitaDto,
  DesbloquearDto,
  FinanceiroQueryDto,
  PagarDespesaDto,
  ReceberReceitaDto,
  UpdateDespesaDto,
  UpdateReceitaDto,
} from './dto/financeiro.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FinanceiroUnlock } from '../../common/decorators/financeiro-unlock.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('financeiro')
@ApiBearerAuth()
@Controller('financeiro')
export class FinanceiroController {
  constructor(private readonly service: FinanceiroService) {}

  @Get('status')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.service.statusDesbloqueio(user);
  }

  @Post('desbloquear')
  desbloquear(
    @Body() dto: DesbloquearDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.desbloquear(dto.senha, user);
  }

  @Get('resumo')
  @FinanceiroUnlock()
  resumo() {
    return this.service.resumo();
  }

  @Get('despesas')
  @FinanceiroUnlock()
  listDespesas(@Query() query: FinanceiroQueryDto) {
    return this.service.listDespesas(query);
  }

  @Get('despesas/:id')
  @FinanceiroUnlock()
  findDespesa(@Param('id', ParseIntPipe) id: number) {
    return this.service.findDespesa(id);
  }

  @Post('despesas')
  @FinanceiroUnlock()
  createDespesa(@Body() dto: CreateDespesaDto) {
    return this.service.createDespesa(dto);
  }

  @Patch('despesas/:id')
  @FinanceiroUnlock()
  updateDespesa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDespesaDto,
  ) {
    return this.service.updateDespesa(id, dto);
  }

  @Patch('despesas/:id/pagar')
  @FinanceiroUnlock()
  pagarDespesa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PagarDespesaDto,
  ) {
    return this.service.pagarDespesa(id, dto.dataPagamento);
  }

  @Get('receitas')
  @FinanceiroUnlock()
  listReceitas(@Query() query: FinanceiroQueryDto) {
    return this.service.listReceitas(query);
  }

  @Get('receitas/:id')
  @FinanceiroUnlock()
  findReceita(@Param('id', ParseIntPipe) id: number) {
    return this.service.findReceita(id);
  }

  @Post('receitas')
  @FinanceiroUnlock()
  createReceita(@Body() dto: CreateReceitaDto) {
    return this.service.createReceita(dto);
  }

  @Patch('receitas/:id')
  @FinanceiroUnlock()
  updateReceita(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReceitaDto,
  ) {
    return this.service.updateReceita(id, dto);
  }

  @Patch('receitas/:id/receber')
  @FinanceiroUnlock()
  receberReceita(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceberReceitaDto,
  ) {
    return this.service.receberReceita(id, dto.dataRecebimento);
  }

  @Get('categorias-despesa')
  @FinanceiroUnlock()
  listCategorias() {
    return this.service.listCategoriasDespesa();
  }

  @Post('categorias-despesa')
  @FinanceiroUnlock()
  createCategoria(@Body() dto: CreateCategoriaDespesaDto) {
    return this.service.createCategoriaDespesa(dto);
  }
}
