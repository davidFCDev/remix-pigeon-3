# Pidgeon Game 3D 🐦

Un juego de simulación de vuelo 3D donde controlas una paloma que vuela en campo abierto.

## 🎮 Controles

| Tecla         | Acción                 |
| ------------- | ---------------------- |
| **W** / **↑** | Avanzar                |
| **S** / **↓** | Retroceder             |
| **A** / **←** | Girar izquierda        |
| **D** / **→** | Girar derecha          |
| **Espacio**   | Subir (volar más alto) |
| **Shift**     | Bajar (descender)      |

## 🚀 Cómo ejecutar

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Construir para producción
npm run build
```

## 📋 Características

- ✅ Motor 3D con Three.js
- ✅ Paloma representada como esfera (desarrollo)
- ✅ Cámara en tercera persona que sigue al jugador
- ✅ Terreno verde extenso
- ✅ Cielo azul
- ✅ Movimiento en 3 dimensiones
- ✅ Iluminación con sombras

## 🛠️ Tecnologías

- **Three.js** - Motor de renderizado 3D
- **TypeScript** - Lenguaje de programación
- **Vite** - Bundler y servidor de desarrollo

## 📁 Estructura del Proyecto

```
src/
├── main.ts              # Punto de entrada
├── config/
│   └── GameSettings.ts  # Configuración del canvas
├── scenes/
│   ├── MainScene.ts     # Escena principal 3D
│   └── GameScene.ts     # Re-export de MainScene
└── globals.d.ts         # Declaraciones de tipos
```

## 🔮 Próximos pasos

- [ ] Modelo 3D real de paloma
- [ ] Animaciones de vuelo
- [ ] Físicas más realistas
- [ ] Elementos del escenario (árboles, edificios)
- [ ] Sistema de puntuación
- [ ] Sonidos
