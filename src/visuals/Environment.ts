import * as THREE from "three";

export const configureRenderer = (renderer: THREE.WebGLRenderer, shadows = true): void => {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
};

export const createEnvironment = (scene: THREE.Scene): { sun: THREE.DirectionalLight; update(point: {x:number;z:number}): void; dispose(): void } => {
  scene.background = new THREE.Color(0x87a9be); scene.fog = new THREE.Fog(0xa9aa91, 260, 1350);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { topColor: { value: new THREE.Color(0x5f91bd) }, horizonColor: { value: new THREE.Color(0xe6ad78) } },
    vertexShader: "varying float vHeight; void main(){vHeight=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "uniform vec3 topColor;uniform vec3 horizonColor;varying float vHeight;void main(){float h=smoothstep(-0.15,0.72,vHeight);gl_FragColor=vec4(mix(horizonColor,topColor,h),1.0);}",
  })); sky.name = "warm-sky"; scene.add(sky);
  const fill = new THREE.HemisphereLight(0xc7dded, 0x4c452c, 1.45); fill.name = "environment-fill"; scene.add(fill);
  const sunOffset = new THREE.Vector3(-130, 180, 95);
  const sun = new THREE.DirectionalLight(0xffd2a1, 3.25); sun.name = "late-afternoon-sun"; sun.position.copy(sunOffset); sun.castShadow = true; sun.target.name = "late-afternoon-sun-target";
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -55; sun.shadow.camera.right = 55; sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55; sun.shadow.camera.near = 1; sun.shadow.camera.far = 360; sun.shadow.bias = -0.0003; scene.add(sun, sun.target);
  return {
    sun,
    update: (point) => {
      sky.position.set(point.x, 0, point.z);
      sun.target.position.set(point.x, 0, point.z);
      sun.position.copy(sun.target.position).add(sunOffset);
      sun.target.updateMatrixWorld();
      sun.updateMatrixWorld();
    },
    dispose: () => { scene.remove(sky, fill, sun, sun.target); sky.geometry.dispose(); (sky.material as THREE.Material).dispose(); sun.dispose(); },
  };
};
