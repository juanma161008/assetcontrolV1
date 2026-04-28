import bcrypt from "bcrypt";
import env from "../config/env.js";

export const PASSWORD_HASH_ROUNDS = Math.max(10, Number(env.PASSWORD_HASH_ROUNDS) || 12);

const normalizeValue = (value) => String(value ?? "");

const parseBcryptRounds = (hashed = "") => {
  const value = String(hashed || "");
  const parts = value.split("$");
  const rounds = Number(parts[2]);
  return Number.isFinite(rounds) && rounds > 0 ? rounds : null;
};

export const hash = async (value, rounds = PASSWORD_HASH_ROUNDS) => {
  const saltRounds = Math.max(10, Number(rounds) || PASSWORD_HASH_ROUNDS);
  return await bcrypt.hash(normalizeValue(value), saltRounds);
};

export const compareHash = async (value, hashed) => {
  if (!hashed) {
    return false;
  }

  try {
    return await bcrypt.compare(normalizeValue(value), String(hashed));
  } catch {
    return false;
  }
};

export const getHashRounds = (hashed = "") => parseBcryptRounds(hashed);

export const needsRehash = (hashed, targetRounds = PASSWORD_HASH_ROUNDS) => {
  const currentRounds = parseBcryptRounds(hashed);
  const desiredRounds = Math.max(10, Number(targetRounds) || PASSWORD_HASH_ROUNDS);
  if (!currentRounds) {
    return true;
  }
  return currentRounds < desiredRounds;
};

const hashUtil = {
  hash,
  compare: compareHash,
  compareHash,
  getHashRounds,
  needsRehash,
  PASSWORD_HASH_ROUNDS
};

export default hashUtil;
