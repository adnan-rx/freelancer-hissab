import { Controller, Get, Patch, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    const userId = typeof user === 'string' ? user : (user?.id || user);
    if (!userId || typeof userId !== 'string') {
      throw new BadRequestException('Invalid user identification token.');
    }
    const profile = await this.usersService.getProfile(userId);
    if (!profile) {
      throw new BadRequestException('User profile not found.');
    }
    const { passwordHash, ...safeProfile } = profile;
    return safeProfile;
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    const userId = typeof user === 'string' ? user : (user?.id || user);
    if (!userId || typeof userId !== 'string') {
      throw new BadRequestException('Invalid user identification token.');
    }
    const updated = await this.usersService.updateProfile(userId, dto);
    const { passwordHash, ...safeProfile } = updated;
    return safeProfile;
  }

  @Patch('password')
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    const userId = typeof user === 'string' ? user : user?.id || user;
    if (!userId || typeof userId !== 'string') {
      throw new BadRequestException('Invalid user identification token.');
    }
    return this.usersService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }
}
