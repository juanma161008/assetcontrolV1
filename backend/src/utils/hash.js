import bcrypt from "bcrypt";

export const hash = async (value) => {
  const saltRounds = 10;
  return await bcrypt.hash(value, saltRounds);
};

export const compareHash = async (value, hashed) => {
  return await bcrypt.compare(value, hashed);
};

const hashUtil = {
  hash,
  compare: compareHash,
  compareHash
};

export default hashUtil;
