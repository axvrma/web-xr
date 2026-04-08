import './style.css';

let camera, scene, renderer;
let reticle, reticleVisible = false;
let hitTestSource = null;
let hitTestSourceRequested = false;
let localReferenceSpace = null;
let xrSession = null;

const placedObjects = [];

const COLORS = {
    red: 0xff0000,
    blue: 0x0066ff,
    green: 0x00ff00,
    yellow: 0xffff00,
    orange: 0xff8800,
    purple: 0x8800ff,
    white: 0xffffff,
    black: 0x222222,
    pink: 0xff69b4,
    cyan: 0x00ffff
};

const SHAPES = ['cube', 'sphere', 'cylinder', 'cone', 'box'];

const startARBtn = document.getElementById('start-ar-btn');
const micBtn = document.getElementById('mic-btn');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const instructionsEl = document.getElementById('instructions');
const notSupportedEl = document.getElementById('not-supported');
const notSupportedReasonEl = document.getElementById('not-supported-reason');

init();

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

async function init() {
    if (isIOS()) {
        showNotSupported(
            'iOS does not support WebXR AR. Apple has not implemented this web standard.',
            true
        );
        return;
    }

    const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
    
    if (!isSecure) {
        showNotSupported('Page must be loaded over HTTPS. Current: ' + location.protocol);
        return;
    }

    if (!navigator.xr) {
        showNotSupported('WebXR API not available. Make sure you are using Chrome on Android.');
        return;
    }

    try {
        const isARSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (!isARSupported) {
            showNotSupported('Immersive AR not supported. Your device may not have ARCore installed.');
            return;
        }
    } catch (error) {
        showNotSupported('Error checking AR support: ' + error.message);
        return;
    }

    setupScene();
    setupStartButton();
    setupMicButton();
    statusEl.textContent = 'Ready! Tap "Start AR" to begin';
}

function showNotSupported(reason, isIOSDevice = false) {
    startARBtn.classList.add('hidden');
    notSupportedEl.classList.remove('hidden');
    statusEl.textContent = 'AR not available';
    
    if (notSupportedReasonEl && reason) {
        if (isIOSDevice) {
            notSupportedReasonEl.innerHTML = `
                <div class="ios-message">
                    <p class="error-reason">${reason}</p>
                    <p class="ios-suggestion">Please try this app on an <strong>Android device</strong> with Chrome browser.</p>
                </div>
            `;
            document.querySelector('.setup-steps').style.display = 'none';
        } else {
            notSupportedReasonEl.innerHTML = `<p class="error-reason">${reason}</p>`;
        }
    }
    
    console.error('AR not supported:', reason);
}

function setupScene() {
    const container = document.getElementById('container');

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    createReticle();

    window.addEventListener('resize', onWindowResize);
}

function createReticle() {
    const geometry = new THREE.RingGeometry(0.05, 0.07, 32);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00,
        transparent: true,
        opacity: 0.8
    });
    reticle = new THREE.Mesh(geometry, material);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
}

function setupStartButton() {
    startARBtn.addEventListener('click', startAR);
}

async function startAR() {
    try {
        xrSession = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['local-floor', 'dom-overlay'],
            domOverlay: { root: document.getElementById('overlay') }
        });

        xrSession.addEventListener('end', onSessionEnd);

        await renderer.xr.setReferenceSpaceType('local');
        await renderer.xr.setSession(xrSession);

        startARBtn.classList.add('hidden');
        micBtn.classList.remove('hidden');
        instructionsEl.classList.remove('hidden');
        statusEl.textContent = 'Point at a surface, then tap mic to speak';

        renderer.setAnimationLoop(render);

    } catch (error) {
        console.error('Failed to start AR session:', error);
        statusEl.textContent = 'Failed to start AR: ' + error.message;
    }
}

function onSessionEnd() {
    xrSession = null;
    hitTestSource = null;
    hitTestSourceRequested = false;
    
    startARBtn.classList.remove('hidden');
    micBtn.classList.add('hidden');
    instructionsEl.classList.add('hidden');
    statusEl.textContent = 'AR session ended. Tap to restart.';
    
    renderer.setAnimationLoop(null);
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();

        if (!hitTestSourceRequested) {
            requestHitTestSource(frame.session, referenceSpace);
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

    renderer.render(scene, camera);
}

async function requestHitTestSource(session, referenceSpace) {
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
            statusEl.textContent = 'Speech recognition not supported';
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
            statusEl.textContent = 'Point camera at a surface first';
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
            statusEl.textContent = 'Listening...';
            transcriptEl.textContent = '';
        } catch (error) {
            console.error('Speech recognition error:', error);
            statusEl.textContent = 'Could not start listening';
        }
    });

    recognition.onresult = (event) => {
        const results = event.results[0];
        let command = results[0].transcript.toLowerCase().trim();
        
        transcriptEl.textContent = `"${command}"`;
        
        const parsed = parseCommand(command);
        
        if (parsed) {
            placeObject(parsed.color, parsed.shape);
            statusEl.textContent = `Placed ${parsed.colorName} ${parsed.shape}!`;
        } else {
            for (let i = 1; i < results.length; i++) {
                command = results[i].transcript.toLowerCase().trim();
                const altParsed = parseCommand(command);
                if (altParsed) {
                    placeObject(altParsed.color, altParsed.shape);
                    statusEl.textContent = `Placed ${altParsed.colorName} ${altParsed.shape}!`;
                    return;
                }
            }
            statusEl.textContent = 'Try: "red cube" or "blue sphere"';
        }
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

function parseCommand(command) {
    let foundColor = null;
    let foundColorName = null;
    let foundShape = null;

    for (const [colorName, colorValue] of Object.entries(COLORS)) {
        if (command.includes(colorName)) {
            foundColor = colorValue;
            foundColorName = colorName;
            break;
        }
    }

    for (const shape of SHAPES) {
        if (command.includes(shape)) {
            foundShape = shape === 'box' ? 'cube' : shape;
            break;
        }
    }

    if (foundShape) {
        return {
            color: foundColor || 0xff0000,
            colorName: foundColorName || 'red',
            shape: foundShape
        };
    }

    return null;
}

function placeObject(color, shape) {
    if (!reticle.visible) return;

    let geometry;
    const size = 0.1;

    switch (shape) {
        case 'sphere':
            geometry = new THREE.SphereGeometry(size * 0.8, 32, 32);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(size * 0.5, size * 0.5, size * 1.5, 32);
            break;
        case 'cone':
            geometry = new THREE.ConeGeometry(size * 0.6, size * 1.5, 32);
            break;
        case 'cube':
        default:
            geometry = new THREE.BoxGeometry(size, size, size);
            break;
    }

    const material = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.2
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    reticle.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    
    if (shape === 'cube' || shape === 'cylinder' || shape === 'cone') {
        mesh.position.y += size * 0.5;
    } else if (shape === 'sphere') {
        mesh.position.y += size * 0.8;
    }

    mesh.scale.set(1, 1, 1);
    
    scene.add(mesh);
    placedObjects.push(mesh);

    reticle.material.color.setHex(0x00ff00);
    setTimeout(() => {
        if (reticle.material) {
            reticle.material.color.setHex(0x00ff00);
        }
    }, 200);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
