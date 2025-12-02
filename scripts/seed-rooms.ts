import { connect, connection, model } from 'mongoose';
import { faker } from '@faker-js/faker';
import { RoomSchema } from '../src/room/schemas/room.schema';

const Room = model('Room', RoomSchema);

async function run() {
  const mongo = process.env.MONGO_URI || 'mongodb://localhost:27017/room-reservation';
  await connect(mongo, {});

  const count = Number(process.env.SEED_ROOM_COUNT || 20);
  console.log(`Seeding ${count} rooms into ${mongo}`);

  const created: string[] = [];
  for (let i = 0; i < count; i++) {
    const name = `${faker.word.adjective({ length: { min: 4, max: 10 } })} Room ${faker.string.alphanumeric(3).toUpperCase()}`;
    const description = faker.lorem.sentence();
    const capacity = faker.number.int({ min: 10, max: 120 });
    const location = `${faker.location.city()}, Building ${faker.word.sample()}`;

    // upsert by name to avoid duplicates on re-run
    const doc = await Room.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, description, capacity, location } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    created.push(String(doc._id));
    console.log(` -> ${doc.name} (${doc._id})`);
  }

  console.log(`Done. Created/ensured ${created.length} rooms.`);
  await connection.close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});