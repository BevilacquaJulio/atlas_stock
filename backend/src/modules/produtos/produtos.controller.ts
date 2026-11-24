import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProdutosService } from './produtos.service';
import { CreateProdutoDto, UpdateProdutoDto } from './dto/produto.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { assertPodeAlterarStatus } from '../../common/permissions/status-cadastro';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('produtos')
@ApiBearerAuth()
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly service: ProdutosService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateProdutoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProdutoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    assertPodeAlterarStatus(user, dto);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR', 'GERENTE')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.service.remove(id);
  }

  @Delete(':id/permanente')
  @Roles('ADMINISTRADOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePermanent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.service.removePermanent(id);
  }
}
