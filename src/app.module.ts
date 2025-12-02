import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RoomModule } from './room/room.module';
import { ReservationModule } from './reservation/reservation.module';
import { SemesterResetService } from './scheduler/semester-reset.service';
import { SchedulerModule } from './scheduler/scheduler.module';
import * as process from 'process';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGO_URI || 'mongodb://localhost:27017/room-reservation'),
    AuthModule,
    UserModule,
    RoomModule,
    ReservationModule,
    SchedulerModule,
  ],
  providers: [SemesterResetService],
})
export class AppModule {}
