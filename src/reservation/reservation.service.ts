import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { IReservation } from './schemas/reservation.schema';
import { User } from '../user/schemas/user.schema';
import { Role } from '../auth/roles.enum';
import { IRoom } from '../room/schemas/room.schema';
import { AddOnItem } from '../room/constants/addons-by-type';
import { ReservationAddOnDto } from './dto/create-reservation.dto';

type ReservationStatus = 'upcoming' | 'pending' | 'done' | 'rejected' | 'canceled';
type ReservationApprovalState = 'approved' | 'not_approved';

type ReservationAddOnSnapshot = {
  addOnId: string;
  label: string;
  unit: string;
  qty: number;
};

type AdminReservationFilters = {
  status?: ReservationStatus | 'all';
  room?: string;
  user?: string;
  date?: string;
  page?: number;
  limit?: number;
};

@Injectable()
export class ReservationService {
  constructor(
    @InjectModel('Reservation') private reservationModel: Model<IReservation>,
    @InjectModel('User') private userModel: Model<User>,
    @InjectModel('Room') private roomModel: Model<IRoom>,
  ) {}

  private openMinutes = 7 * 60 + 30;
  private closeMinutes = 20 * 60 + 30;

  private async markElapsedUpcomingAsDone(extraFilter: any = {}) {
    await this.reservationModel.updateMany(
      {
        ...extraFilter,
        isDeleted: { $ne: true },
        status: 'approved',
      },
      { $set: { status: 'upcoming', approvalState: 'approved' } },
    ).exec();

    await this.reservationModel.updateMany(
      {
        ...extraFilter,
        isDeleted: { $ne: true },
        status: 'upcoming',
        end: { $lt: new Date() },
      },
      { $set: { status: 'done' } },
    ).exec();
  }

  private toLocalMinutes(d: Date) {
    return d.getHours() * 60 + d.getMinutes();
  }

  private isTeacherOrAbove(user: User | null) {
    const roles = user?.roles || [];
    return roles.includes(Role.TEACHER) || roles.includes(Role.ADMIN) || roles.includes(Role.SUPER_ADMIN);
  }

  private isAdminOrAbove(user: User | null) {
    const roles = user?.roles || [];
    return roles.includes(Role.ADMIN) || roles.includes(Role.SUPER_ADMIN);
  }

  private getDayRange(from: Date) {
    const dayStart = new Date(from);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return { dayStart, dayEnd };
  }

  private validateBlockTime(start: Date, end: Date) {
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      throw new BadRequestException('invalid time');
    }

    const sameDay = start.toDateString() === end.toDateString();
    if (!sameDay) {
      throw new BadRequestException('reservation must be within one day');
    }

    const startMin = this.toLocalMinutes(start);
    const endMin = this.toLocalMinutes(end);
    const durationMin = Math.floor((end.getTime() - start.getTime()) / 60000);

    if (startMin < this.openMinutes || endMin > this.closeMinutes) {
      throw new ForbiddenException('room available only between 07:30 and 20:30');
    }

    if (start.getMinutes() !== 30 || end.getMinutes() !== 30) {
      throw new BadRequestException('start/end must be on :30 time blocks');
    }

    if (durationMin % 60 !== 0) {
      throw new BadRequestException('duration must be in 1-hour blocks');
    }

    return { durationMin };
  }

  private async getApprovedMinutesForDay(userId: string, dayStart: Date, dayEnd: Date, excludeId?: string) {
    const rows = await this.reservationModel.find({
      user: new Types.ObjectId(userId),
      isDeleted: { $ne: true },
      $or: [
        { approvalState: 'approved' },
        { status: { $in: ['upcoming', 'done', 'approved'] } },
      ],
      start: { $gte: dayStart, $lt: dayEnd },
      ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}),
    }).select('start end').lean().exec();

    return rows.reduce((sum, row: any) => {
      const minutes = Math.max(0, Math.floor((new Date(row.end).getTime() - new Date(row.start).getTime()) / 60000));
      return sum + minutes;
    }, 0);
  }

  private async hasApprovedOverlap(roomId: string | Types.ObjectId, start: Date, end: Date, excludeId?: string) {
    const overlap = await this.reservationModel.findOne({
      room: typeof roomId === 'string' ? new Types.ObjectId(roomId) : roomId,
      isDeleted: { $ne: true },
      status: { $in: ['upcoming', 'approved'] },
      ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}),
      $or: [{ start: { $lt: end }, end: { $gt: start } }],
    }).exec();

    return Boolean(overlap);
  }

  private buildAddOnsSnapshot(allowedAddOns: AddOnItem[] = [], requestedAddOns: ReservationAddOnDto[] = []): ReservationAddOnSnapshot[] {
    if (!requestedAddOns?.length) {
      return [];
    }

    const allowedMap = new Map(allowedAddOns.map((a) => [a.id, a]));

    return requestedAddOns.map((item) => {
      if (!item?.addOnId) {
        throw new BadRequestException('addOnId is required');
      }

      const allowed = allowedMap.get(item.addOnId);
      if (!allowed) {
        throw new BadRequestException(`add-on ${item.addOnId} is not allowed for this room`);
      }

      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty < 1) {
        throw new BadRequestException(`add-on ${item.addOnId} qty must be a positive integer`);
      }

      if (qty > allowed.max) {
        throw new BadRequestException(`add-on ${item.addOnId} qty exceeds max ${allowed.max}`);
      }

      return {
        addOnId: allowed.id,
        label: allowed.label,
        unit: allowed.unit,
        qty,
      };
    });
  }

  async create(userId: string, roomId: string, startISO: string, endISO: string, note?: string, addOns?: ReservationAddOnDto[]) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) throw new BadRequestException('user not found');
    const room = await this.roomModel.findById(roomId).lean();
    if (!room) throw new BadRequestException('room not found');

    const start = new Date(startISO);
    const end = new Date(endISO);
    const { durationMin } = this.validateBlockTime(start, end);
    const isTeacherOrAbove = this.isTeacherOrAbove(user as any);
    const { dayStart, dayEnd } = this.getDayRange(start);

    let status: ReservationStatus = 'upcoming';
    let approvalState: ReservationApprovalState = 'approved';
    if (!isTeacherOrAbove) {
      const usedMinutes = await this.getApprovedMinutesForDay(userId, dayStart, dayEnd);
      if (usedMinutes + durationMin > 120) {
        status = 'pending';
        approvalState = 'not_approved';
      }
    }

    if (status === 'upcoming') {
      const overlap = await this.hasApprovedOverlap(roomId, start, end);
      if (overlap) throw new ForbiddenException('time slot already booked');
    }

    const addOnSnapshot = this.buildAddOnsSnapshot(room.addOnsByType || [], addOns || []);

    const created = new this.reservationModel({
      room: new Types.ObjectId(roomId),
      user: new Types.ObjectId(userId),
      start,
      end,
      note,
      addOns: addOnSnapshot,
      status,
      approvalState,
    });
    const saved = await created.save();

    return {
      reservation: saved,
      message: status === 'pending' ? 'Reservation request submitted and pending admin approval' : 'Reservation created',
    };
  }

  async update(reservationId: string, userId: string, startISO: string, endISO: string, note?: string, addOns?: ReservationAddOnDto[]) {
    // allow change within 1 day by owner or always by teacher/admin
    const r = await this.reservationModel.findById(reservationId).exec();
    if (!r || r.isDeleted) throw new BadRequestException('not found');
    const actor = await this.userModel.findById(userId).lean();
    if (!actor) throw new BadRequestException('user not found');

    if (String(r.user) !== String(userId)) {
      // owner match required unless admin
      const isAdmin = this.isAdminOrAbove(actor as any);
      if (!isAdmin) throw new ForbiddenException('not allowed');
    }

    const start = new Date(startISO);
    const end = new Date(endISO);
    const { durationMin } = this.validateBlockTime(start, end);
    const { dayStart, dayEnd } = this.getDayRange(start);
    const room = await this.roomModel.findById(r.room).lean();
    if (!room) throw new BadRequestException('room not found');

    let nextStatus: ReservationStatus = r.status as ReservationStatus;
    let nextApprovalState: ReservationApprovalState = (r as any).approvalState || 'approved';
    const isTeacherOrAbove = this.isTeacherOrAbove(actor as any);
    if (!isTeacherOrAbove) {
      const usedMinutes = await this.getApprovedMinutesForDay(String(r.user), dayStart, dayEnd, reservationId);
      if (usedMinutes + durationMin > 120) {
        nextStatus = 'pending';
        nextApprovalState = 'not_approved';
      } else if (r.status === 'pending') {
        nextStatus = 'upcoming';
        nextApprovalState = 'approved';
      }
    }

    if (nextStatus === 'upcoming') {
      const overlap = await this.hasApprovedOverlap(r.room, start, end, reservationId);
      if (overlap) throw new ForbiddenException('time slot already booked');
    }

    r.start = start;
    r.end = end;
    r.note = note;
    r.addOns = this.buildAddOnsSnapshot(room.addOnsByType || [], addOns || []);
    r.status = nextStatus;
    (r as any).approvalState = nextApprovalState;

    return r.save();
  }

  async remove(reservationId: string, userId: string) {
    const r = await this.reservationModel.findById(reservationId).exec();
    if (!r || r.isDeleted) throw new BadRequestException('not found');
    if (String(r.user) !== String(userId)) {
      const user = await this.userModel.findById(userId).lean();
      if (!user) throw new BadRequestException('user not found');
      const isAdmin = (user.roles||[]).includes(Role.ADMIN) || (user.roles||[]).includes(Role.SUPER_ADMIN);
      if (!isAdmin) throw new ForbiddenException('not allowed');
    }

    r.isDeleted = true;
    r.deletedAt = new Date();
    await r.save();

    return { message: 'Reservation deleted' };
  }

  async cancelUpcoming(reservationId: string, userId: string) {
    const r = await this.reservationModel.findById(reservationId).exec();
    if (!r || r.isDeleted) throw new BadRequestException('reservation not found');

    if (String(r.user) !== String(userId)) {
      const user = await this.userModel.findById(userId).lean();
      if (!user) throw new BadRequestException('user not found');
      const isAdmin = this.isAdminOrAbove(user as any);
      if (!isAdmin) throw new ForbiddenException('not allowed');
    }

    if (r.status !== 'upcoming') {
      throw new BadRequestException('only upcoming reservations can be cancelled');
    }

    const now = new Date();
    if (new Date(r.start).getTime() <= now.getTime()) {
      throw new BadRequestException('only upcoming reservations can be cancelled');
    }

    r.status = 'canceled';
    (r as any).approvalState = 'not_approved';
    await r.save();

    return { message: 'Reservation cancelled' };
  }

  async listForRoom(roomId: string, date?: string, status: ReservationStatus | 'all' = 'upcoming') {
    await this.markElapsedUpcomingAsDone({ room: new Types.ObjectId(roomId) });

    const q: any = { room: new Types.ObjectId(roomId), isDeleted: { $ne: true } };
    if (status !== 'all') {
      q.status = status;
    }
    if (date) {
      const d = new Date(date); d.setHours(0,0,0,0);
      const d2 = new Date(d); d2.setDate(d2.getDate()+1);
      q.start = { $gte: d, $lt: d2 };
    }
    return this.reservationModel.find(q).populate('user', 'email name').exec();
  }

  async listAllForAdmin(filters: AdminReservationFilters = {}) {
    await this.markElapsedUpcomingAsDone();

    const q: any = { isDeleted: { $ne: true } };
    const page = Number.isFinite(filters.page) && (filters.page as number) > 0 ? Math.floor(filters.page as number) : 1;
    const rawLimit = Number.isFinite(filters.limit) && (filters.limit as number) > 0 ? Math.floor(filters.limit as number) : 20;
    const limit = Math.min(200, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;

    if (filters.status && filters.status !== 'all') {
      q.status = filters.status;
    }

    if (filters.room) {
      q.room = new Types.ObjectId(filters.room);
    }

    if (filters.user) {
      q.user = new Types.ObjectId(filters.user);
    }

    if (filters.date) {
      const d = new Date(filters.date);
      d.setHours(0, 0, 0, 0);
      const d2 = new Date(d);
      d2.setDate(d2.getDate() + 1);
      q.start = { $gte: d, $lt: d2 };
    }

    const [rows, total] = await Promise.all([
      this.reservationModel
        .find(q)
        .populate('user', 'email name roles')
        .populate('room', 'name type floor')
        .sort({ start: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.reservationModel.countDocuments(q).exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      },
    };
  }

  async listForUser(targetUserId: string, actorUserId: string, date?: string, status: ReservationStatus | 'all' = 'all') {
    const actor = await this.userModel.findById(actorUserId).lean();
    if (!actor) throw new BadRequestException('user not found');

    await this.markElapsedUpcomingAsDone({ user: new Types.ObjectId(targetUserId) });

    const isSelf = String(targetUserId) === String(actorUserId);
    if (!isSelf && !this.isAdminOrAbove(actor as any)) {
      throw new ForbiddenException('not allowed');
    }

    const q: any = { user: new Types.ObjectId(targetUserId), isDeleted: { $ne: true } };
    if (status !== 'all') {
      q.status = status;
    }
    if (date) {
      const d = new Date(date); d.setHours(0, 0, 0, 0);
      const d2 = new Date(d); d2.setDate(d2.getDate() + 1);
      q.start = { $gte: d, $lt: d2 };
    }

    return this.reservationModel
      .find(q)
      .populate('room', 'name type floor')
      .sort({ start: 1 })
      .exec();
  }

  async dashboardForUser(userId: string) {
    await this.markElapsedUpcomingAsDone({ user: new Types.ObjectId(userId) });

    const reservations = await this.reservationModel
      .find({ user: new Types.ObjectId(userId), isDeleted: { $ne: true } })
      .populate('room', 'name type floor')
      .sort({ start: 1 })
      .exec();

    const pending = reservations.filter((r: any) => r.status === 'pending');
    const upcoming = reservations.filter((r: any) => r.status === 'upcoming');
    const history = reservations
      .filter((r: any) => ['done', 'rejected', 'canceled'].includes(r.status))
      .sort((a: any, b: any) => new Date(b.end).getTime() - new Date(a.end).getTime());

    return {
      now: new Date().toISOString(),
      counts: {
        upcoming: upcoming.length,
        pending: pending.length,
        history: history.length,
      },
      upcoming,
      pending,
      history,
    };
  }

  async availabilityForRoomDay(roomId: string, date: string) {
    if (!date) throw new BadRequestException('date is required (YYYY-MM-DD)');

    const d = new Date(date);
    if (isNaN(d.getTime())) throw new BadRequestException('invalid date');
    d.setHours(0, 0, 0, 0);
    const d2 = new Date(d);
    d2.setDate(d2.getDate() + 1);

    const reservations = await this.reservationModel.find({
      room: new Types.ObjectId(roomId),
      isDeleted: { $ne: true },
      status: { $in: ['upcoming', 'approved'] },
      start: { $gte: d, $lt: d2 },
    }).select('_id start end').lean().exec();

    const blocks: Array<{ start: string; end: string; isFree: boolean; reservationId: string | null }> = [];
    for (let minutes = this.openMinutes; minutes < this.closeMinutes; minutes += 60) {
      const blockStart = new Date(d);
      blockStart.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      const blockEnd = new Date(blockStart);
      blockEnd.setMinutes(blockEnd.getMinutes() + 60);

      const overlap = reservations.find((r: any) => new Date(r.start) < blockEnd && new Date(r.end) > blockStart);
      blocks.push({
        start: blockStart.toISOString(),
        end: blockEnd.toISOString(),
        isFree: !overlap,
        reservationId: overlap ? String(overlap._id) : null,
      });
    }

    return {
      roomId,
      date: d.toISOString(),
      blocks,
    };
  }

  async listPending() {
    return this.reservationModel.find({ status: 'pending', isDeleted: { $ne: true } }).populate('user', 'email name roles').populate('room', 'name type floor').exec();
  }

  async reviewReservation(reservationId: string, reviewerId: string, approve: boolean, reviewNote?: string) {
    const reviewer = await this.userModel.findById(reviewerId).lean();
    if (!reviewer) throw new BadRequestException('reviewer not found');
    if (!this.isAdminOrAbove(reviewer as any)) {
      throw new ForbiddenException('only admin/super_admin can review reservations');
    }

    const reservation = await this.reservationModel.findOne({ _id: new Types.ObjectId(reservationId), isDeleted: { $ne: true } }).exec();
    if (!reservation) throw new BadRequestException('reservation not found');
    if (reservation.status !== 'pending') {
      throw new BadRequestException('only pending reservations can be reviewed');
    }

    if (approve) {
      const overlap = await this.hasApprovedOverlap(reservation.room, reservation.start, reservation.end, reservationId);
      if (overlap) throw new ForbiddenException('cannot approve: time slot already booked');
      reservation.status = 'upcoming';
      (reservation as any).approvalState = 'approved';
    } else {
      reservation.status = 'rejected';
      (reservation as any).approvalState = 'not_approved';
    }

    reservation.reviewedBy = new Types.ObjectId(reviewerId);
    reservation.reviewedAt = new Date();
    reservation.reviewNote = reviewNote;

    return reservation.save();
  }
}