import "./styles.css";
import { GameApp } from "./app/GameApp";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Missing #app root element");
}

const game = new GameApp(root);
void game.start().catch((error: unknown) => {
  console.error(error);
  const message = document.createElement("div");
  message.className = "fatal-error";
  message.textContent = "Fried Race konnte nicht gestartet werden. Bitte lade die Seite neu.";
  root.replaceChildren(message);
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
