const { tx } = require('../db');
const config = require('../config');
const { HttpError } = require('../utils/errors');
const users = require('../repositories/users.repo');
const profiles = require('../repositories/profiles.repo');

const list = (userId) => profiles.listByUser(userId);

async function create(userId, body) {
  return tx(async (c) => {
    await users.lockById(userId, c); // serialise so the limit can't be raced
    if ((await profiles.countByUser(userId, c)) >= config.maxProfiles) {
      throw new HttpError(409, `A maximum of ${config.maxProfiles} profiles is allowed`, 'profile_limit');
    }
    return profiles.insert(userId, body, c);
  });
}

async function update(userId, id, body) {
  const p = await profiles.update(userId, id, body);
  if (!p) throw new HttpError(404, 'Profile not found', 'not_found');
  return p;
}

async function remove(userId, id) {
  await tx(async (c) => {
    await users.lockById(userId, c);
    if ((await profiles.countByUser(userId, c)) <= 1) {
      throw new HttpError(409, 'You cannot delete your last profile', 'last_profile');
    }
    if (!(await profiles.remove(userId, id, c))) throw new HttpError(404, 'Profile not found', 'not_found');
  });
}

module.exports = { list, create, update, remove };
