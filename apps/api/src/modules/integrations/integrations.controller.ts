import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/authenticated-user';
import { IntegrationsService } from './integrations.service';
import { IntegrationsSyncService } from './integrations-sync.service';
import { AuthUrlQueryDto, OAuthCallbackDto } from './dto/integrations.dto';

function defaultRedirectUri(): string {
  const origin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  return `${origin}/settings?tab=integrations`;
}

@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly syncService: IntegrationsSyncService,
  ) {}

  /** Supported platforms and what each one's official API genuinely allows. */
  @Get('platforms')
  getPlatforms() {
    return this.integrationsService.getPlatforms();
  }

  @Get('connections')
  getConnections(@CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.getConnections(user.id);
  }

  @Get('connect/:platform/auth-url')
  getAuthUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('platform') platform: string,
    @Query() query: AuthUrlQueryDto,
  ) {
    return this.integrationsService.getAuthUrl(user.id, platform, query.redirectUri ?? defaultRedirectUri());
  }

  /** Also the reconnect path — authorizing again updates the existing connection. */
  @Post('connect/:platform/callback')
  completeAuthorization(
    @CurrentUser() user: AuthenticatedUser,
    @Param('platform') platform: string,
    @Body() dto: OAuthCallbackDto,
  ) {
    return this.integrationsService.completeAuthorization(
      user.id,
      platform,
      dto.code,
      dto.state,
      dto.redirectUri ?? defaultRedirectUri(),
    );
  }

  /** Dry run — reports what a sync would import without writing anything. */
  @Post(':id/sync/preview')
  previewSync(@CurrentUser() user: AuthenticatedUser, @Param('id') connectionId: string) {
    return this.syncService.previewSync(user.id, connectionId);
  }

  @Post(':id/sync')
  sync(@CurrentUser() user: AuthenticatedUser, @Param('id') connectionId: string) {
    return this.syncService.runSync(user.id, connectionId, 'manual');
  }

  @Get(':id/logs')
  getSyncLogs(@CurrentUser() user: AuthenticatedUser, @Param('id') connectionId: string) {
    return this.integrationsService.getSyncLogs(user.id, connectionId);
  }

  @Delete(':id')
  disconnect(@CurrentUser() user: AuthenticatedUser, @Param('id') connectionId: string) {
    return this.integrationsService.disconnect(user.id, connectionId);
  }
}
