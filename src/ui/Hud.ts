export interface HudState { speedKph: number; money: number; timerText?: string; }

export class Hud {
  readonly element = document.createElement("div");
  readonly resetButton = document.createElement("button");
  private readonly speed = document.createElement("strong");
  private readonly money = document.createElement("strong");
  private readonly timer = document.createElement("span");

  constructor() {
    this.element.className = "hud";
    this.speed.dataset.testid = "speed";
    this.money.dataset.testid = "money";
    this.timer.dataset.testid = "timer";
    this.resetButton.dataset.testid = "reset-car";
    this.resetButton.textContent = "Auto zurücksetzen (R)";
    this.element.append(this.speed, this.money, this.timer, this.resetButton);
    this.render({ speedKph: 0, money: 30_000 });
  }

  render(state: HudState): void {
    this.speed.textContent = `${Math.round(Math.abs(state.speedKph))} km/h`;
    this.money.textContent = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(state.money);
    this.timer.textContent = state.timerText ?? "Freie Fahrt";
  }
}
