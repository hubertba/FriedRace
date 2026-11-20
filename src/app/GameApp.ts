export class GameApp {
  private readonly canvas: HTMLCanvasElement;
  private readonly loadingStatus: HTMLDivElement;

  constructor(private readonly root: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.dataset.gameCanvas = "";
    this.canvas.setAttribute("aria-label", "Fried Race Spielfläche");

    this.loadingStatus = document.createElement("div");
    this.loadingStatus.dataset.testid = "loading-status";
    this.loadingStatus.className = "loading-status";
    this.loadingStatus.textContent = "Fried Race wird geladen …";
  }

  async start(): Promise<void> {
    this.root.replaceChildren(this.canvas, this.loadingStatus);
  }

  dispose(): void {
    this.root.replaceChildren();
  }
}
