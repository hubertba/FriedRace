import { describe, expect, test } from "vitest";
import * as THREE from "three";
import { createAsphaltTexture, createGrassTexture, setTextureWorldRepeat } from "../../src/visuals/ProceduralTextures";

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

test("scales grass repetition in world metres",()=>{const texture=createGrassTexture(32);setTextureWorldRepeat(texture,6240,8040,8);expect(texture.repeat.x).toBe(780);expect(texture.repeat.y).toBe(1005);texture.dispose();});

test("creates a deterministic repeating asphalt texture", () => {
  const texture = createAsphaltTexture(32);
  expect(texture.wrapS).toBe(THREE.RepeatWrapping); expect(texture.wrapT).toBe(THREE.RepeatWrapping); expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  expect(new Set(texture.userData.pixelData as number[]).size).toBeGreaterThan(5); texture.dispose();
});
