import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomSchema } from './schemas/room.schema';
import { AddOnSchema } from './schemas/addon.schema';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Room', schema: RoomSchema }, { name: 'AddOn', schema: AddOnSchema }])],
  controllers: [RoomController],
  providers: [RoomService],
  exports: [RoomService],
})
export class RoomModule {}
