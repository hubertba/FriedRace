import type { ImportedMap } from "../world/mapData";
import type { WorldBounds } from "../world/worldBounds";
import { isValidWaypoint, type Point2 } from "../domain/waypointChallenge";

export class MapOverlay {
  readonly element = document.createElement("div");
  readonly openButton = document.createElement("button");
  private readonly canvas = document.createElement("canvas");
  private readonly confirmButton = document.createElement("button");
  private selected?: Point2;
  private confirmHandler?: (point: Point2) => void;

  constructor(private readonly map: ImportedMap, private readonly bounds: WorldBounds) {
    this.element.className = "map-overlay";
    this.element.hidden = true;
    this.openButton.className = "map-button";
    this.openButton.textContent = "Karte (M)";
    this.openButton.dataset.testid = "open-map";
    this.canvas.width = 720;
    this.canvas.height = 620;
    this.canvas.dataset.testid = "map-canvas";
    this.confirmButton.textContent = "Wegpunkt starten";
    this.confirmButton.disabled = true;
    const close = document.createElement("button");
    close.textContent = "Schließen";
    this.element.append(this.canvas, this.confirmButton, close);
    this.openButton.addEventListener("click", () => this.toggle());
    close.addEventListener("click", () => this.hide());
    this.confirmButton.addEventListener("click", () => {
      if (this.selected) this.confirmHandler?.(this.selected);
      this.hide();
    });
    this.canvas.addEventListener("click", (event) => this.select(event));
    this.draw();
  }

  onConfirm(handler: (point: Point2) => void): void { this.confirmHandler = handler; }
  get isOpen(): boolean { return !this.element.hidden; }
  toggle(): void { this.element.hidden ? this.show() : this.hide(); }
  show(): void { this.element.hidden = false; }
  hide(): void { this.element.hidden = true; }

  private toCanvas(point: Point2): [number, number] {
    return [
      ((point.x - this.bounds.minX) / (this.bounds.maxX - this.bounds.minX)) * this.canvas.width,
      ((point.z - this.bounds.minZ) / (this.bounds.maxZ - this.bounds.minZ)) * this.canvas.height,
    ];
  }

  private select(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
    const point = {
      x: this.bounds.minX + (x / this.canvas.width) * (this.bounds.maxX - this.bounds.minX),
      z: this.bounds.minZ + (y / this.canvas.height) * (this.bounds.maxZ - this.bounds.minZ),
    };
    if (!isValidWaypoint(point, this.bounds)) return;
    this.selected = point;
    this.confirmButton.disabled = false;
    this.draw();
  }

  private draw(): void {
    const context = this.canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#355f35";
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    context.strokeStyle = "#e8e2d2";
    context.lineWidth = 1;
    for (const road of this.map.roads) {
      context.beginPath();
      road.points.forEach((point, index) => {
        const [x, y] = this.toCanvas(point);
        index ? context.lineTo(x, y) : context.moveTo(x, y);
      });
      context.stroke();
    }
    context.fillStyle = "#ffd54f";
    for (const town of this.map.towns) {
      const [x, y] = this.toCanvas(town);
      context.fillRect(x - 3, y - 3, 6, 6);
      context.fillText(town.name, x + 5, y - 5);
    }
    if (this.selected) {
      const [x, y] = this.toCanvas(this.selected);
      context.fillStyle = "#e53935";
      context.beginPath();
      context.arc(x, y, 7, 0, Math.PI * 2);
      context.fill();
    }
  }
}
