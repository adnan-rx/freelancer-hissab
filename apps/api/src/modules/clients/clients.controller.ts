import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: { search?: string; status?: string; platform?: string }) {
    return this.clientsService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.clientsService.findOne(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateClientDto) {
    return this.clientsService.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(user.id, id, dto);
  }

  @Delete(':id')
  delete(@CurrentUser() user: any, @Param('id') id: string, @Query('force') force?: string) {
    return this.clientsService.delete(user.id, id, force === 'true');
  }
}
