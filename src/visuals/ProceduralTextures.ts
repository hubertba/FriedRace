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

const textureFromPixels = (pixels: Uint8ClampedArray, size: number, repeat: number): THREE.CanvasTexture => {
  const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
  if (!navigator.userAgent.includes("jsdom")) { const context = canvas.getContext("2d"); if (context) { const image = context.createImageData(size, size); image.data.set(pixels); context.putImageData(image, 0, 0); } }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(repeat, repeat); texture.colorSpace = THREE.SRGBColorSpace; texture.userData.pixelData = Array.from(pixels); return texture;
};

export const createGrassTexture = (size = 128): THREE.CanvasTexture => {
  const safeSize = Math.max(8, Math.floor(size)); return textureFromPixels(pixelsForGrass(safeSize), safeSize, 0.025);
};

export const setTextureWorldRepeat = (texture: THREE.Texture, width: number, depth: number, metresPerTile = 8): void => {
  texture.repeat.set(Math.max(1, width / metresPerTile), Math.max(1, depth / metresPerTile));
};

export const createAsphaltTexture = (size = 128): THREE.CanvasTexture => {
  const safeSize = Math.max(8, Math.floor(size)); const pixels = new Uint8ClampedArray(safeSize * safeSize * 4); let state = 0xa54ff53a;
  for (let index = 0; index < safeSize * safeSize; index += 1) { state = (Math.imul(state, 1103515245) + 12345) >>> 0; const shade = 63 + ((state >>> 25) & 15); pixels[index*4]=shade; pixels[index*4+1]=shade+2; pixels[index*4+2]=shade+3; pixels[index*4+3]=255; }
  return textureFromPixels(pixels, safeSize, 0.12);
};
