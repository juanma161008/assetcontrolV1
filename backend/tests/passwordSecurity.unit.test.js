import { describe, it, expect, vi } from "vitest";
import hashUtil, { hash } from "../src/utils/hash.js";
import {
  PASSWORD_HISTORY_LIMIT,
  assertPasswordNotReused,
  buildPasswordReuseMessage,
  isPasswordReused,
  loadRecentPasswordHashes
} from "../src/utils/passwordSecurity.js";

describe("passwordSecurity", () => {
  it("expone un mensaje claro de reutilizacion", () => {
    expect(buildPasswordReuseMessage()).toContain(String(PASSWORD_HISTORY_LIMIT));
  });

  it("detecta cuando una contrasena coincide con el historial", async () => {
    const previousHash = await hash("Admin123!Strong");

    await expect(
      isPasswordReused({
        candidatePassword: "Admin123!Strong",
        previousPasswordHashes: [previousHash],
        hashService: hashUtil
      })
    ).resolves.toBe(true);

    await expect(
      isPasswordReused({
        candidatePassword: "OtraClave123!",
        previousPasswordHashes: [previousHash],
        hashService: hashUtil
      })
    ).resolves.toBe(false);
  });

  it("lanza error cuando la nueva contrasena ya fue usada", async () => {
    const previousHash = await hash("Admin123!Strong");

    await expect(
      assertPasswordNotReused({
        candidatePassword: "Admin123!Strong",
        previousPasswordHashes: [previousHash],
        hashService: hashUtil
      })
    ).rejects.toThrow(/reutilizar/i);
  });

  it("loadRecentPasswordHashes normaliza hashes repetidos", async () => {
    const repo = {
      getRecentPasswordHashes: vi.fn().mockResolvedValue([" a ", "a", "", null, "b"])
    };

    const hashes = await loadRecentPasswordHashes(repo, 9);
    expect(hashes).toEqual(["a", "b"]);
    expect(repo.getRecentPasswordHashes).toHaveBeenCalledWith(9, PASSWORD_HISTORY_LIMIT);
  });
});
