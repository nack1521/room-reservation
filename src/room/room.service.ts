import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IRoom } from './schemas/room.schema';
import { faker } from '@faker-js/faker';

@Injectable()
export class RoomService {
  constructor(@InjectModel('Room') private roomModel: Model<IRoom>) {}

  async list() {
    return this.roomModel.find().exec();
  }

  async create(data: Partial<IRoom>) {
    const r = new this.roomModel(data);
    return r.save();
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
    return this.roomModel.findByIdAndUpdate(String(id), update, { new: true }).exec();
  }

  async remove(id: string) {
    return this.roomModel.findByIdAndDelete(String(id)).exec();
  }

  // Seed fake rooms (can be called from controller)
  async seedFaker(count = 20) {
    const created: any[] = [];
    for (let i = 0; i < count; i++) {
      const name = `${faker.word.adjective({ length: { min: 4, max: 10 } })} Room ${faker.string.alphanumeric(3).toUpperCase()}`;
      const description = faker.lorem.sentence();
      const capacity = faker.number.int({ min: 10, max: 120 });
      const location = `${faker.location.city()}, Building ${faker.word.sample()}`;

      const doc = await this.roomModel.findOneAndUpdate(
        { name },
        { $setOnInsert: { name, description, capacity, location } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).exec();

      created.push(doc);
    }
    return { ok: true, count: created.length, rooms: created };
  }
}
