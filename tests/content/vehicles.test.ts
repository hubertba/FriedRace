import { expect, test } from "vitest";
import { VEHICLES } from "../../src/content/vehicles";

const vehicle = (id: string) => VEHICLES.find((item) => item.id === id)!;

test("uses the approved slower acceleration without changing top speeds", () => {
  expect(vehicle("mitsubishi-eclipse-1995")).toMatchObject({ acceleration: 6, topSpeedKph: 210 });
  expect(vehicle("alpine-rally-rs")).toMatchObject({ acceleration: 7, topSpeedKph: 190 });
  expect(vehicle("trailmaster-4x4")).toMatchObject({ acceleration: 5, topSpeedKph: 155 });
});
