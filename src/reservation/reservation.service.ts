import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IReservation } from './schemas/reservation.schema';
import { User } from 'src/user/schemas/user.schema';
import { Role } from 'src/auth/roles.enum';
import { isBefore, differenceInMinutes } from 'date-fns';

@Injectable()
export class ReservationService {
  constructor(
    @InjectModel('Reservation') private reservationModel: Model<IReservation>,
    @InjectModel('User') private userModel: Model<User>,
  ) {}

  private openMinutes = 8 * 60 + 30;
  private closeMinutes = 20 * 60 + 30;

  private toLocalMinutes(d: Date) {
    return d.getHours() * 60 + d.getMinutes();
  }

  async create(userId: string, roomId: string, startISO: string, endISO: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new BadRequestException('user not found');

    const start = new Date(startISO);
    const end = new Date(endISO);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) throw new BadRequestException('invalid time');

    const durationMin = Math.floor((end.getTime() - start.getTime()) / 60000);
    const isTeacherOrAbove = (user.roles || []).includes(Role.TEACHER) || (user.roles || []).includes(Role.ADMIN) || (user.roles || []).includes(Role.SUPER_ADMIN);

    if (!isTeacherOrAbove) {
      if (durationMin > 120) throw new ForbiddenException('max 2 hours per reservation');
      // daily count
      const dayStart = new Date(start);
      dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate()+1);
      const count = await this.reservationModel.countDocuments({
        user: new Types.ObjectId(userId),
        start: { $gte: dayStart, $lt: dayEnd },
      }).exec();
      if (count >= 2) throw new ForbiddenException('max 2 reservations per day');
    }

    // check day bounds (use local server timezone)
    const startMin = this.toLocalMinutes(start);
    const endMin = this.toLocalMinutes(end);
    if (startMin < this.openMinutes || endMin > this.closeMinutes) {
      throw new ForbiddenException('room available only between 08:30 and 20:30');
    }

    // overlapping check
    const overlap = await this.reservationModel.findOne({
      room: new Types.ObjectId(roomId),
      $or: [{ start: { $lt: end }, end: { $gt: start } }],
    }).exec();
    if (overlap) throw new ForbiddenException('time slot already booked');

    const created = new this.reservationModel({
      room: new Types.ObjectId(roomId),
      user: new Types.ObjectId(userId),
      start,
      end,
    });
    return created.save();
  }

  async update(reservationId: string, userId: string, startISO: string, endISO: string) {
    // allow change within 1 day by owner or always by teacher/admin
    const r = await this.reservationModel.findById(reservationId).exec();
    if (!r) throw new BadRequestException('not found');
    if (String(r.user) !== String(userId)) {
      // owner match required unless admin/teacher
      const user = await this.userModel.findById(userId).lean();
      if (!user) throw new BadRequestException('user not found');
      const isAdmin = (user.roles||[]).includes(Role.ADMIN) || (user.roles||[]).includes(Role.SUPER_ADMIN);
      if (!isAdmin) throw new ForbiddenException('not allowed');
    }
    // reuse create checks by attempting to find overlaps excluding current id
    const start = new Date(startISO), end = new Date(endISO);
    const overlap = await this.reservationModel.findOne({
      _id: { $ne: r._id },
      room: r.room,
      $or: [{ start: { $lt: end }, end: { $gt: start } }],
    }).exec();
    if (overlap) throw new ForbiddenException('time slot already booked');
    r.start = start; r.end = end;
    return r.save();
  }

  async remove(reservationId: string, userId: string) {
    const r = await this.reservationModel.findById(reservationId).exec();
    if (!r) throw new BadRequestException('not found');
    if (String(r.user) !== String(userId)) {
      const user = await this.userModel.findById(userId).lean();
      if (!user) throw new BadRequestException('user not found');
      const isAdmin = (user.roles||[]).includes(Role.ADMIN) || (user.roles||[]).includes(Role.SUPER_ADMIN);
      if (!isAdmin) throw new ForbiddenException('not allowed');
    }
    return this.reservationModel.findByIdAndDelete(reservationId).exec();
  }

  async listForRoom(roomId: string, date?: string) {
    const q: any = { room: new Types.ObjectId(roomId) };
    if (date) {
      const d = new Date(date); d.setHours(0,0,0,0);
      const d2 = new Date(d); d2.setDate(d2.getDate()+1);
      q.start = { $gte: d, $lt: d2 };
    }
    return this.reservationModel.find(q).populate('user', 'email name').exec();
  }
}