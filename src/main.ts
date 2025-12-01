import GameSettings from "./config/GameSettings";
import { MainScene } from "./scenes/MainScene";

// SDK mock is automatically initialized by the framework (dev-init.ts)

// Estilo para el contenedor del canvas
const style = document.createElement("style");
style.textContent = `
  #game-container {
    width: ${GameSettings.canvas.width}px;
    height: ${GameSettings.canvas.height}px;
    margin: 0 auto;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  #game-container canvas {
    outline: none;
  }
`;
document.head.appendChild(style);

// Crear contenedor del juego
const gameContainer = document.createElement("div");
gameContainer.id = "game-container";
document.body.appendChild(gameContainer);

// Crear la escena principal
const mainScene = new MainScene();

// Añadir el canvas de Three.js al contenedor
gameContainer.appendChild(mainScene.getRendererElement());

// Almacenar globalmente para HMR cleanup
(window as any).mainScene = mainScene;

// Cleanup para Hot Module Replacement
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    mainScene.destroy();
    gameContainer.remove();
  });
}
