import type { MysteryRewardResult } from "../domain/mysteryBox";

export class MysteryBoxView {
  readonly element = document.createElement("div");
  constructor() {
    this.element.className = "mystery-reveal";
    this.element.hidden = true;
  }
  show(result: MysteryRewardResult): void {
    this.element.textContent = result.kind === "vehicle"
      ? `Neues Auto: ${result.vehicle.name}!`
      : `${result.vehicle.name} bereits vorhanden: +€${result.cash.toLocaleString("de-AT")}`;
    this.element.hidden = false;
    window.setTimeout(() => { this.element.hidden = true; }, 2600);
  }
}
