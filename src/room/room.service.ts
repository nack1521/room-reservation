import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IRoom } from './schemas/room.schema';
import { IAddOn } from './schemas/addon.schema';
import { faker } from '@faker-js/faker';
import { ADDONS_BY_TYPE, getAddOnsByType } from './constants/addons-by-type';

type RoomSearchQuery = {
  q?: string;
  type?: string;
  floor?: string;
  location?: string;
  minCapacity?: string;
  maxCapacity?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class RoomService {
  constructor(
    @InjectModel('Room') private roomModel: Model<IRoom>,
    @InjectModel('AddOn') private addOnModel: Model<IAddOn>,
  ) {}

  async listAddOns(roomType?: string) {
    const q: any = {};
    if (roomType) {
      q.roomType = roomType;
    }
    return this.addOnModel.find(q).sort({ roomType: 1, addOnId: 1 }).exec();
  }

  async createAddOn(data: { roomType: string; addOnId: string; label: string; unit: string; max: number }) {
    return this.addOnModel
      .findOneAndUpdate(
        { roomType: data.roomType, addOnId: data.addOnId },
        { $set: data },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async bulkCreateAddOns(items: Array<{ roomType: string; addOnId: string; label: string; unit: string; max: number }>) {
    if (!Array.isArray(items) || !items.length) {
      return { ok: false, count: 0, message: 'items must be a non-empty array' };
    }

    const ops = items.map((item) => ({
      updateOne: {
        filter: { roomType: item.roomType, addOnId: item.addOnId },
        update: { $set: item },
        upsert: true,
      },
    }));

    const result = await this.addOnModel.bulkWrite(ops, { ordered: false });
    const count = (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.matchedCount || 0);
    return { ok: true, count, result };
  }

  async seedAddOnsFromConstants() {
    const items: Array<{ roomType: string; addOnId: string; label: string; unit: string; max: number }> = [];

    Object.entries(ADDONS_BY_TYPE).forEach(([roomType, addOns]) => {
      addOns.forEach((a) => {
        items.push({
          roomType,
          addOnId: a.id,
          label: a.label,
          unit: a.unit,
          max: a.max,
        });
      });
    });

    return this.bulkCreateAddOns(items);
  }

  async list(query: RoomSearchQuery = {}) {
    const {
      q,
      type,
      floor,
      location,
      minCapacity,
      maxCapacity,
      page = '1',
      limit = '20',
      sortBy = 'name',
      sortOrder = 'asc',
    } = query;

    const filters: any = {};

    if (q && q.trim()) {
      const rx = new RegExp(escapeRegex(q.trim()), 'i');
      filters.$or = [
        { name: rx },
        { description: rx },
        { floor: rx },
        { type: rx },
        { location: rx },
      ];
    }

    if (type && type.trim()) {
      filters.type = new RegExp(`^${escapeRegex(type.trim())}$`, 'i');
    }

    if (floor && floor.trim()) {
      filters.floor = new RegExp(`^${escapeRegex(floor.trim())}$`, 'i');
    }

    if (location && location.trim()) {
      filters.location = new RegExp(escapeRegex(location.trim()), 'i');
    }

    const capacity: any = {};
    const minCapNum = Number(minCapacity);
    const maxCapNum = Number(maxCapacity);
    if (!Number.isNaN(minCapNum)) capacity.$gte = minCapNum;
    if (!Number.isNaN(maxCapNum)) capacity.$lte = maxCapNum;
    if (Object.keys(capacity).length) {
      filters.capacity = capacity;
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const allowedSort: Record<string, string> = {
      name: 'name',
      capacity: 'capacity',
      floor: 'floor',
      type: 'type',
      location: 'location',
    };
    const sortField = allowedSort[sortBy] || 'name';
    const sortDirection = (sortOrder || '').toLowerCase() === 'desc' ? -1 : 1;

    const [items, total] = await Promise.all([
      this.roomModel
        .find(filters)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limitNum)
        .exec(),
      this.roomModel.countDocuments(filters).exec(),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async create(data: Partial<IRoom>) {
    const payload = {
      ...data,
      addOnsByType: getAddOnsByType(data.type),
    };
    const r = new this.roomModel(payload);
    return r.save();
  }

  async bulkCreate(data: Array<Partial<IRoom>>) {
    const payload = data.map((item) => ({
      ...item,
      addOnsByType: getAddOnsByType(item.type),
    }));

    try {
      const rooms = await this.roomModel.insertMany(payload, { ordered: false });
      return { ok: true, count: rooms.length, rooms };
    } catch (error: any) {
      const inserted = error?.insertedDocs || [];
      const writeErrors = (error?.writeErrors || []).map((e: any) => ({
        index: e.index,
        message: e.errmsg || e.message,
      }));

      return {
        ok: false,
        count: inserted.length,
        rooms: inserted,
        writeErrors,
        message: 'Some rooms could not be inserted (likely duplicate names).',
      };
    }
  }

  async findById(id: string) {
    return this.roomModel.findById(id).exec();
  }

  // Controller-friendly aliases expected by room.controller.ts
  async findAll() {
    return this.list();
  }

  async findOne(id: string) {
    return this.findById(String(id));
  }

  async update(id: string, update: Partial<IRoom>) {
    const payload = {
      ...update,
      ...(update.type !== undefined ? { addOnsByType: getAddOnsByType(update.type) } : {}),
    };

    return this.roomModel.findByIdAndUpdate(String(id), payload, { new: true }).exec();
  }

  async remove(id: string) {
    return this.roomModel.findByIdAndDelete(String(id)).exec();
  }

  // Seed fake rooms (can be called from controller)
  async seedFaker(count = 20) {
    const created: any[] = [];
    const roomTypes = Object.keys(ADDONS_BY_TYPE);

    for (let i = 0; i < count; i++) {
      const name = `${faker.word.adjective({ length: { min: 4, max: 10 } })} Room ${faker.string.alphanumeric(3).toUpperCase()}`;
      const description = faker.lorem.sentence();
      const capacity = faker.number.int({ min: 10, max: 120 });
      const location = `${faker.location.city()}, Building ${faker.word.sample()}`;
      const type = faker.helpers.arrayElement(roomTypes);
      const addOnsByType = getAddOnsByType(type);

      const doc = await this.roomModel.findOneAndUpdate(
        { name },
        { $setOnInsert: { name, description, type, capacity, location, addOnsByType } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).exec();

      created.push(doc);
    }
    return { ok: true, count: created.length, rooms: created };
  }
}
