import * as THREE from "three";

export class ChaseCamera {
  private readonly desired = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  update(target: THREE.Object3D, dt: number): void {
    this.desired.set(0, 5.5, 10).applyQuaternion(target.quaternion).add(target.position);
    this.camera.position.lerp(this.desired, 1 - Math.exp(-6 * dt));
    this.lookAt.copy(target.position).add(new THREE.Vector3(0, 1, 0));
    this.camera.lookAt(this.lookAt);
  }
}
