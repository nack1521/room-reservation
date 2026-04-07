import { Controller, Post, Body, UseGuards, Request, Patch, Param, Delete, Get, Query, Res } from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles-decorator';
import { Role } from '../auth/roles.enum';
import type { Response } from 'express';

@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationController {
  constructor(private svc: ReservationService) {}

  @Get('me')
  async myReservations(
    @Request() req,
    @Query('status') status?: 'upcoming' | 'pending' | 'done' | 'rejected' | 'canceled' | 'all',
    @Query('date') date?: string,
  ) {
    return this.svc.listForUser(req.user.id || req.user._id, req.user.id || req.user._id, date, status || 'all');
  }

  @Get('me/dashboard')
  async myDashboard(@Request() req) {
    return this.svc.dashboardForUser(req.user.id || req.user._id);
  }

  @Get('user/:userId')
  async userReservations(
    @Request() req,
    @Param('userId') userId: string,
    @Query('status') status?: 'upcoming' | 'pending' | 'done' | 'rejected' | 'canceled' | 'all',
    @Query('date') date?: string,
  ) {
    return this.svc.listForUser(userId, req.user.id || req.user._id, date, status || 'all');
  }

  @Post()
  async create(@Request() req, @Body() dto: CreateReservationDto) {
    return this.svc.create(req.user.id || req.user._id, dto.roomId, dto.start, dto.end, dto.note, dto.addOns);
  }

  @Patch(':id')
  async update(@Request() req, @Param('id') id: string, @Body() dto: CreateReservationDto) {
    return this.svc.update(id, req.user.id || req.user._id, dto.start, dto.end, dto.note, dto.addOns);
  }

  @Patch(':id/cancel')
  async cancel(@Request() req, @Param('id') id: string) {
    return this.svc.cancelUpcoming(id, req.user.id || req.user._id);
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

  @Get('all')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async listAll(
    @Request() req,
    @Res({ passthrough: true }) res: Response,
    @Query('status') status?: 'upcoming' | 'pending' | 'done' | 'rejected' | 'canceled' | 'all',
    @Query('room') room?: string,
    @Query('user') user?: string,
    @Query('date') date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.svc.listAllForAdmin({
      status,
      room,
      user,
      date,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    const buildPageUrl = (targetPage: number) => {
      const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
      url.searchParams.set('page', String(targetPage));
      url.searchParams.set('limit', String(result.meta.limit));
      return `<${url.toString()}>`;
    };

    const links: string[] = [];
    if (result.meta.page > 1) {
      links.push(`${buildPageUrl(1)}; rel="first"`);
      links.push(`${buildPageUrl(result.meta.page - 1)}; rel="prev"`);
    }
    if (result.meta.page < result.meta.totalPages) {
      links.push(`${buildPageUrl(result.meta.page + 1)}; rel="next"`);
      links.push(`${buildPageUrl(result.meta.totalPages)}; rel="last"`);
    }

    if (links.length) {
      res.setHeader('Link', links.join(', '));
    }
    res.setHeader('X-Total-Count', String(result.meta.total));

    return result;
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
  async list(@Query('room') room: string, @Query('date') date?: string, @Query('status') status?: 'upcoming' | 'pending' | 'done' | 'rejected' | 'canceled' | 'all') {
    return this.svc.listForRoom(room, date, status || 'upcoming');
  }
}
