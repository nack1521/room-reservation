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

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  create(@Body() createRoomDto: CreateRoomDto) {
    return this.roomService.create(createRoomDto);
  }

  // Seed faker endpoint (admin only). Call: GET /room/faker?count=30
  @Get('faker')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  async seedFaker(@Query('count') count?: string) {
    const n = Number(count) || 20;
    return this.roomService.seedFaker(n);
  }

  @Get()
  findAll() {
    return this.roomService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.roomService.findById(id);
  }
}
