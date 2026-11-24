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
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto } from './dto/cliente.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { assertPodeAlterarStatus } from '../../common/permissions/status-cadastro';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('clientes')
@ApiBearerAuth()
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateClienteDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClienteDto,
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
}
