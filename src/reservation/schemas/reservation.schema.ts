import { Schema, Document, Types } from 'mongoose';

export type ReservationAddOn = {
  addOnId: string;
  label: string;
  unit: string;
  qty: number;
};

export interface IReservation extends Document {
  room: Types.ObjectId;
  user: Types.ObjectId;
  start: Date;
  end: Date;
  note?: string;
  addOns?: ReservationAddOn[];
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  createdAt: Date;
}

const ReservationAddOnSchema = new Schema<ReservationAddOn>(
  {
    addOnId: { type: String, required: true },
    label: { type: String, required: true },
    unit: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

export const ReservationSchema = new Schema<IReservation>({
  room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  note: { type: String },
  addOns: { type: [ReservationAddOnSchema], default: [] },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNote: { type: String },
  createdAt: { type: Date, default: () => new Date() },
});
ReservationSchema.index({ room: 1, start: 1, end: 1 });