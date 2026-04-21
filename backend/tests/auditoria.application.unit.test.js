import { describe, it, expect, vi } from "vitest";

describe("application/auditoria/getAuditoriaLogs", () => {
  it("delegates findAll with filters", async () => {
    vi.resetModules();
    const findAll = vi.fn().mockResolvedValue([{ id: 1, accion: "LOGIN" }]);

    vi.doMock("../src/infrastructure/repositories/LogPgRepository.js", () => ({
      default: class {
        findAll(...args) {
          return findAll(...args);
        }
      }
    }));

    const { getAuditoriaLogs } = await import("../src/application/auditoria/getAuditoriaLogs.js");
    const result = await getAuditoriaLogs({ usuario: "admin" });

    expect(findAll).toHaveBeenCalledWith({ usuario: "admin" });
    expect(result).toEqual([{ id: 1, accion: "LOGIN" }]);
  });
});
