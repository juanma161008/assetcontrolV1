import crypto from "node:crypto";

export const PASSWORD_POLICY = {
  minLength: 12,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSymbol: true
};

const hasUpper = (value) => /[A-Z]/.test(value);
const hasLower = (value) => /[a-z]/.test(value);
const hasNumber = (value) => /\d/.test(value);
const hasSymbol = (value) => /[^A-Za-z0-9]/.test(value);

export const validatePassword = (password = "") => {
  const value = String(password || "");
  const errors = [];

  if (value.length < PASSWORD_POLICY.minLength) {
    errors.push("minLength");
  }
  if (PASSWORD_POLICY.requireUpper && !hasUpper(value)) {
    errors.push("upper");
  }
  if (PASSWORD_POLICY.requireLower && !hasLower(value)) {
    errors.push("lower");
  }
  if (PASSWORD_POLICY.requireNumber && !hasNumber(value)) {
    errors.push("number");
  }
  if (PASSWORD_POLICY.requireSymbol && !hasSymbol(value)) {
    errors.push("symbol");
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

export const buildPasswordPolicyMessage = () =>
  `La contraseña debe tener al menos ${PASSWORD_POLICY.minLength} caracteres e incluir mayúscula, minúscula, número y símbolo.`;

const randomInt = (max) => crypto.randomInt(0, max);

const pickRandom = (source) => source[randomInt(source.length)];

const shuffle = (values) => {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
};

export const generateStrongPassword = (length = 16) => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%*?_-";

  const chunks = [];
  const all = [upper, lower, numbers, symbols].join("");

  if (PASSWORD_POLICY.requireUpper) chunks.push(pickRandom(upper));
  if (PASSWORD_POLICY.requireLower) chunks.push(pickRandom(lower));
  if (PASSWORD_POLICY.requireNumber) chunks.push(pickRandom(numbers));
  if (PASSWORD_POLICY.requireSymbol) chunks.push(pickRandom(symbols));

  const targetLength = Math.max(length, PASSWORD_POLICY.minLength, chunks.length);
  while (chunks.length < targetLength) {
    chunks.push(pickRandom(all));
  }

  return shuffle(chunks).join("");
};
