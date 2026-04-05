import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles-decorator';
import { Role } from 'src/auth/roles.enum';

@Controller('room')
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Get('addons')
  async listAddOns(@Query('type') type?: string) {
    return this.roomService.listAddOns(type);
  }

  @Post('addons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async createAddOn(
    @Body() body: { roomType: string; addOnId: string; label: string; unit: string; max: number },
  ) {
    return this.roomService.createAddOn(body);
  }

  @Post('addons/bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async bulkCreateAddOns(
    @Body() body: Array<{ roomType: string; addOnId: string; label: string; unit: string; max: number }>,
  ) {
    return this.roomService.bulkCreateAddOns(body);
  }

  @Post('addons/seed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async seedAddOns() {
    return this.roomService.seedAddOnsFromConstants();
  }

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  create(@Body() createRoomDto: CreateRoomDto) {
    return this.roomService.create(createRoomDto);
  }

  @Post('bulk-create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  bulkCreate(@Body() createRoomDtos: CreateRoomDto[]) {
    return this.roomService.bulkCreate(createRoomDtos as any);
  }

  // Seed faker endpoint (admin only). Call: GET /room/faker?count=30
  @Get('faker')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async seedFaker(@Query('count') count?: string) {
    const n = Number(count) || 20;
    return this.roomService.seedFaker(n);
  }

  @Get('all')
  findAll(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('floor') floor?: string,
    @Query('location') location?: string,
    @Query('minCapacity') minCapacity?: string,
    @Query('maxCapacity') maxCapacity?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.roomService.list({
      q,
      type,
      floor,
      location,
      minCapacity,
      maxCapacity,
      page,
      limit,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto) {
    return this.roomService.update(id, updateRoomDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.roomService.remove(id);
  }
}
