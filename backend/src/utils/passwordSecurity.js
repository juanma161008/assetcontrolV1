import env from "../config/env.js";

export const PASSWORD_HISTORY_LIMIT = Math.max(1, Number(env.PASSWORD_HISTORY_LIMIT) || 5);

const getComparator = (hashService) => {
  if (typeof hashService?.compareHash === "function") {
    return hashService.compareHash.bind(hashService);
  }

  if (typeof hashService?.compare === "function") {
    return hashService.compare.bind(hashService);
  }

  return null;
};

const normalizeHashes = (hashes = []) => {
  const seen = new Set();
  const normalized = [];

  for (const value of Array.isArray(hashes) ? hashes : []) {
    const hash = String(value || "").trim();
    if (!hash || seen.has(hash)) {
      continue;
    }

    seen.add(hash);
    normalized.push(hash);
  }

  return normalized;
};

export const buildPasswordReuseMessage = () =>
  `No puedes reutilizar ninguna de tus ultimas ${PASSWORD_HISTORY_LIMIT} contrasenas.`;

export const loadRecentPasswordHashes = async (usuarioRepository, userId, limit = PASSWORD_HISTORY_LIMIT) => {
  if (!usuarioRepository || typeof usuarioRepository.getRecentPasswordHashes !== "function") {
    return [];
  }

  const hashes = await usuarioRepository.getRecentPasswordHashes(userId, limit);
  return normalizeHashes(hashes);
};

export const isPasswordReused = async ({
  candidatePassword,
  currentPasswordHash = null,
  previousPasswordHashes = [],
  hashService
}) => {
  const comparator = getComparator(hashService);
  if (!comparator) {
    return false;
  }

  const candidate = String(candidatePassword || "");
  const hashes = normalizeHashes([currentPasswordHash, ...previousPasswordHashes]);

  for (const hash of hashes) {
    try {
      if (await comparator(candidate, hash)) {
        return true;
      }
    } catch {
      // Ignore invalid hashes and keep checking the rest of the history.
    }
  }

  return false;
};

export const assertPasswordNotReused = async (args = {}) => {
  const reused = await isPasswordReused(args);

  if (reused) {
    throw new Error(buildPasswordReuseMessage());
  }

  return true;
};
