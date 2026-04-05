import { Schema, Document } from 'mongoose';
import { AddOnItem, getAddOnsByType } from '../constants/addons-by-type';

export interface IRoom extends Document {
  name: string;
  description?: string;
  floor?: string;
  type?: string;
  capacity?: number;
  location?: string;
  addOnsByType?: AddOnItem[];
}

const AddOnSchema = new Schema<AddOnItem>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    unit: { type: String, required: true },
    max: { type: Number, required: true },
  },
  { _id: false },
);

export const RoomSchema = new Schema<IRoom>({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  floor: { type: String },
  type: { type: String },
  capacity: { type: Number, default: 0 },
  location: { type: String },
  addOnsByType: { type: [AddOnSchema], default: [] },
});

RoomSchema.pre('validate', function ensureTypeAddOns(next) {
  this.addOnsByType = getAddOnsByType(this.type);
  next();
});