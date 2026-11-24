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
import { VeiculosService } from './veiculos.service';
import { CreateVeiculoDto, UpdateVeiculoDto, VeiculoQueryDto } from './dto/veiculo.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { assertPodeAlterarStatus } from '../../common/permissions/status-cadastro';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@ApiTags('veiculos')
@ApiBearerAuth()
@Controller('veiculos')
export class VeiculosController {
  constructor(private readonly service: VeiculosService) {}

  @Get()
  list(@Query() query: VeiculoQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateVeiculoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVeiculoDto,
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
