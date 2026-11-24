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
import { CategoriasService } from './categorias.service';
import {
  CreateCategoriaDto,
  UpdateCategoriaDto,
} from './dto/categoria.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { assertPodeAlterarStatus } from '../../common/permissions/status-cadastro';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('categorias')
@ApiBearerAuth()
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly service: CategoriasService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCategoriaDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    assertPodeAlterarStatus(user, dto);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR', 'GERENTE')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
