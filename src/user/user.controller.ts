import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Patch,
  Param,
} from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterDTO } from './dto/register.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles-decorator';
import { Role } from '../auth/roles.enum';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  async register(@Body() registerDTO: RegisterDTO) {
    return this.userService.create(registerDTO);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/request-teacher')
  async requestTeacherRole(@Request() req) {
    const id = req.user?.id ?? req.user?.sub ?? req.user?.profile?._id;
    const user = await this.userService.requestTeacherRole(id);
    return {
      message: 'Teacher role request submitted',
      user,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('teacher-requests')
  async listTeacherRequests() {
    return this.userService.listPendingTeacherRequests();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(':id/approve-teacher')
  async approveTeacherRequest(@Param('id') id: string) {
    const user = await this.userService.approveTeacherRequest(id);
    return {
      message: 'Teacher role approved',
      user,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(':id/reject-teacher')
  async rejectTeacherRequest(@Param('id') id: string) {
    const user = await this.userService.rejectTeacherRequest(id);
    return {
      message: 'Teacher role request rejected',
      user,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @Patch(':id/grant-admin')
  async grantAdminRole(@Param('id') id: string) {
    const user = await this.userService.grantAdminRole(id);
    return {
      message: 'Admin role granted',
      user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req) {
    const id = req.user?.id ?? req.user?.sub ?? req.user?.profile?._id;
    return this.userService.findById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/phone')
  async updatePhoneNumber(@Request() req, @Body('phoneNumber') phoneNumber: string) {
    const id = req.user?.id ?? req.user?.sub ?? req.user?.profile?._id;
    console.log('[UserController.updatePhoneNumber] user:', req.user);
    console.log('[UserController.updatePhoneNumber] resolved user id:', id);
    if (!id) {
      return { error: 'User not authenticated or ID not found in request', user: req.user };
    }
    return this.userService.updatePhoneNumber(id, phoneNumber);
  }

  // Test endpoint - accepts userId in body (remove this after testing)
  @Patch('phone')
  async updatePhoneNumberTest(@Body('userId') userId: string, @Body('phoneNumber') phoneNumber: string) {
    if (!userId) {
      return { error: 'userId is required in body' };
    }
    return this.userService.updatePhoneNumber(userId, phoneNumber);
  }
}