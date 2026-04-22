import { describe, expect, it } from "vitest";
import {
  ADJUNTOS_LIMITS,
  estimateBase64Bytes,
  getAdjuntosMeta,
  normalizeAdjuntos
} from "../src/utils/adjuntos.js";

describe("normalizeAdjuntos", () => {
  it("devuelve [] si no es array", () => {
    expect(normalizeAdjuntos(null)).toEqual([]);
    expect(normalizeAdjuntos({})).toEqual([]);
  });

  it("filtra adjuntos invalidos", () => {
    const adjuntos = [
      { dataUrl: "data:image/png;base64,AAA=", type: "image/png", size: 100, name: "ok.png" },
      { dataUrl: "data:image/png;base64,AAA=", type: "image/png", size: 3 * 1024 * 1024 },
      { dataUrl: "data:application/pdf;base64,AAA=", type: "application/pdf", size: 100 },
      { dataUrl: "data:text/plain;base64,AAA=", type: "text/plain", size: 100 },
      { dataUrl: "", type: "image/png", size: 100 }
    ];
    const result = normalizeAdjuntos(adjuntos);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("ok.png");
    expect(result[1].type).toBe("application/pdf");
  });

  it("acepta url, nombre y tipo por defecto", () => {
    const adjuntos = [
      null,
      { url: "data:image/png;base64,QUJD", size: 0 },
      { dataUrl: "data:application/pdf;base64,AAA=", type: "application/pdf", size: 100, name: "doc.pdf" }
    ];

    const result = normalizeAdjuntos(adjuntos);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: "archivo",
      type: "application/octet-stream",
      size: 3,
      dataUrl: "data:image/png;base64,QUJD"
    });
    expect(result[1].name).toBe("doc.pdf");
  });

  it("estima bytes base64 cuando no se entrega size", () => {
    expect(estimateBase64Bytes()).toBe(0);
    expect(estimateBase64Bytes(null)).toBe(0);
    expect(estimateBase64Bytes("data:image/png;base64")).toBe(0);
    expect(estimateBase64Bytes("data:image/png;base64,")).toBe(0);
    expect(estimateBase64Bytes("data:image/png;base64,QUJD")).toBe(3);
  });

  it("limita cantidad maxima", () => {
    const adjuntos = Array.from({ length: 10 }, (_, i) => ({
      dataUrl: "data:image/png;base64,AAA=",
      type: "image/png",
      size: 100,
      name: `f${i}.png`
    }));
    const result = normalizeAdjuntos(adjuntos);
    expect(result.length).toBe(ADJUNTOS_LIMITS.maxAdjuntos);
  });
});

describe("getAdjuntosMeta", () => {
  it("devuelve solo meta", () => {
    const adjuntos = [
      { dataUrl: "data:image/png;base64,AAA=", type: "image/png", size: 100, name: "ok.png" }
    ];
    const meta = getAdjuntosMeta(adjuntos);
    expect(meta[0]).toEqual({ name: "ok.png", type: "image/png", size: 100 });
  });
});
