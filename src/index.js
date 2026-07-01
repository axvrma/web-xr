import * as THREE from 'three';
import './style.css';

let camera, scene, renderer;
let reticle;
let reticleVisible = false;
let hitTestSource = null;
let hitTestSourceRequested = false;
let xrSession = null;
let deferredInstallPrompt = null;
let arEngine = 'webxr';
let eightWallLoadPromise = null;
let eightWallStarted = false;
let fallbackGroundPlane = null;
let fallbackRaycaster = null;
let fallbackPlacementPoint = null;

const placedObjects = [];
const EIGHT_WALL_OBJECT_SCALE = 2.15;
const EIGHT_WALL_SCRIPTS = [
    {
        src: 'https://cdn.jsdelivr.net/npm/@8thwall/xrextras@1/dist/xrextras.js',
        id: 'xrextras-script'
    },
    {
        src: 'https://cdn.jsdelivr.net/npm/@8thwall/landing-page@1/dist/landing-page.js',
        id: 'landing-page-script'
    },
    {
        src: 'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js',
        id: 'xr8-engine-script',
        attrs: { 'data-preload-chunks': 'slam' }
    }
];

const COLORS = {
    red: 0xd93a31,
    blue: 0x2474ff,
    green: 0x2fbf71,
    yellow: 0xffc857,
    orange: 0xff8a3d,
    purple: 0x8b5cf6,
    white: 0xf8fafc,
    black: 0x1f2937,
    pink: 0xf472b6,
    cyan: 0x22d3ee,
    teal: 0x14b8a6,
    gold: 0xf59e0b,
    silver: 0xbfc7d5,
    gray: 0x8b95a7,
    grey: 0x8b95a7
};

const COLOR_ALIASES = {
    grey: 'gray',
    aqua: 'cyan',
    violet: 'purple',
    golden: 'gold'
};

const OBJECT_LIBRARY = {
    cube: { label: 'Cube', aliases: ['cube', 'box', 'block'] },
    sphere: { label: 'Sphere', aliases: ['sphere', 'ball', 'orb'] },
    cylinder: { label: 'Cylinder', aliases: ['cylinder', 'tube', 'pillar'] },
    cone: { label: 'Cone', aliases: ['cone', 'pyramid'] },
    elephant: { label: 'Elephant', aliases: ['elephant', 'mammoth'] },
    bird: { label: 'Bird', aliases: ['bird', 'sparrow', 'parrot'] },
    flock: { label: 'Bird Flock', aliases: ['birds', 'flock', 'flock of birds'] },
    tree: { label: 'Tree', aliases: ['tree', 'plant', 'palm'] },
    rocket: { label: 'Rocket', aliases: ['rocket', 'spaceship', 'ship'] },
    crystal: { label: 'Crystal', aliases: ['crystal', 'gem', 'diamond'] }
};

const startARBtn = document.getElementById('start-ar-btn');
const micBtn = document.getElementById('mic-btn');
const clearBtn = document.getElementById('clear-btn');
const infoBtn = document.getElementById('info-btn');
const installAppBtn = document.getElementById('install-app-btn');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const instructionsEl = document.getElementById('instructions');
const objectCountEl = document.getElementById('object-count');
const notSupportedEl = document.getElementById('not-supported');
const notSupportedReasonEl = document.getElementById('not-supported-reason');
let instructionsTimer = null;

init();

async function init() {
    registerServiceWorker();
    setupInstallButton();
    setupStartButton();
    setupMicButton();
    setupClearButton();
    setupInfoButton();
    updateObjectCount();

    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';

    if (!isSecure) {
        showNotSupported('This app must be loaded over HTTPS. Current protocol: ' + location.protocol);
        return;
    }

    if (shouldUseUnifiedEightWall()) {
        enableEightWallMode('Unified AR mode ready.');
        return;
    }

    if (!navigator.xr) {
        enableEightWallMode('WebXR is not available in this browser.');
        return;
    }

    try {
        const isARSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (!isARSupported) {
            enableEightWallMode('Immersive WebXR AR is not supported on this device.');
            return;
        }
    } catch (error) {
        enableEightWallMode('WebXR support check failed: ' + error.message);
        return;
    }

    arEngine = 'webxr';
    setupScene();
    statusEl.textContent = 'Ready to place AR objects';
    startARBtn.disabled = false;
}

function shouldUseUnifiedEightWall() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function enableEightWallMode(reason) {
    arEngine = '8thwall';
    statusEl.textContent = `${reason} Tap Start AR to begin.`;
    startARBtn.disabled = false;
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((error) => {
            console.warn('Service worker registration failed:', error);
        });
    });
}

function setupInstallButton() {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        installAppBtn.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        installAppBtn.classList.add('hidden');
    });

    installAppBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;

        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        installAppBtn.classList.add('hidden');
    });
}

function showNotSupported(reason) {
    startARBtn.classList.add('hidden');
    micBtn.classList.add('hidden');
    clearBtn.classList.add('hidden');
    infoBtn.classList.add('hidden');
    instructionsEl.classList.add('hidden');
    notSupportedEl.classList.remove('hidden');
    statusEl.textContent = 'AR is unavailable on this device';

    if (notSupportedReasonEl && reason) {
        notSupportedReasonEl.innerHTML = `<p class="error-reason">${reason}</p>`;
    }

    console.error('AR not supported:', reason);
}

function setupScene() {
    const container = document.getElementById('container');

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 30);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    configureRenderer();
    container.appendChild(renderer.domElement);

    addSceneLighting();
    createReticle();
    window.addEventListener('resize', onWindowResize);
}

function configureRenderer() {
    if (!renderer) return;

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

function addSceneLighting() {
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x8fb3ff, 1.6);
    ambientLight.position.set(0.5, 1, 0.25);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(2, 4, 3);
    keyLight.castShadow = true;
    scene.add(keyLight);
}

function createReticle() {
    reticle = new THREE.Group();
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;

    const ringGeometry = new THREE.RingGeometry(0.055, 0.072, 48);
    ringGeometry.rotateX(-Math.PI / 2);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0.92
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    reticle.add(ring);

    const dotGeometry = new THREE.CircleGeometry(0.012, 32);
    dotGeometry.rotateX(-Math.PI / 2);
    const dot = new THREE.Mesh(dotGeometry, new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.86
    }));
    reticle.add(dot);

    scene.add(reticle);
}

function createFallbackReticle() {
    createReticle();
    reticle.matrixAutoUpdate = true;
    reticle.position.set(0, 0, -1.2);
    reticle.quaternion.identity();
    reticle.scale.setScalar(1.35);
    reticle.visible = true;
    reticleVisible = true;
}

function setupFallbackPlacement() {
    fallbackGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    fallbackRaycaster = new THREE.Raycaster();
    fallbackPlacementPoint = new THREE.Vector3(0, 0, -1.2);

    const shadowGeometry = new THREE.PlaneGeometry(2000, 2000);
    shadowGeometry.rotateX(-Math.PI / 2);
    const shadowMaterial = new THREE.ShadowMaterial({
        opacity: 0.34,
        transparent: true
    });
    const shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);
}

function updateFallbackReticle() {
    if (arEngine !== '8thwall' || !camera || !reticle || !fallbackRaycaster) return;

    fallbackRaycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const didIntersect = fallbackRaycaster.ray.intersectPlane(fallbackGroundPlane, fallbackPlacementPoint);

    if (!didIntersect) {
        const fallbackDirection = new THREE.Vector3();
        camera.getWorldDirection(fallbackDirection);
        fallbackPlacementPoint.copy(camera.position).add(fallbackDirection.multiplyScalar(1.4));
        fallbackPlacementPoint.y = 0;
    }

    reticle.position.copy(fallbackPlacementPoint);
    reticle.rotation.set(0, 0, 0);
    reticle.visible = true;
    reticleVisible = true;
}

function setupStartButton() {
    startARBtn.disabled = true;
    startARBtn.addEventListener('click', startAR);
}

async function startAR() {
    if (arEngine === '8thwall') {
        startEightWallAR();
        return;
    }

    try {
        xrSession = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['local-floor', 'dom-overlay'],
            domOverlay: { root: document.getElementById('overlay') }
        });

        xrSession.addEventListener('end', onSessionEnd);

        await renderer.xr.setReferenceSpaceType('local');
        await renderer.xr.setSession(xrSession);

        showActiveARControls();
        statusEl.textContent = 'Scan a surface, then speak an object';

        renderer.setAnimationLoop(render);
    } catch (error) {
        console.error('Failed to start AR session:', error);
        statusEl.textContent = 'Failed to start AR: ' + error.message;
    }
}

async function startEightWallAR() {
    if (eightWallStarted) return;

    startARBtn.disabled = true;
    statusEl.textContent = 'Loading 8th Wall AR engine...';

    try {
        await loadEightWallLibraries();
        window.THREE = THREE;

        const container = document.getElementById('container');
        container.innerHTML = '';

        const canvas = document.createElement('canvas');
        canvas.id = 'camerafeed';
        container.appendChild(canvas);

        const modules = [
            window.XR8.GlTextureRenderer.pipelineModule(),
            window.XR8.Threejs.pipelineModule(),
            window.XR8.XrController.pipelineModule(),
            window.LandingPage.pipelineModule(),
            window.XRExtras.FullWindowCanvas.pipelineModule(),
            window.XRExtras.Loading.pipelineModule(),
            window.XRExtras.RuntimeError.pipelineModule(),
            createEightWallScenePipelineModule(),
        ];

        window.XR8.addCameraPipelineModules(modules);

        const runConfig = { canvas };
        if (window.XR8.XrConfig?.device) {
            runConfig.allowedDevices = window.XR8.XrConfig.device().ANY;
        }
        window.XR8.run(runConfig);
    } catch (error) {
        console.error('8th Wall AR failed:', error);
        showNotSupported('8th Wall fallback could not start: ' + error.message);
    }
}

function loadEightWallLibraries() {
    if (window.XR8 && window.XRExtras && window.LandingPage) {
        return Promise.resolve();
    }

    if (eightWallLoadPromise) return eightWallLoadPromise;

    window.THREE = THREE;

    const xrReady = new Promise((resolve, reject) => {
        if (window.XR8) {
            resolve();
            return;
        }

        const timeout = window.setTimeout(() => {
            reject(new Error('Timed out while loading XR8'));
        }, 20000);

        window.addEventListener('xrloaded', () => {
            window.clearTimeout(timeout);
            resolve();
        }, { once: true });
    });

    eightWallLoadPromise = EIGHT_WALL_SCRIPTS
        .reduce((promise, script) => promise.then(() => loadScript(script)), Promise.resolve())
        .then(() => xrReady)
        .then(() => {
            if (!window.XR8 || !window.XRExtras || !window.LandingPage) {
                throw new Error('8th Wall libraries did not initialize');
            }
        });

    return eightWallLoadPromise;
}

function loadScript({ src, id, attrs = {} }) {
    const existing = document.getElementById(id);
    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.id = id;
        script.crossOrigin = 'anonymous';

        Object.entries(attrs).forEach(([name, value]) => {
            script.setAttribute(name, value);
        });

        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        document.head.appendChild(script);
    });
}

function createEightWallScenePipelineModule() {
    return {
        name: 'voxr-8thwall-scene',
        onStart: ({ canvas }) => {
            const xrScene = window.XR8.Threejs.xrScene();
            scene = xrScene.scene;
            camera = xrScene.camera;
            renderer = xrScene.renderer;

            configureRenderer();
            addSceneLighting();
            createFallbackReticle();
            setupFallbackPlacement();

            canvas.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
            window.XR8.XrController.updateCameraProjectionMatrix({
                origin: camera.position,
                facing: camera.quaternion
            });

            eightWallStarted = true;
            showActiveARControls();
            statusEl.textContent = 'AR ready. Aim at the floor, then speak an object.';
        },
        onUpdate: () => {
            updateFallbackReticle();
            animatePlacedObjects(performance.now());
        },
        onException: (error) => {
            console.error('8th Wall runtime error:', error);
            statusEl.textContent = '8th Wall runtime error: ' + error.message;
        }
    };
}

function showActiveARControls() {
    startARBtn.classList.add('hidden');
    startARBtn.disabled = false;
    micBtn.classList.remove('hidden');
    clearBtn.classList.remove('hidden');
    infoBtn.classList.remove('hidden');
    hideInstructions();
}

function onSessionEnd() {
    xrSession = null;
    hitTestSource = null;
    hitTestSourceRequested = false;
    reticleVisible = false;

    startARBtn.classList.remove('hidden');
    micBtn.classList.add('hidden');
    clearBtn.classList.add('hidden');
    infoBtn.classList.add('hidden');
    hideInstructions();
    statusEl.textContent = 'AR session ended. Tap Start AR to resume.';

    renderer.setAnimationLoop(null);
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();

        if (!hitTestSourceRequested) {
            requestHitTestSource(frame.session);
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);

            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(referenceSpace);

                if (pose) {
                    reticle.visible = true;
                    reticle.matrix.fromArray(pose.transform.matrix);
                    reticleVisible = true;
                }
            } else {
                reticle.visible = false;
                reticleVisible = false;
            }
        }
    }

    animatePlacedObjects(timestamp || performance.now());
    renderer.render(scene, camera);
}

async function requestHitTestSource(session) {
    hitTestSourceRequested = true;

    try {
        const viewerSpace = await session.requestReferenceSpace('viewer');
        hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

        session.addEventListener('end', () => {
            hitTestSource = null;
            hitTestSourceRequested = false;
        });
    } catch (error) {
        console.error('Hit test source request failed:', error);
    }
}

function setupMicButton() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        micBtn.addEventListener('click', () => {
            statusEl.textContent = 'Speech recognition is not supported in this browser';
        });
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.continuous = false;

    let isListening = false;

    micBtn.addEventListener('click', () => {
        if (!reticleVisible) {
            statusEl.textContent = 'Point at a detected surface first';
            return;
        }

        if (isListening) {
            recognition.stop();
            return;
        }

        try {
            recognition.start();
            isListening = true;
            micBtn.classList.add('listening');
            statusEl.textContent = 'Listening for a color and object';
            transcriptEl.textContent = '';
        } catch (error) {
            console.error('Speech recognition error:', error);
            statusEl.textContent = 'Could not start listening';
        }
    });

    recognition.onresult = (event) => {
        const results = event.results[0];
        const commands = Array.from(results).map((result) => result.transcript.toLowerCase().trim());
        transcriptEl.textContent = `"${commands[0]}"`;

        for (const command of commands) {
            if (command.includes('clear') || command.includes('remove all')) {
                clearPlacedObjects();
                statusEl.textContent = 'Cleared the scene';
                return;
            }

            const parsed = parseCommand(command);
            if (parsed) {
                placeObject(parsed.color, parsed.objectType);
                statusEl.textContent = `Placed ${parsed.colorName} ${OBJECT_LIBRARY[parsed.objectType].label.toLowerCase()}`;
                return;
            }
        }

        statusEl.textContent = 'Try "gray elephant", "blue bird", or "gold rocket"';
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        micBtn.classList.remove('listening');

        if (event.error === 'no-speech') {
            statusEl.textContent = 'No speech detected. Try again.';
        } else if (event.error === 'not-allowed') {
            statusEl.textContent = 'Microphone permission denied';
        } else {
            statusEl.textContent = 'Speech error: ' + event.error;
        }
    };

    recognition.onend = () => {
        isListening = false;
        micBtn.classList.remove('listening');
    };
}

function setupClearButton() {
    clearBtn.addEventListener('click', () => {
        clearPlacedObjects();
        statusEl.textContent = 'Scene cleared';
    });
}

function setupInfoButton() {
    infoBtn.addEventListener('click', () => {
        showInstructionsFor15Seconds();
    });
}

function showInstructionsFor15Seconds() {
    window.clearTimeout(instructionsTimer);
    instructionsEl.classList.remove('hidden');
    infoBtn.classList.add('active');
    infoBtn.setAttribute('aria-expanded', 'true');

    instructionsTimer = window.setTimeout(() => {
        hideInstructions();
    }, 15000);
}

function hideInstructions() {
    window.clearTimeout(instructionsTimer);
    instructionsTimer = null;
    instructionsEl.classList.add('hidden');
    infoBtn.classList.remove('active');
    infoBtn.setAttribute('aria-expanded', 'false');
}

function parseCommand(command) {
    let foundColorName = 'teal';
    let foundColor = COLORS.teal;

    for (const [colorName, colorValue] of Object.entries(COLORS)) {
        if (command.includes(colorName)) {
            foundColorName = COLOR_ALIASES[colorName] || colorName;
            foundColor = colorValue;
            break;
        }
    }

    const objectEntries = Object.entries(OBJECT_LIBRARY)
        .flatMap(([key, config]) => config.aliases.map((alias) => ({ key, alias })))
        .sort((a, b) => b.alias.length - a.alias.length);

    const found = objectEntries.find(({ alias }) => command.includes(alias));
    if (!found) return null;

    return {
        color: foundColor,
        colorName: foundColorName,
        objectType: found.key
    };
}

function placeObject(color, objectType) {
    if (!reticle.visible) return;

    const object = createObject(color, objectType);

    if (arEngine === '8thwall') {
        object.position.copy(reticle.position);
        object.quaternion.copy(reticle.quaternion);
        object.scale.multiplyScalar(EIGHT_WALL_OBJECT_SCALE);
    } else {
        reticle.matrix.decompose(object.position, object.quaternion, object.scale);
    }

    object.position.y += (object.userData.groundOffset || 0.08) * object.scale.y;
    object.rotation.y += Math.random() * Math.PI * 2;
    initializeAnimationState(object);

    scene.add(object);
    placedObjects.push(object);
    updateObjectCount();
    flashReticle();
}

function createObject(color, objectType) {
    switch (objectType) {
        case 'sphere':
            return createPrimitiveObject(new THREE.SphereGeometry(0.085, 36, 24), color, 0.085);
        case 'cylinder':
            return createPrimitiveObject(new THREE.CylinderGeometry(0.055, 0.055, 0.16, 36), color, 0.08);
        case 'cone':
            return createPrimitiveObject(new THREE.ConeGeometry(0.075, 0.17, 36), color, 0.085);
        case 'elephant':
            return createElephant(color);
        case 'bird':
            return createBird(color);
        case 'flock':
            return createBirdFlock(color);
        case 'tree':
            return createTree(color);
        case 'rocket':
            return createRocket(color);
        case 'crystal':
            return createCrystal(color);
        case 'cube':
        default:
            return createPrimitiveObject(new THREE.BoxGeometry(0.13, 0.13, 0.13), color, 0.065);
    }
}

function createMaterial(color, options = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: options.roughness ?? 0.48,
        metalness: options.metalness ?? 0.08,
        emissive: options.emissive ?? 0x000000,
        emissiveIntensity: options.emissiveIntensity ?? 0
    });
}

function createPrimitiveObject(geometry, color, groundOffset) {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, createMaterial(color, { metalness: 0.18 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
    );
    group.add(edges);

    group.userData.groundOffset = groundOffset;
    return group;
}

function createElephant(color) {
    const group = new THREE.Group();
    const bodyMaterial = createMaterial(color || COLORS.gray, { roughness: 0.82 });
    const accentMaterial = createMaterial(0xf3efe7, { roughness: 0.7 });
    const darkMaterial = createMaterial(0x111827, { roughness: 0.5 });

    const body = mesh(new THREE.SphereGeometry(0.16, 32, 24), bodyMaterial, [0, 0.14, 0], [1.35, 0.72, 0.82]);
    const head = mesh(new THREE.SphereGeometry(0.105, 32, 20), bodyMaterial, [0, 0.18, 0.145], [1.05, 0.9, 1]);
    const leftEar = mesh(new THREE.SphereGeometry(0.075, 24, 16), bodyMaterial, [-0.09, 0.19, 0.12], [0.22, 1.05, 0.82]);
    const rightEar = mesh(new THREE.SphereGeometry(0.075, 24, 16), bodyMaterial, [0.09, 0.19, 0.12], [0.22, 1.05, 0.82]);
    leftEar.rotation.z = -0.18;
    rightEar.rotation.z = 0.18;

    const trunk = new THREE.Group();
    trunk.add(mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.12, 16), bodyMaterial, [0, 0.115, 0.235], [1, 1, 1], [Math.PI / 2.9, 0, 0]));
    trunk.add(mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.09, 16), bodyMaterial, [0, 0.075, 0.275], [1, 1, 1], [Math.PI / 2.2, 0, 0]));

    const tuskLeft = mesh(new THREE.ConeGeometry(0.012, 0.09, 16), accentMaterial, [-0.035, 0.13, 0.24], [1, 1, 1], [Math.PI / 2.25, 0, 0.18]);
    const tuskRight = mesh(new THREE.ConeGeometry(0.012, 0.09, 16), accentMaterial, [0.035, 0.13, 0.24], [1, 1, 1], [Math.PI / 2.25, 0, -0.18]);

    for (const x of [-0.095, 0.095]) {
        for (const z of [-0.065, 0.065]) {
            group.add(mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.135, 18), bodyMaterial, [x, 0.05, z], [1, 1, 1]));
        }
    }

    group.add(body, head, leftEar, rightEar, trunk, tuskLeft, tuskRight);
    group.add(mesh(new THREE.SphereGeometry(0.008, 12, 8), darkMaterial, [-0.035, 0.205, 0.235]));
    group.add(mesh(new THREE.SphereGeometry(0.008, 12, 8), darkMaterial, [0.035, 0.205, 0.235]));

    const tail = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 8), bodyMaterial, [0, 0.15, -0.17], [1, 1, 1], [0.95, 0, 0]);
    group.add(tail);

    group.userData.groundOffset = 0;
    return group;
}

function createBird(color) {
    const group = new THREE.Group();
    const bodyMaterial = createMaterial(color, { roughness: 0.54, metalness: 0.04 });
    const wingMaterial = createMaterial(darkenColor(color, 0.72), { roughness: 0.56 });
    const beakMaterial = createMaterial(COLORS.gold, { roughness: 0.42 });
    const darkMaterial = createMaterial(0x111827);

    const body = mesh(new THREE.SphereGeometry(0.075, 24, 18), bodyMaterial, [0, 0.12, 0], [0.82, 1, 1.12]);
    const head = mesh(new THREE.SphereGeometry(0.042, 18, 14), bodyMaterial, [0, 0.17, 0.07]);
    const beak = mesh(new THREE.ConeGeometry(0.014, 0.05, 16), beakMaterial, [0, 0.17, 0.12], [1, 1, 1], [Math.PI / 2, 0, 0]);
    const leftWing = mesh(new THREE.ConeGeometry(0.035, 0.12, 4), wingMaterial, [-0.055, 0.115, 0], [1.25, 0.16, 1], [0, 0, Math.PI / 2.8]);
    const rightWing = mesh(new THREE.ConeGeometry(0.035, 0.12, 4), wingMaterial, [0.055, 0.115, 0], [1.25, 0.16, 1], [0, 0, -Math.PI / 2.8]);
    const tail = mesh(new THREE.ConeGeometry(0.028, 0.08, 4), wingMaterial, [0, 0.105, -0.08], [1.4, 0.18, 1], [-Math.PI / 2, 0, Math.PI / 4]);

    group.add(body, head, beak, leftWing, rightWing, tail);
    group.add(mesh(new THREE.SphereGeometry(0.004, 8, 6), darkMaterial, [-0.014, 0.182, 0.104]));
    group.add(mesh(new THREE.SphereGeometry(0.004, 8, 6), darkMaterial, [0.014, 0.182, 0.104]));

    group.userData.groundOffset = 0.04;
    group.userData.animate = (time) => {
        const flap = Math.sin(time * 0.009) * 0.55;
        const baseY = group.userData.baseY ?? group.position.y;
        leftWing.rotation.z = Math.PI / 2.8 + flap;
        rightWing.rotation.z = -Math.PI / 2.8 - flap;
        group.position.y = baseY + Math.sin(time * 0.002 + group.id) * 0.012;
    };

    return group;
}

function createBirdFlock(color) {
    const group = new THREE.Group();
    const positions = [
        [0, 0.02, 0],
        [-0.17, 0.07, -0.06],
        [0.17, 0.09, -0.08],
        [-0.08, 0.14, 0.12],
        [0.09, 0.16, 0.08]
    ];

    positions.forEach((position, index) => {
        const bird = createBird(index % 2 ? darkenColor(color, 0.82) : color);
        bird.position.set(position[0], position[1], position[2]);
        bird.scale.setScalar(index === 0 ? 0.9 : 0.68);
        bird.rotation.y = (index - 2) * 0.42;
        group.add(bird);
    });

    group.userData.groundOffset = 0.08;
    group.userData.animate = (time) => {
        group.children.forEach((bird, index) => {
            if (bird.userData.animate) bird.userData.animate(time + index * 120);
        });
    };
    return group;
}

function createTree(color) {
    const group = new THREE.Group();
    const trunkMaterial = createMaterial(0x8b5a2b, { roughness: 0.86 });
    const leafMaterial = createMaterial(color || COLORS.green, { roughness: 0.78 });

    group.add(mesh(new THREE.CylinderGeometry(0.035, 0.047, 0.22, 12), trunkMaterial, [0, 0.11, 0]));
    group.add(mesh(new THREE.ConeGeometry(0.16, 0.22, 24), leafMaterial, [0, 0.27, 0]));
    group.add(mesh(new THREE.ConeGeometry(0.13, 0.18, 24), leafMaterial, [0, 0.39, 0]));
    group.add(mesh(new THREE.ConeGeometry(0.1, 0.15, 24), leafMaterial, [0, 0.5, 0]));

    group.userData.groundOffset = 0;
    return group;
}

function createRocket(color) {
    const group = new THREE.Group();
    const bodyMaterial = createMaterial(color, { roughness: 0.28, metalness: 0.38 });
    const whiteMaterial = createMaterial(0xf8fafc, { roughness: 0.32, metalness: 0.18 });
    const flameMaterial = createMaterial(0xff7a1a, {
        roughness: 0.4,
        emissive: 0xff5a00,
        emissiveIntensity: 0.5
    });

    group.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 28), whiteMaterial, [0, 0.16, 0]));
    group.add(mesh(new THREE.ConeGeometry(0.057, 0.115, 28), bodyMaterial, [0, 0.327, 0]));
    group.add(mesh(new THREE.ConeGeometry(0.028, 0.09, 16), flameMaterial, [0, 0.005, 0], [1, 1, 1], [Math.PI, 0, 0]));
    group.add(mesh(new THREE.SphereGeometry(0.025, 18, 12), createMaterial(0x7dd3fc, { metalness: 0.15 }), [0, 0.19, 0.052], [1, 1, 0.28]));

    for (const x of [-0.062, 0.062]) {
        const fin = mesh(new THREE.ConeGeometry(0.028, 0.085, 3), bodyMaterial, [x, 0.075, 0], [0.75, 1, 0.8], [0, 0, x < 0 ? -0.55 : 0.55]);
        group.add(fin);
    }

    group.userData.groundOffset = 0.015;
    group.userData.animate = (time) => {
        const baseY = group.userData.baseY ?? group.position.y;
        group.rotation.y += 0.006;
        group.position.y = baseY + Math.sin(time * 0.004) * 0.01;
    };
    return group;
}

function createCrystal(color) {
    const group = new THREE.Group();
    const material = createMaterial(color, {
        roughness: 0.18,
        metalness: 0.18,
        emissive: color,
        emissiveIntensity: 0.12
    });
    const core = mesh(new THREE.OctahedronGeometry(0.11, 0), material, [0, 0.12, 0], [0.86, 1.3, 0.86]);
    group.add(core);

    for (const x of [-0.09, 0.09]) {
        group.add(mesh(new THREE.OctahedronGeometry(0.055, 0), material, [x, 0.07, -0.02], [0.75, 1.15, 0.75]));
    }

    group.userData.groundOffset = 0;
    group.userData.animate = () => {
        group.rotation.y += 0.004;
    };
    return group;
}

function mesh(geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(position[0], position[1], position[2]);
    item.scale.set(scale[0], scale[1], scale[2]);
    item.rotation.set(rotation[0], rotation[1], rotation[2]);
    item.castShadow = true;
    item.receiveShadow = true;
    return item;
}

function darkenColor(color, factor) {
    const value = new THREE.Color(color);
    value.multiplyScalar(factor);
    return value.getHex();
}

function animatePlacedObjects(timestamp) {
    placedObjects.forEach((object) => {
        if (object.userData.animate) object.userData.animate(timestamp);
    });
}

function initializeAnimationState(object) {
    object.traverse((child) => {
        if (child.userData?.animate) {
            child.userData.baseY = child.position.y;
        }
    });
}

function clearPlacedObjects() {
    while (placedObjects.length) {
        const object = placedObjects.pop();
        scene.remove(object);
        disposeObject(object);
    }
    updateObjectCount();
}

function disposeObject(object) {
    object.traverse((child) => {
        if (!child.isMesh && !child.isLineSegments) return;
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach((material) => material.dispose());
            } else {
                child.material.dispose();
            }
        }
    });
}

function flashReticle() {
    reticle.children.forEach((child) => {
        if (child.material?.color) child.material.color.setHex(0xffffff);
    });
    setTimeout(() => {
        reticle.children.forEach((child, index) => {
            if (child.material?.color) child.material.color.setHex(index === 0 ? 0x7dd3fc : 0xffffff);
        });
    }, 180);
}

function updateObjectCount() {
    objectCountEl.textContent = String(placedObjects.length);
}

function onWindowResize() {
    if (!camera || !renderer) return;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
