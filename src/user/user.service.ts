import { Injectable, BadRequestException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';

@Injectable()
export class UserService {
  constructor(@InjectModel('User') private userModel: Model<User>) {}

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  async create(payload: Partial<User>) {
    if (!payload.email) throw new BadRequestException('Email is required');
    const exists = await this.findByEmail(payload.email);
    if (exists) throw new BadRequestException('Email already exists');
    const created = new this.userModel(payload);
    return created.save();
  }

  async grantTeacher(userId: string) {
    return this.userModel.findByIdAndUpdate(userId, { $addToSet: { roles: 'teacher' }, $pull: { roles: 'pending' } }, { new: true }).exec();
  }
  async updateById(id: string, update: Partial<User>) {
    return this.userModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async updatePhoneNumber(id: string, phoneNumber: string) {
    return this.userModel.findByIdAndUpdate(id, { phoneNumber }, { new: true }).exec();
  }
}