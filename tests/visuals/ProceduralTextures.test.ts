import { describe, expect, test } from "vitest";
import * as THREE from "three";
import { createGrassTexture } from "../../src/visuals/ProceduralTextures";

describe("createGrassTexture", () => {
  test("creates a deterministic repeating sRGB texture", () => {
    const first = createGrassTexture(64);
    const second = createGrassTexture(64);
    expect(first).toBeInstanceOf(THREE.CanvasTexture);
    expect(first.wrapS).toBe(THREE.RepeatWrapping);
    expect(first.wrapT).toBe(THREE.RepeatWrapping);
    expect(first.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(first.userData.pixelData).toEqual(second.userData.pixelData);
    expect(new Set(first.userData.pixelData as number[]).size).toBeGreaterThan(8);
    first.dispose(); second.dispose();
  });
});
