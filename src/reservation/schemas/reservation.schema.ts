import { Schema, Document, Types } from 'mongoose';

export interface IReservation extends Document {
  room: Types.ObjectId;
  user: Types.ObjectId;
  start: Date;
  end: Date;
  note?: string;
  createdAt: Date;
}

export const ReservationSchema = new Schema<IReservation>({
  room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  note: { type: String },
  createdAt: { type: Date, default: () => new Date() },
});
ReservationSchema.index({ room: 1, start: 1, end: 1 });