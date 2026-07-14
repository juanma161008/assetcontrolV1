import { describe, expect, it } from "vitest";
import { getCanvasPoint, getDrawingPoints } from "./firmaDigital.utils";

function createCanvasMock(left = 10, top = 20) {
  return {
    getBoundingClientRect: () => ({ left, top })
  };
}

describe("firmaDigital utils", () => {
  it("convierte coordenadas al sistema del canvas", () => {
    const canvas = createCanvasMock(12, 18);

    expect(getCanvasPoint({ clientX: 42, clientY: 58 }, canvas)).toEqual({
      x: 30,
      y: 40
    });
  });

  it("usa el primer toque disponible cuando no hay pointer events", () => {
    const points = getDrawingPoints({
      touches: [{ clientX: 100, clientY: 200 }],
      changedTouches: [{ clientX: 1, clientY: 2 }]
    });

    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({ clientX: 100, clientY: 200 });
  });

  it("prefiere los eventos coalescidos para un trazo mas fluido", () => {
    const coalesced = [{ clientX: 1, clientY: 2 }, { clientX: 3, clientY: 4 }];

    const points = getDrawingPoints({
      nativeEvent: {
        getCoalescedEvents: () => coalesced
      }
    });

    expect(points).toBe(coalesced);
  });
});
