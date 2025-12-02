import { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  name: string;
  description?: string;
  capacity?: number;
  location?: string;
}

export const RoomSchema = new Schema<IRoom>({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  capacity: { type: Number, default: 0 },
  location: { type: String },
});