import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FilingService } from './filing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('filing')
export class FilingController {
  constructor(private readonly filingService: FilingService) {}

  @Get('readiness')
  getReadiness(@CurrentUser() user: any, @Query('year') year?: string) {
    return this.filingService.getReadinessScore(user.id, year);
  }

  @Get('checklist')
  getChecklist(@CurrentUser() user: any, @Query('year') year?: string) {
    return this.filingService.getChecklist(user.id, year);
  }
}
