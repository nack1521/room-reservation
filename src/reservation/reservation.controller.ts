import { Controller, Post, Body, UseGuards, Request, Patch, Param, Delete, Get, Query } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'; // ensure you have this
import { RolesGuard } from 'src/auth/roles.guard';

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationController {
  constructor(private svc: ReservationService) {}

  @Post()
  async create(@Request() req, @Body() dto: CreateReservationDto) {
    return this.svc.create(req.user.id || req.user._id, dto.roomId, dto.start, dto.end);
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() dto: CreateReservationDto) {
    return this.svc.update(id, req.user.id || req.user._id, dto.start, dto.end);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    return this.svc.remove(id, req.user.id || req.user._id);
  }

  @Get()
  async list(@Query('room') room: string, @Query('date') date?: string) {
    return this.svc.listForRoom(room, date);
  }
}
