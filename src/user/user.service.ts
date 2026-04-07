import { Injectable, BadRequestException } from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { Role } from '../auth/roles.enum';

@Injectable()
export class UserService {
  constructor(@InjectModel('User') private userModel: Model<User>) {}

  private normalizeEmail(email: string) {
    return (email || '').trim().toLowerCase();
  }

  isStudentEmail(email: string) {
    return /@mail\.kmutt\.ac\.th$/i.test(this.normalizeEmail(email));
  }

  getDefaultRolesForEmail(email: string): Role[] {
    return this.isStudentEmail(email) ? [Role.STUDENT] : [Role.USER];
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: this.normalizeEmail(email) }).exec();
  }

  async findById(id: string) {
    return this.userModel.findById(id).exec();
  }

  async create(payload: Partial<User>) {
    if (!payload.email) throw new BadRequestException('Email is required');
    const normalizedEmail = this.normalizeEmail(payload.email);
    const exists = await this.findByEmail(normalizedEmail);
    if (exists) throw new BadRequestException('Email already exists');
    const created = new this.userModel({
      ...payload,
      email: normalizedEmail,
      roles: this.getDefaultRolesForEmail(normalizedEmail),
    });
    return created.save();
  }

  async grantTeacher(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) return null;

    const roles = new Set(user.roles || []);
    roles.delete(Role.PENDING);
    roles.add(Role.TEACHER);
    user.roles = Array.from(roles);
    return user.save();
  }

  async requestTeacherRole(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new BadRequestException('user not found');

    const roles = user.roles || [];
    if (roles.includes(Role.ADMIN) || roles.includes(Role.SUPER_ADMIN) || roles.includes(Role.TEACHER)) {
      throw new BadRequestException('user already has elevated role');
    }

    if (roles.includes(Role.PENDING)) {
      return user;
    }

    user.roles = [...roles, Role.PENDING];
    return user.save();
  }

  async listPendingTeacherRequests() {
    return this.userModel
      .find({ roles: Role.PENDING, isDeleted: { $ne: true } })
      .select('email name roles picture createdAt')
      .exec();
  }

  async approveTeacherRequest(userId: string) {
    const updated = await this.grantTeacher(userId);
    if (!updated) throw new BadRequestException('user not found');
    return updated;
  }

  async rejectTeacherRequest(userId: string) {
    const updated = await this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { roles: Role.PENDING } },
      { new: true },
    ).exec();
    if (!updated) throw new BadRequestException('user not found');
    return updated;
  }

  async grantAdminRole(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new BadRequestException('user not found');

    const roles = new Set(user.roles || []);
    roles.delete(Role.PENDING);
    roles.add(Role.ADMIN);
    user.roles = Array.from(roles);

    const updated = await user.save();
    if (!updated) throw new BadRequestException('user not found');
    return updated;
  }

  async updateById(id: string, update: Partial<User>) {
    return this.userModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async updatePhoneNumber(id: string, phoneNumber: string) {
    return this.userModel.findByIdAndUpdate(id, { phoneNumber }, { new: true }).exec();
  }
}