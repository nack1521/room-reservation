import { Schema, Document } from 'mongoose';

export interface IAddOn extends Document {
  roomType: string;
  addOnId: string;
  label: string;
  unit: string;
  max: number;
  createdAt: Date;
  updatedAt: Date;
}

export const AddOnSchema = new Schema<IAddOn>(
  {
    roomType: { type: String, required: true, trim: true },
    addOnId: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    max: { type: Number, required: true, min: 1 },
  },
  {
    timestamps: true,
  },
);

AddOnSchema.index({ roomType: 1, addOnId: 1 }, { unique: true });
