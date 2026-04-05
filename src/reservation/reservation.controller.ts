import { Controller, Post, Body, UseGuards, Request, Patch, Param, Delete, Get, Query } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'; // ensure you have this
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/roles-decorator';
import { Role } from 'src/auth/roles.enum';

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationController {
  constructor(private svc: ReservationService) {}

  @Post()
  async create(@Request() req, @Body() dto: CreateReservationDto) {
    return this.svc.create(req.user.id || req.user._id, dto.roomId, dto.start, dto.end, dto.note, dto.addOns);
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() dto: CreateReservationDto) {
    return this.svc.update(id, req.user.id || req.user._id, dto.start, dto.end, dto.note, dto.addOns);
  }

  @Delete(':id')
  async remove(@Request() req, @Param('id') id: string) {
    return this.svc.remove(id, req.user.id || req.user._id);
  }

  @Get('availability')
  async availability(@Query('room') room: string, @Query('date') date: string) {
    return this.svc.availabilityForRoomDay(room, date);
  }

  @Get('pending')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async pending() {
    return this.svc.listPending();
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async approve(@Request() req, @Param('id') id: string, @Body('note') note?: string) {
    return this.svc.reviewReservation(id, req.user.id || req.user._id, true, note);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async reject(@Request() req, @Param('id') id: string, @Body('note') note?: string) {
    return this.svc.reviewReservation(id, req.user.id || req.user._id, false, note);
  }

  @Get()
  async list(@Query('room') room: string, @Query('date') date?: string, @Query('status') status?: 'pending' | 'approved' | 'rejected' | 'all') {
    return this.svc.listForRoom(room, date, status || 'approved');
  }
}
