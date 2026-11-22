import { expect, test } from "vitest";
import * as THREE from "three";
import { configureRenderer, createEnvironment } from "../../src/visuals/Environment";

test("configures filmic desktop rendering", () => {
  const renderer = { shadowMap: { enabled: false, type: 0 }, toneMapping: 0, toneMappingExposure: 0, outputColorSpace: "" } as unknown as THREE.WebGLRenderer;
  configureRenderer(renderer);
  expect(renderer.shadowMap.enabled).toBe(true);
  expect(renderer.shadowMap.type).toBe(THREE.PCFShadowMap);
  expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
  expect(renderer.toneMappingExposure).toBeGreaterThan(1);
  expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
  const lowGraphics = { shadowMap: { enabled: true, type: 0 }, toneMapping: 0, toneMappingExposure: 0, outputColorSpace: "" } as unknown as THREE.WebGLRenderer;
  configureRenderer(lowGraphics, false); expect(lowGraphics.shadowMap.enabled).toBe(false);
});

test("creates and disposes a warm sky and shadow-casting sun", () => {
  const scene = new THREE.Scene(); const environment = createEnvironment(scene);
  expect(scene.background).toBeInstanceOf(THREE.Color);
  expect(scene.fog).toBeInstanceOf(THREE.Fog);
  expect(scene.getObjectByName("warm-sky")).toBeTruthy();
  expect(environment.sun.castShadow).toBe(true);
  expect(environment.sun.color.r).toBeGreaterThan(environment.sun.color.b);
  environment.dispose();
  expect(scene.getObjectByName("warm-sky")).toBeFalsy();
  expect(scene.children).not.toContain(environment.sun);
});
