import * as THREE from "three";

const pixelsForGrass = (size: number): Uint8ClampedArray => {
  const pixels = new Uint8ClampedArray(size * size * 4); let state = 0x51f15e;
  for (let index = 0; index < size * size; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const noise = ((state >>> 24) - 128) / 9; const dry = (state & 31) === 0;
    pixels[index * 4] = Math.round((dry ? 112 : 70) + noise);
    pixels[index * 4 + 1] = Math.round((dry ? 118 : 105) + noise);
    pixels[index * 4 + 2] = Math.round((dry ? 54 : 52) + noise * 0.45);
    pixels[index * 4 + 3] = 255;
  }
  return pixels;
};

export const createGrassTexture = (size = 128): THREE.CanvasTexture => {
  const safeSize = Math.max(8, Math.floor(size)); const canvas = document.createElement("canvas"); canvas.width = safeSize; canvas.height = safeSize;
  const pixels = pixelsForGrass(safeSize);
  if (!navigator.userAgent.includes("jsdom")) {
    const context = canvas.getContext("2d");
    if (context) { const image = context.createImageData(safeSize, safeSize); image.data.set(pixels); context.putImageData(image, 0, 0); }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(0.025, 0.025); texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.pixelData = Array.from(pixels); return texture;
};
