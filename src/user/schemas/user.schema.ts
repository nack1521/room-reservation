import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Role } from 'src/auth/roles.enum';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  password: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: [String], enum: Object.values(Role), default: [Role.USER] })
  roles: string[]

  @Prop()
  googleId: string;

  @Prop()
  picture?: string;

  @Prop()
  createdAt: Date;

  @Prop({ default: null })
  deletedAt: Date;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});