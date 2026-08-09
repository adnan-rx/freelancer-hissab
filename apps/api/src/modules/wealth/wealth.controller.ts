import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { WealthService } from './wealth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAssetDto, UpdateAssetDto, CreateLiabilityDto, UpdateLiabilityDto, UpdateWealthStatementDto } from './dto/wealth.dto';

@Controller('wealth')
@UseGuards(JwtAuthGuard)
export class WealthController {
  constructor(private readonly wealthService: WealthService) {}

  @Get('statement')
  getStatement(@Request() req: any, @Query('year') year: string = '2026') {
    return this.wealthService.getWealthStatement(req.user.id, year);
  }

  @Patch('statement')
  updateStatement(@Request() req: any, @Query('year') year: string = '2026', @Body() dto: UpdateWealthStatementDto) {
    return this.wealthService.updateWealthStatement(req.user.id, year, dto);
  }

  @Get('assets')
  getAssets(@Request() req: any, @Query('year') year: string = '2026') {
    return this.wealthService.getAssets(req.user.id, year);
  }

  @Post('assets')
  createAsset(@Request() req: any, @Body() dto: CreateAssetDto) {
    return this.wealthService.createAsset(req.user.id, dto);
  }

  @Patch('assets/:id')
  updateAsset(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.wealthService.updateAsset(req.user.id, id, dto);
  }

  @Delete('assets/:id')
  deleteAsset(@Request() req: any, @Param('id') id: string) {
    return this.wealthService.deleteAsset(req.user.id, id);
  }

  @Get('liabilities')
  getLiabilities(@Request() req: any, @Query('year') year: string = '2026') {
    return this.wealthService.getLiabilities(req.user.id, year);
  }

  @Post('liabilities')
  createLiability(@Request() req: any, @Body() dto: CreateLiabilityDto) {
    return this.wealthService.createLiability(req.user.id, dto);
  }

  @Patch('liabilities/:id')
  updateLiability(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateLiabilityDto) {
    return this.wealthService.updateLiability(req.user.id, id, dto);
  }

  @Delete('liabilities/:id')
  deleteLiability(@Request() req: any, @Param('id') id: string) {
    return this.wealthService.deleteLiability(req.user.id, id);
  }

  @Get('reconciliation')
  getReconciliation(@Request() req: any, @Query('year') year: string = '2026') {
    return this.wealthService.getReconciliation(req.user.id, year);
  }
}
