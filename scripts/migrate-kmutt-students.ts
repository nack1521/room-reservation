import { connect, connection, model } from 'mongoose';
import { UserSchema } from '../src/user/schemas/user.schema';
import { Role } from '../src/auth/roles.enum';

type UserRow = {
  _id: string;
  email: string;
  roles: string[];
};

const User = model('User', UserSchema);

const isElevated = (roles: string[] = []) => {
  return roles.includes(Role.TEACHER) || roles.includes(Role.ADMIN) || roles.includes(Role.SUPER_ADMIN);
};

const normalizeRoles = (roles: string[] = []) => {
  const filtered = roles.filter((r) => r !== Role.USER);
  const withStudent = filtered.includes(Role.STUDENT) ? filtered : [...filtered, Role.STUDENT];
  return Array.from(new Set(withStudent));
};

async function run() {
  const mongo = process.env.MONGO_URI || 'mongodb://localhost:27017/room-reservation';
  const dryRun = String(process.env.DRY_RUN || '').toLowerCase() === 'true';

  await connect(mongo, {});
  console.log(`[migrate-kmutt-students] connected to ${mongo}`);

  const query = {
    email: { $regex: /@mail\.kmutt\.ac\.th$/i },
    roles: { $in: [Role.USER] },
    isDeleted: { $ne: true },
  };

  const users = (await User.find(query).select('_id email roles').lean().exec()) as unknown as UserRow[];
  console.log(`[migrate-kmutt-students] matched users: ${users.length}`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    const roles = user.roles || [];

    if (isElevated(roles)) {
      skippedCount += 1;
      continue;
    }

    const nextRoles = normalizeRoles(roles);

    if (dryRun) {
      console.log(`DRY_RUN -> ${user.email} | ${JSON.stringify(roles)} => ${JSON.stringify(nextRoles)}`);
      updatedCount += 1;
      continue;
    }

    await User.updateOne({ _id: user._id }, { $set: { roles: nextRoles } }).exec();
    console.log(`UPDATED -> ${user.email} | ${JSON.stringify(roles)} => ${JSON.stringify(nextRoles)}`);
    updatedCount += 1;
  }

  console.log(`[migrate-kmutt-students] done. updated=${updatedCount} skipped=${skippedCount} dryRun=${dryRun}`);

  await connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('[migrate-kmutt-students] failed:', err);
  process.exit(1);
});
