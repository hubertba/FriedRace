import type { PlayerProfile, VehicleDefinition } from "../domain/types";

export class GarageMenu {
  readonly element = document.createElement("section");
  readonly openButton = document.createElement("button");
  private buyHandler?: (vehicleId: string) => void;
  private selectHandler?: (vehicleId: string) => void;
  private profile?: PlayerProfile;
  private vehicles: VehicleDefinition[] = [];

  constructor() {
    this.element.className = "garage-menu";
    this.element.hidden = true;
    this.openButton.className = "garage-button";
    this.openButton.textContent = "Garage (G)";
    this.openButton.dataset.testid = "open-garage";
    this.openButton.addEventListener("click", () => this.toggle());
  }

  onBuy(handler: (vehicleId: string) => void): void { this.buyHandler = handler; }
  onSelect(handler: (vehicleId: string) => void): void { this.selectHandler = handler; }
  setAvailable(available: boolean): void {
    this.openButton.disabled = !available;
    if (!available) this.element.hidden = true;
  }
  get isOpen(): boolean { return !this.element.hidden; }
  toggle(): void { this.element.hidden ? this.show() : (this.element.hidden = true); }
  show(): void { this.element.hidden = false; if (this.profile) this.render(this.profile, this.vehicles); }

  render(profile: PlayerProfile, vehicles: VehicleDefinition[]): void {
    this.profile = profile;
    this.vehicles = vehicles;
    const title = document.createElement("h2");
    title.textContent = `Garage – €${profile.money.toLocaleString("de-AT")}`;
    const list = document.createElement("div");
    list.className = "vehicle-list";
    for (const vehicle of vehicles) {
      const owned = profile.ownedVehicleIds.includes(vehicle.id);
      const card = document.createElement("article");
      card.innerHTML = `<h3>${vehicle.name}</h3><p>${vehicle.class} · ${vehicle.topSpeedKph} km/h</p><p>€${vehicle.price.toLocaleString("de-AT")}</p>`;
      const action = document.createElement("button");
      action.textContent = owned ? (profile.activeVehicleId === vehicle.id ? "Ausgewählt" : "Auswählen") : "Kaufen";
      action.disabled = profile.activeVehicleId === vehicle.id;
      action.addEventListener("click", () => owned ? this.selectHandler?.(vehicle.id) : this.buyHandler?.(vehicle.id));
      card.append(action);
      list.append(card);
    }
    const close = document.createElement("button");
    close.textContent = "Schließen";
    close.addEventListener("click", () => { this.element.hidden = true; });
    this.element.replaceChildren(title, list, close);
  }
}
