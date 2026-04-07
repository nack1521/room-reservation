import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReservationSchema } from './schemas/reservation.schema';
import { ReservationService } from './reservation.service';
import { ReservationController } from './reservation.controller';
import { UserSchema } from '../user/schemas/user.schema';
import { RoomSchema } from '../room/schemas/room.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Reservation', schema: ReservationSchema },
      { name: 'User', schema: UserSchema },
      { name: 'Room', schema: RoomSchema },
    ]),
  ],
  providers: [ReservationService],
  controllers: [ReservationController],
  exports: [ReservationService],
})
export class ReservationModule {}
