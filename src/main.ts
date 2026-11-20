import "./styles.css";
import { GameApp } from "./app/GameApp";

const root = document.querySelector<HTMLElement>("#app");

if (!root) {
  throw new Error("Missing #app root element");
}

const game = new GameApp(root);
void game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
