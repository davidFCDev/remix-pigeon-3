import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import GameSettings from "../config/GameSettings";

/**
 * MainScene - Escena principal del juego de la Paloma 3D
 * Maneja el renderizado 3D, la paloma, el terreno y los controles
 */
export class MainScene {
  // Three.js core
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Objetos del juego
  private pigeon: THREE.Group; // Contenedor para la paloma
  private ground: THREE.Object3D; // El terreno (ahora puede ser un Group del GLB)
  private sky: THREE.Mesh | null = null; // El cielo

  // Sistema de puntuación y aros
  private rings: THREE.Mesh[] = [];
  private score: number = 0;
  private scoreElement: HTMLElement | null = null;
  private ringGeometry!: THREE.TorusGeometry;
  private targetRingMaterial!: THREE.MeshToonMaterial;
  private nextRingMaterial!: THREE.MeshToonMaterial;
  private ringEffects: THREE.Mesh[] = []; // Efectos visuales de aros

  // Power-ups y Efectos
  // private powerUps: THREE.Mesh[] = []; // Eliminado
  // private powerUpGeometry!: THREE.SphereGeometry; // Eliminado
  // private powerUpMaterial!: THREE.MeshToonMaterial; // Eliminado
  private explosionGeometry!: THREE.TorusGeometry;
  private isSpeedBoostActive: boolean = false;
  private speedBoostTimer: number = 0;
  private baseSpeed: number = 25.0;
  private boostSpeed: number = 80.0; // Ultravelocidad
  private trailParticles: THREE.Mesh[] = [];

  // Indicadores
  private directionArrow: THREE.Mesh | null = null;

  // Animación
  private mixer: THREE.AnimationMixer | null = null;
  private clock: THREE.Clock = new THREE.Clock();

  // Estado del movimiento
  private keys: { [key: string]: boolean } = {};
  private mousePosition: THREE.Vector2 = new THREE.Vector2();
  private targetMousePosition: THREE.Vector2 = new THREE.Vector2(); // Para suavizado
  private isMouseDown: boolean = false;
  private pigeonSpeed: number = 25.0; // Unidades por segundo (antes 0.4 por frame)
  private pigeonRotationSpeed: number = 2.0; // Radianes por segundo (antes 0.04 por frame)
  private mouseSensitivity: number = 0.0008; // Sensibilidad del ratón reducida drásticamente

  // Físicas de vuelo
  private verticalVelocity: number = 0;
  private maxVerticalSpeed: number = 0.4;
  private verticalAcceleration: number = 0.015;
  private velocityDamping: number = 0.96; // Fricción del aire

  // Suavizado de rotación (Inercia)
  private currentYawSpeed: number = 0;
  private currentPitchSpeed: number = 0;
  private yawAcceleration: number = 3.0; // Aceleración de giro
  private pitchAcceleration: number = 2.0; // Aceleración de inclinación
  private rotationDamping: number = 2.0; // Frenado natural

  // Posición y rotación de la paloma
  private pigeonVelocity: THREE.Vector3 = new THREE.Vector3();
  private pigeonDirection: number = 0; // Ángulo de rotación en Y
  private ringPathDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 1); // Dirección general de los aros

  // Configuración de la cámara
  private cameraDistance: number = 8;
  private cameraHeight: number = 3;
  private cameraLerpFactor: number = 0.08;

  // Límites del mapa (Iniciales más conservadores)
  private mapBounds = {
    minX: -400,
    maxX: 400,
    minZ: -400,
    maxZ: 400,
  };
  private mapRadius: number = 400; // Radio seguro circular

  constructor() {
    // Crear escena
    this.scene = new THREE.Scene();

    // Estilo Cartoon: Cielo azul vibrante
    // const skyColor = 0x44AAFF
    // this.scene.background = new THREE.Color(skyColor)
    // this.scene.fog = new THREE.Fog(skyColor, 100, 900) // Niebla un poco más lejos

    // Crear cámara en perspectiva
    const aspectRatio = GameSettings.canvas.width / GameSettings.canvas.height;
    // Aumentamos el plano lejano (far) a 4000 para evitar clipping con el cielo
    this.camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 4000);

    // Crear renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      GameSettings.canvas.width,
      GameSettings.canvas.height
    );
    this.renderer.setPixelRatio(window.devicePixelRatio); // Importante para nitidez en pantallas HD/Retina
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Crear elementos del juego
    this.createSky(); // Cielo mejorado

    // Inicializar ground temporalmente para evitar errores antes de la carga
    this.ground = new THREE.Group();
    this.scene.add(this.ground);

    this.createGround(); // Carga el mapa GLB asíncronamente
    // this.createTrees(); // Se mueven al callback de createGround
    // this.createRocks(); // Se mueven al callback de createGround
    this.pigeon = this.createPigeon();

    // Inicializar sistema de aros
    this.initRings();

    // Crear flecha de dirección
    this.createDirectionArrow();

    // Configurar iluminación
    this.setupLighting();

    // Configurar posición inicial de la cámara
    this.updateCamera();

    // Configurar controles de teclado
    this.setupControls();

    // Obtener referencia al elemento de puntuación
    this.scoreElement = document.getElementById("score-container");

    // Iniciar loop de animación
    this.animate();
  }

  /**
   * Inicializa los materiales y los aros dispersos
   */
  private initRings(): void {
    // Geometría circular
    this.ringGeometry = new THREE.TorusGeometry(4, 0.5, 16, 32);

    // Optimización: Geometría de explosión reutilizable
    this.explosionGeometry = new THREE.TorusGeometry(3, 0.3, 16, 32);

    // Material para los aros (Amarillo brillante - Power Up style)
    this.targetRingMaterial = new THREE.MeshToonMaterial({
      color: 0xffff00,
      emissive: 0xaa6600,
      emissiveIntensity: 0.8,
    });

    // Generar 50 aros dispersos por el mapa
    for (let i = 0; i < 50; i++) {
      this.spawnRandomRing();
    }
  }

  /**
   * Genera una posición aleatoria dentro de los límites del mapa
   */
  private generateRandomPosition(): THREE.Vector3 {
    // Usamos un 80% del mapa para evitar bordes extremos
    const rangeX = (this.mapBounds.maxX - this.mapBounds.minX) * 0.4;
    const rangeZ = (this.mapBounds.maxZ - this.mapBounds.minZ) * 0.4;

    const x = (Math.random() - 0.5) * 2 * rangeX;
    const z = (Math.random() - 0.5) * 2 * rangeZ;
    const y = 10 + Math.random() * 60; // Altura variable

    return new THREE.Vector3(x, y, z);
  }

  /**
   * Crea un nuevo aro en una posición aleatoria
   */
  private spawnRandomRing(): void {
    const pos = this.generateRandomPosition();
    this.spawnRing(pos);
  }

  /**
   * Crea un nuevo aro en la posición dada
   */
  private spawnRing(position: THREE.Vector3): void {
    const ring = new THREE.Mesh(this.ringGeometry, this.targetRingMaterial);
    ring.position.copy(position);
    ring.castShadow = true;

    // Rotación aleatoria o animada
    ring.rotation.y = Math.random() * Math.PI * 2;

    // Animación flotante (userData)
    ring.userData = {
      initialY: position.y,
      floatSpeed: 1.0 + Math.random(),
      floatOffset: Math.random() * Math.PI * 2,
      rotationSpeed: 1.0 + Math.random(), // Velocidad de giro
    };

    this.scene.add(ring);
    this.rings.push(ring);
  }

  /**
   * Comprueba colisiones con CUALQUIER aro
   */
  private checkRingCollisions(): void {
    // Iterar hacia atrás para poder eliminar elementos
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      const distance = this.pigeon.position.distanceTo(ring.position);

      // Radio de colisión
      if (distance < 6) {
        this.collectRing(i);
      }
    }
  }

  /**
   * Gestiona la recolección de un aro
   */
  private collectRing(index: number): void {
    const collectedRing = this.rings[index];

    // Crear efecto visual
    this.createRingExplosion(collectedRing.position, collectedRing.rotation);

    // Eliminar de la escena y del array
    this.scene.remove(collectedRing);
    this.rings.splice(index, 1);

    // Incrementar puntuación
    this.score++;
    if (this.scoreElement) {
      this.scoreElement.innerText = this.score.toString();
    }

    // EFECTO POWER-UP: Turbo
    this.activateSpeedBoost();

    // Generar un nuevo aro en otro lugar para mantener la cantidad
    this.spawnRandomRing();
  }

  /**
   * Crea un efecto visual de explosión al recoger un aro
   */
  private createRingExplosion(
    position: THREE.Vector3,
    rotation: THREE.Euler
  ): void {
    // Crear un anillo que se expande y desvanece (misma forma que el original)
    // Usamos la geometría reutilizada para optimizar
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00, // Amarillo brillante al explotar
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    const effect = new THREE.Mesh(this.explosionGeometry, material);
    effect.position.copy(position);
    effect.rotation.copy(rotation);

    // Añadir datos personalizados para la animación
    effect.userData = {
      scaleSpeed: 2.0,
      fadeSpeed: 2.0, // Desvanecer un poco más rápido
      life: 1.0,
    };

    this.scene.add(effect);
    this.ringEffects.push(effect);
  }

  // Eliminado: spawnPowerUp
  // Eliminado: checkPowerUpCollisions

  /**
   * Activa el turbo
   */
  private activateSpeedBoost(): void {
    this.isSpeedBoostActive = true;
    this.speedBoostTimer = 5.0; // 5 segundos de turbo
    this.pigeonSpeed = this.boostSpeed;
  }

  /**
   * Crea un cielo con gradiente suave
   */
  private createSky(): void {
    // Color de fondo base (por si acaso)
    this.scene.background = new THREE.Color(0x87ceeb);

    // Niebla más suave y lejana para que no se vea "borroso" cerca
    // Ajustamos la niebla para que coincida mejor con la nueva distancia de visión
    this.scene.fog = new THREE.Fog(0x87ceeb, 500, 3000);

    // Crear un domo gigante para el cielo con gradiente
    // Usamos coordenadas locales (position) en lugar de mundiales para que el gradiente
    // se mantenga constante al mover la esfera con el jugador.
    const vertexShader = `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `;

    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vPosition;
      void main() {
        // Usamos vPosition + offset en Y para ajustar el horizonte
        float h = normalize( vPosition + vec3(0, offset, 0) ).y;
        gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );
      }
    `;

    const uniforms = {
      topColor: { value: new THREE.Color(0x0077ff) }, // Azul intenso arriba
      bottomColor: { value: new THREE.Color(0x87ceeb) }, // Azul cielo en el horizonte (coincide con niebla)
      offset: { value: 33 },
      exponent: { value: 0.6 },
    };

    // Aumentamos el radio del cielo para asegurar que siempre esté "lejos"
    const skyGeo = new THREE.SphereGeometry(3000, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.BackSide,
    });

    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
  }

  /**
   * Carga el mapa desde un archivo GLB
   */
  private createGround(): void {
    const loader = new GLTFLoader();
    loader.load(
      "/map.glb",
      (gltf) => {
        const mapModel = gltf.scene;

        // Ajustar posición y escala si es necesario
        // Mantenemos la posición Y = -15 que usábamos antes para que coincida con la altura de vuelo
        mapModel.position.y = -15;

        // Escalamos el mapa significativamente (Aumentado de 50 a 150)
        mapModel.scale.set(150, 150, 150);

        // Calcular los límites reales del mapa cargado
        // Es importante actualizar la matriz de mundo antes de calcular la caja
        mapModel.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(mapModel);

        // Ajustamos los límites para que estén casi en el borde visual
        // Reducimos el margen de seguridad a 20 unidades
        // CLAMP: Limitamos los bordes detectados a un máximo de +/- 500 para evitar zonas vacías
        const maxLimit = 500;
        this.mapBounds.minX = Math.max(box.min.x + 50, -maxLimit);
        this.mapBounds.maxX = Math.min(box.max.x - 50, maxLimit);
        this.mapBounds.minZ = Math.max(box.min.z + 50, -maxLimit);
        this.mapBounds.maxZ = Math.min(box.max.z - 50, maxLimit);

        // Calcular radio seguro (la menor distancia al centro desde los bordes)
        this.mapRadius = Math.min(
          Math.abs(this.mapBounds.minX),
          Math.abs(this.mapBounds.maxX),
          Math.abs(this.mapBounds.minZ),
          Math.abs(this.mapBounds.maxZ)
        );

        console.log(
          "Límites del mapa calculados:",
          this.mapBounds,
          "Radio:",
          this.mapRadius
        );

        // Configurar sombras y materiales
        mapModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.receiveShadow = true;
            child.castShadow = false; // El terreno recibe sombras

            // Respetar el material original del GLB
            if (child.material) {
              child.material.side = THREE.DoubleSide;
              // Asegurarnos de que el material reaccione a la luz si es posible
              if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material.roughness = 0.8; // Ajuste para que no brille demasiado
              }
            }
          }
        });

        // Reemplazar el objeto ground temporal
        this.scene.remove(this.ground);
        this.ground = mapModel;
        this.scene.add(this.ground);

        console.log("Mapa GLB cargado correctamente");

        // Una vez cargado el mapa, generamos la vegetación extra
        this.createTrees();
        this.createRocks();
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% cargado del mapa");
      },
      (error) => {
        console.error("Error cargando el mapa (map.glb):", error);
      }
    );
  }

  /**
   * Crea la paloma cargando el modelo animado
   */
  private createPigeon(): THREE.Group {
    const pigeonGroup = new THREE.Group();
    // IMPORTANTE: Orden YXZ para evitar Gimbal Lock.
    // Esto asegura que el Yaw (Y) se aplique primero, y luego el Pitch (X) sobre el eje rotado.
    pigeonGroup.rotation.order = "YXZ";
    pigeonGroup.position.set(0, 5, 0);

    // 1. Crear un placeholder (esfera) mientras carga el modelo
    const placeholderGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const placeholderMaterial = new THREE.MeshLambertMaterial({
      color: 0x808080,
      transparent: true,
      opacity: 0.5,
    });
    const placeholder = new THREE.Mesh(
      placeholderGeometry,
      placeholderMaterial
    );
    pigeonGroup.add(placeholder);

    // 2. Cargar el modelo GLB animado
    const loader = new GLTFLoader();
    loader.load(
      "/animated_bird_pigeon.glb",
      (gltf) => {
        console.log("Modelo animado cargado correctamente");
        const model = gltf.scene;

        // Configurar sombras
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Ajustar escala y rotación
        // Ajusta estos valores según cómo venga tu modelo
        model.scale.set(0.5, 0.5, 0.5);
        model.rotation.y = 0; // Corregido: mirar hacia adelante

        // Configurar animaciones
        if (gltf.animations && gltf.animations.length > 0) {
          console.log(`Encontradas ${gltf.animations.length} animaciones`);
          this.mixer = new THREE.AnimationMixer(model);

          // Reproducir la primera animación (normalmente "Fly" o "Idle")
          const action = this.mixer.clipAction(gltf.animations[0]);
          action.play();
        }

        // Reemplazar placeholder
        pigeonGroup.remove(placeholder);
        pigeonGroup.add(model);
      },
      undefined,
      (error) => {
        console.error("Error cargando el modelo animado:", error);
        placeholderMaterial.opacity = 1;
        placeholderMaterial.transparent = false;
      }
    );

    this.scene.add(pigeonGroup);
    return pigeonGroup;
  }

  /**
   * Crea una flecha indicadora de dirección (Mini icono)
   */
  private createDirectionArrow(): void {
    const arrowGroup = new THREE.Group();

    // Cono de la flecha (Más pequeño)
    const coneGeo = new THREE.ConeGeometry(0.2, 0.6, 8);
    coneGeo.rotateX(Math.PI / 2); // Apuntar en Z
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.z = 0.4;
    arrowGroup.add(cone);

    // Base de la flecha (Más fina y corta)
    const cylGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8);
    cylGeo.rotateX(Math.PI / 2);
    const cylMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const cylinder = new THREE.Mesh(cylGeo, cylMat);
    cylinder.position.z = -0.2;
    arrowGroup.add(cylinder);

    this.scene.add(arrowGroup);
    this.directionArrow = arrowGroup as unknown as THREE.Mesh;
  }

  /**
   * Carga y distribuye árboles por el mapa
   */
  private createTrees(): void {
    const loader = new GLTFLoader();

    // Cargar primer árbol (Low Poly)
    loader.load(
      "/arbol_low_poly.glb",
      (gltf1) => {
        const treeModel1 = gltf1.scene;
        this.setupModelShadows(treeModel1);

        // Cargar segundo árbol (Leafy)
        loader.load(
          "/leafy_tree.glb",
          (gltf2) => {
            const treeModel2 = gltf2.scene;
            this.setupModelShadows(treeModel2);

            // Distribuir mezclando ambos tipos
            // Reducido a 300 para móviles
            this.distributeObjects([treeModel1, treeModel2], 300, 900);
            console.log("Árboles generados (mezcla)");
          },
          undefined,
          (err) => {
            console.error("Error cargando leafy_tree:", err);
            // Si falla el segundo, distribuimos solo el primero
            this.distributeObjects([treeModel1], 500, 900);
          }
        );
      },
      undefined,
      (error) => {
        console.error("Error cargando arbol_low_poly:", error);
      }
    );
  }

  /**
   * Carga y distribuye rocas por el mapa
   */
  private createRocks(): void {
    const loader = new GLTFLoader();
    loader.load(
      "/low_poly_rocks.glb",
      (gltf) => {
        const rockModel = gltf.scene;
        this.setupModelShadows(rockModel);

        // Menos rocas que árboles (ej. 80)
        // Aumentada la escala de 2.0 a 5.0 para que sean más visibles
        // Reducido a 150 para móviles
        this.distributeObjects([rockModel], 150, 900, 2.0, 5.0);
        console.log("Rocas generadas");
      },
      undefined,
      (err) => console.error("Error cargando rocas:", err)
    );
  }

  /**
   * Configura sombras y materiales para un modelo
   */
  private setupModelShadows(model: THREE.Group): void {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.side = THREE.DoubleSide;
        }
      }
    });
  }

  /**
   * Distribuye objetos aleatoriamente sobre el terreno usando Raycasting
   */
  private distributeObjects(
    models: THREE.Group[],
    count: number,
    range: number,
    minScale: number = 0.8,
    maxScale: number = 1.6
  ): void {
    const raycaster = new THREE.Raycaster();
    const downDirection = new THREE.Vector3(0, -1, 0);

    for (let i = 0; i < count; i++) {
      // Elegir modelo aleatorio de la lista
      const modelTemplate = models[Math.floor(Math.random() * models.length)];
      const instance = modelTemplate.clone();

      // Posición aleatoria
      const x = (Math.random() - 0.5) * 2 * range;
      const z = (Math.random() - 0.5) * 2 * range;

      // Raycasting para encontrar altura del suelo
      raycaster.set(new THREE.Vector3(x, 200, z), downDirection);
      // IMPORTANTE: recursive: true para que funcione con Grupos (GLB)
      const intersects = raycaster.intersectObject(this.ground, true);

      if (intersects.length > 0) {
        const groundPoint = intersects[0].point;
        instance.position.copy(groundPoint);

        // Variación aleatoria
        const scale = minScale + Math.random() * (maxScale - minScale);
        instance.scale.set(scale, scale, scale);
        instance.rotation.y = Math.random() * Math.PI * 2;

        this.scene.add(instance);
      }
    }
  }

  /**
   * Configura la iluminación de la escena
   */
  private setupLighting(): void {
    // Luz hemisférica con colores cartoon contrastados
    const hemisphereLight = new THREE.HemisphereLight(0x44aaff, 0x66dd66, 0.7);
    this.scene.add(hemisphereLight);

    // Luz direccional (sol)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;

    // Mejorar calidad de sombras para el terreno grande
    // Optimizado para móviles: 1024x1024 es suficiente y más rápido
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    const d = 200;
    directionalLight.shadow.camera.left = -d;
    directionalLight.shadow.camera.right = d;
    directionalLight.shadow.camera.top = d;
    directionalLight.shadow.camera.bottom = -d;
    directionalLight.shadow.camera.far = 1000;

    this.scene.add(directionalLight);
  }

  /**
   * Configura los controles de teclado y ratón
   */
  private setupControls(): void {
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
    });

    window.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });

    // Control de ratón para Pitch (Arriba/Abajo)
    // Click para capturar el ratón
    window.addEventListener("click", () => {
      document.body.requestPointerLock();
    });

    window.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement === document.body) {
        // Sensibilidad ajustada para que sea suave
        const sensitivity = 0.002;

        // Eje Y: Pitch (Mirar arriba/abajo)
        // Invertimos: mover ratón abajo -> mirar abajo (positivo)
        this.targetMousePosition.y += e.movementY * sensitivity;
        // Limitamos el ángulo (aprox 60 grados)
        this.targetMousePosition.y = Math.max(
          -1.0,
          Math.min(1.0, this.targetMousePosition.y)
        );

        // Eje X: Yaw (Girar izquierda/derecha)
        // Acumulamos el movimiento horizontal como delta para este frame
        // Mover izquierda (negativo) -> girar izquierda (positivo)
        this.targetMousePosition.x -= e.movementX * sensitivity;
      }
    });
  }

  /**
   * Actualiza la posición de la cámara para seguir a la paloma dinámicamente
   */
  private updateCamera(): void {
    // Calcular offset relativo a la rotación de la paloma (Yaw Y Pitch)
    // Queremos que la cámara esté detrás (-Z) y arriba (+Y) RELATIVO a la paloma
    // Si la paloma mira arriba, "atrás" es abajo.

    // Vector de offset local (ajusta estos valores para cambiar la distancia)
    const relativeOffset = new THREE.Vector3(0, 4, -10);

    // Aplicar la rotación de la paloma a este offset
    const cameraOffset = relativeOffset.applyEuler(this.pigeon.rotation);

    // Posición objetivo de la cámara
    const targetCameraPos = this.pigeon.position.clone().add(cameraOffset);

    // Suavizado de la cámara (Lerp)
    // Un factor bajo (0.05-0.1) hace que la cámara tenga "peso" y tarde un poco en seguir
    this.camera.position.lerp(targetCameraPos, 0.1);

    // Hacemos que la cámara mire un poco por delante de la paloma
    // Esto ayuda a ver hacia dónde vamos
    const lookAtOffset = new THREE.Vector3(0, 0, 20); // 20 unidades adelante
    lookAtOffset.applyEuler(this.pigeon.rotation);
    const lookAtTarget = this.pigeon.position.clone().add(lookAtOffset);

    this.camera.lookAt(lookAtTarget);
  }

  /**
   * Procesa los controles de movimiento con físicas suavizadas
   */
  private handleMovement(delta: number): void {
    // 1. Rotación (Yaw) - RATÓN + TECLADO

    // Ratón: Giro directo (FPS style)
    const mouseTurn = this.targetMousePosition.x;
    this.pigeonDirection += mouseTurn;
    this.targetMousePosition.x = 0; // Resetear delta tras aplicarlo

    // Teclado: Giro con velocidad constante
    let keyboardTurn = 0;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) {
      keyboardTurn = this.pigeonRotationSpeed * delta;
    } else if (this.keys["KeyD"] || this.keys["ArrowRight"]) {
      keyboardTurn = -this.pigeonRotationSpeed * delta;
    }
    this.pigeonDirection += keyboardTurn;

    // Aplicar dirección final
    this.pigeon.rotation.y = this.pigeonDirection;

    // Efecto visual de Roll (Balanceo)
    // Calculamos la velocidad de giro total para inclinar la paloma
    // Evitamos división por cero si delta es muy pequeño
    const safeDelta = Math.max(delta, 0.001);
    const totalTurnSpeed = mouseTurn / safeDelta + keyboardTurn / safeDelta;

    // Suavizamos el roll objetivo (Banking)
    // Multiplicamos por 0.1 para que no sea exagerado
    const targetRoll = THREE.MathUtils.clamp(totalTurnSpeed * 0.1, -0.6, 0.6);
    this.pigeon.rotation.z = THREE.MathUtils.lerp(
      this.pigeon.rotation.z,
      targetRoll,
      delta * 5
    );

    // 2. Inclinación (Pitch) - RATÓN
    // Usamos la posición acumulada del ratón como objetivo de inclinación
    const targetPitch = this.targetMousePosition.y;

    // Suavizar la transición de inclinación
    // Un lerp rápido para que responda bien al ratón pero filtre temblores
    this.pigeon.rotation.x = THREE.MathUtils.lerp(
      this.pigeon.rotation.x,
      targetPitch,
      delta * 10
    );

    // 3. Movimiento (WASD)
    let isMoving = false;
    const moveSpeed = this.pigeonSpeed * delta;

    if (this.keys["KeyW"] || this.keys["ArrowUp"]) {
      // Vector hacia adelante (Z+)
      const forward = new THREE.Vector3(0, 0, 1);
      forward.applyEuler(this.pigeon.rotation);

      this.pigeon.position.add(forward.multiplyScalar(moveSpeed));
      isMoving = true;
    } else if (this.keys["KeyS"] || this.keys["ArrowDown"]) {
      // Ir hacia atrás / frenar
      const backward = new THREE.Vector3(0, 0, 1);
      backward.applyEuler(this.pigeon.rotation);
      this.pigeon.position.sub(backward.multiplyScalar(moveSpeed * 0.5));
      isMoving = true;
    }

    // Actualizar animaciones del modelo si existen
    if (this.mixer) {
      this.mixer.update(delta);
      const baseSpeed = isMoving ? 1.5 : 1.0;
      this.mixer.timeScale = baseSpeed;
    }

    // Animar efectos de aros
    for (let i = this.ringEffects.length - 1; i >= 0; i--) {
      const effect = this.ringEffects[i];
      effect.scale.multiplyScalar(1 + effect.userData.scaleSpeed * delta);

      if (effect.material instanceof THREE.Material) {
        effect.material.opacity -= effect.userData.fadeSpeed * delta;
      }

      if (
        effect.material instanceof THREE.Material &&
        effect.material.opacity <= 0
      ) {
        this.scene.remove(effect);
        effect.geometry.dispose();
        effect.material.dispose();
        this.ringEffects.splice(i, 1);
      }
    }

    // Animar Power-ups (Eliminado)
    // this.powerUps.forEach((pu) => { ... });

    // Rotar los aros dispersos
    this.rings.forEach((ring) => {
      if (ring.userData.rotationSpeed) {
        ring.rotation.y += ring.userData.rotationSpeed * delta;
      }
      // Flotar
      if (ring.userData.initialY) {
        ring.position.y =
          ring.userData.initialY +
          Math.sin(
            this.clock.getElapsedTime() * ring.userData.floatSpeed +
              ring.userData.floatOffset
          ) *
            1.5;
      }
    });

    // Comprobar colisiones con aros
    this.checkRingCollisions();

    // Comprobar colisiones con Power-ups (Eliminado)
    // this.checkPowerUpCollisions();    // Gestionar Turbo
    if (this.isSpeedBoostActive) {
      this.speedBoostTimer -= delta;
      if (this.speedBoostTimer <= 0) {
        this.isSpeedBoostActive = false;
        this.pigeonSpeed = this.baseSpeed;
      }

      // Generar estela de velocidad
      if (Math.random() < 0.5) {
        // No en cada frame
        const trailGeo = new THREE.BoxGeometry(0.2, 0.2, 8);
        const trailMat = new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.6,
        });
        const trail = new THREE.Mesh(trailGeo, trailMat);

        // Posición aleatoria alrededor de la paloma
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 6,
          -2
        );
        offset.applyEuler(this.pigeon.rotation);
        trail.position.copy(this.pigeon.position).add(offset);
        trail.rotation.copy(this.pigeon.rotation);

        this.scene.add(trail);
        this.trailParticles.push(trail);
      }
    }

    // Actualizar partículas de estela
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const p = this.trailParticles[i];
      // Mover hacia atrás relativo a su rotación para simular viento
      const backward = new THREE.Vector3(0, 0, 1)
        .applyEuler(p.rotation)
        .multiplyScalar(delta * 5);
      p.position.sub(backward);

      if (p.material instanceof THREE.Material) {
        p.material.opacity -= delta * 2.0;
        if (p.material.opacity <= 0) {
          this.scene.remove(p);
          p.geometry.dispose();
          p.material.dispose();
          this.trailParticles.splice(i, 1);
        }
      }
    }

    // Efecto FOV dinámico
    const targetFOV = this.isSpeedBoostActive ? 110 : 75;
    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      targetFOV,
      delta * 2
    );
    this.camera.updateProjectionMatrix();

    // Limitar altura mínima (suelo aproximado)
    if (this.pigeon.position.y < 2) {
      this.pigeon.position.y = 2;
    }

    // Limitar movimiento dentro de los bordes del mapa (Paredes invisibles)
    if (this.pigeon.position.x < this.mapBounds.minX)
      this.pigeon.position.x = this.mapBounds.minX;
    if (this.pigeon.position.x > this.mapBounds.maxX)
      this.pigeon.position.x = this.mapBounds.maxX;
    if (this.pigeon.position.z < this.mapBounds.minZ)
      this.pigeon.position.z = this.mapBounds.minZ;
    if (this.pigeon.position.z > this.mapBounds.maxZ)
      this.pigeon.position.z = this.mapBounds.maxZ;
  }

  /**
   * Loop principal de animación
   */
  private animate = (): void => {
    requestAnimationFrame(this.animate);

    // Calcular delta time (tiempo transcurrido desde el último frame en segundos)
    const delta = this.clock.getDelta();

    // Procesar movimiento pasando delta
    this.handleMovement(delta);

    // Actualizar cámara
    this.updateCamera();

    // Actualizar flecha de dirección
    if (this.directionArrow) {
      // Posicionar flecha sobre la paloma
      this.directionArrow.position.copy(this.pigeon.position);
      this.directionArrow.position.y += 3; // Flotar encima

      // Buscar el aro más cercano para apuntar
      let closestRing: THREE.Mesh | null = null;
      let minDistance = Infinity;

      for (const ring of this.rings) {
        const dist = this.pigeon.position.distanceTo(ring.position);
        if (dist < minDistance) {
          minDistance = dist;
          closestRing = ring;
        }
      }

      if (closestRing) {
        this.directionArrow.lookAt(closestRing.position);
        this.directionArrow.visible = true;
      } else {
        this.directionArrow.visible = false;
      }
    }

    // Mover el cielo con la paloma para dar sensación de infinito
    // Esto evita que nos salgamos de la esfera del cielo o veamos artefactos
    if (this.sky) {
      this.sky.position.copy(this.pigeon.position);
    }

    // Renderizar escena
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Obtiene el elemento DOM del renderer para añadirlo al documento
   */
  public getRendererElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * Limpia recursos cuando se destruye la escena
   */
  public destroy(): void {
    // Limpiar event listeners
    window.removeEventListener("keydown", () => {});
    window.removeEventListener("keyup", () => {});

    // Limpiar geometrías y materiales
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) {
          object.material.dispose();
        }
      }
    });

    // Limpiar renderer
    this.renderer.dispose();
  }
}
