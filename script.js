// Game state
const gameState = {
    health: 100,
    maxHealth: 100,
    regenRate: 2,
    damageFlash: 0,
    score: 0,
    kills: 0,
    wave: 1,
    ammo: 30,
    maxAmmo: 30,
    reserveAmmo: Infinity,
    isReloading: false,
    reloadStartTime: 0,
    reloadDuration: 2000,
    lastShotTime: 0,
    shotsFired: 0,
    shotsHit: 0,
    isPlaying: false,
    isSprinting: false,
    isAiming: false,
    zombiesInWave: 20,
    zombiesSpawned: 0,
    zombiesKilled: 0
};

// Player state
const player = {
    position: new THREE.Vector3(0, 2, 0),
    velocity: new THREE.Vector3(),
    rotation: { x: 0, y: 0 },
    speed: 0.15,
    sprintSpeed: 0.25,
    collisionRadius: 0.4,
    verticalVelocity: 0,
    isOnGround: true,
    jumpQueued: false
};

// Input state
const keys = {};
const mouse = { x: 0, y: 0 };

// Three.js setup
let scene, camera, renderer;
let zombies = [];
let bullets = [];
let cars = [];
let buildings = [];
let bulletDecals = [];
let debrisPieces = [];  // Track debris separately for zombie climbing
const colliders = [];
const collisionObjects = [];
const zombieNavigationObjects = [];  // Objects zombies need to navigate around (excludes climbables)
let zombieModel = null;
let zombieClips = [];
let carModel = null;
let debrisModel = null;
let flashlight = null;
let flashlightTarget = null;
let gunModel = null;
let weaponRig = null;
let muzzleMesh = null;
let gunshotAudio = null;
let waveAudio = null;
let hurtAudio = null;
let carsCreated = false;
let debrisCreated = false;
let decalTexture = null;
const propSpawnPoints = [];
const gunBasePosition = new THREE.Vector3();
const gunBaseRotation = new THREE.Euler();
const gunAimPosition = new THREE.Vector3(0.22, -0.28, -0.35);
const BASE_FOV = 75;
const AIM_FOV = 25;
const animationClock = new THREE.Clock();
const collisionBox = new THREE.Box3();
const navigationRaycaster = new THREE.Raycaster();

const ZOMBIE_MODEL_URL = 'assets/zombie.glb';
const ZOMBIE_SCALE = 1.2;
const CAR_MODEL_URL = 'assets/car.glb';
const CAR_SCALE = 3;
const CAR_GROUND_OFFSET = 0.05;
const PLAYER_SPAWN_RADIUS = 3;
const DEBRIS_MODEL_URL = 'assets/debris.glb';
const DEBRIS_SCALE = 2;
const DECAL_TEXTURE_URL = 'assets/decal.png';
const GROUND_TEXTURE_URL = 'assets/ground.png';

// Initialize Three.js
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a15);
    scene.fog = new THREE.FogExp2(0x0a0a15, 0.02);

    camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.copy(player.position);
    scene.add(camera);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Lighting
    setupLighting();
    setupFlashlight();
    setupGunModel();
    setupAudio();

    // Create environment
    createEnvironment();

    // Load zombie model
    loadZombieModel();
    loadCarModel();
    loadDebrisModel();

    // Hide loading screen
    document.getElementById('loading').style.display = 'none';

    // Event listeners
    setupEventListeners();

    // Start render loop
    animate();
}

function loadZombieModel() {
    const loader = new THREE.GLTFLoader();
    loader.load(
        ZOMBIE_MODEL_URL,
        (gltf) => {
            zombieModel = gltf.scene;
            zombieClips = gltf.animations || [];
        },
        undefined,
        (error) => {
            console.error('Failed to load zombie model:', error);
        }
    );
}

function loadCarModel() {
    const loader = new THREE.GLTFLoader();
    loader.load(
        CAR_MODEL_URL,
        (gltf) => {
            carModel = gltf.scene;
            createCars();
        },
        undefined,
        (error) => {
            console.error('Failed to load car model:', error);
        }
    );
}

function loadDebrisModel() {
    const loader = new THREE.GLTFLoader();
    loader.load(
        DEBRIS_MODEL_URL,
        (gltf) => {
            debrisModel = gltf.scene;
            createDebrisModels();
        },
        undefined,
        (error) => {
            console.error('Failed to load debris model:', error);
        }
    );
}

function centerModelOnFloor(model) {
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    if (!Number.isFinite(bounds.min.y)) {
        return;
    }
    model.position.y -= bounds.min.y;
    model.updateMatrixWorld(true);
}

function setupLighting() {
    // Ambient light (very dim)
    const ambient = new THREE.AmbientLight(0x1a1a2e, 0.3);
    scene.add(ambient);

    // Main spotlight (blue beam like in image)
    const spotlight = new THREE.SpotLight(0x4466ff, 2);
    spotlight.position.set(0, 50, 0);
    spotlight.angle = Math.PI / 8;
    spotlight.penumbra = 0.3;
    spotlight.castShadow = true;
    scene.add(spotlight);

    // Red accent lights
    const redLight1 = new THREE.PointLight(0xff3333, 1, 30);
    redLight1.position.set(-20, 5, -30);
    scene.add(redLight1);

    const redLight2 = new THREE.PointLight(0xff3333, 1, 30);
    redLight2.position.set(20, 5, -30);
    scene.add(redLight2);

    // Purple accent (like in image)
    const purpleLight = new THREE.PointLight(0x9933ff, 1.5, 25);
    purpleLight.position.set(30, 3, -10);
    scene.add(purpleLight);

    // Street lights
    for (let i = 0; i < 6; i++) {
        const streetLight = new THREE.PointLight(0xffaa44, 0.8, 15);
        streetLight.position.set(-25 + i * 10, 8, -20 + Math.random() * 40);
        scene.add(streetLight);
    }

    // Fire light (flickering)
    const fireLight = new THREE.PointLight(0xff6600, 2, 20);
    fireLight.position.set(5, 4, -25);
    scene.add(fireLight);

    // Animate fire light
    setInterval(() => {
        fireLight.intensity = 1.5 + Math.random() * 1;
    }, 100);
}

function setupFlashlight() {
    flashlight = new THREE.SpotLight(0xffffff, 1.2, 30, Math.PI / 8, 0.4, 1);
    flashlight.position.set(0.2, -0.15, -0.35);
    flashlightTarget = new THREE.Object3D();
    flashlightTarget.position.set(0, -0.1, -5);
    camera.add(flashlight);
    camera.add(flashlightTarget);
    flashlight.target = flashlightTarget;
}

function setupGunModel() {
    weaponRig = new THREE.Group();
    camera.add(weaponRig);

    gunModel = new THREE.Group();

    const gunMaterial = new THREE.MeshStandardMaterial({
        color: 0x1f232b,
        roughness: 0.3,
        metalness: 0.7
    });

    const accentMaterial = new THREE.MeshStandardMaterial({
        color: 0x0b0d12,
        roughness: 0.6,
        metalness: 0.2
    });

    const highlightMaterial = new THREE.MeshStandardMaterial({
        color: 0x2b5f7a,
        roughness: 0.4,
        metalness: 0.5
    });

    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.6), gunMaterial);
    handguard.position.set(0.12, -0.06, -0.75);
    gunModel.add(handguard);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 16), gunMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.12, -0.06, -1.25);
    gunModel.add(barrel);

    const gasBlock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.08), accentMaterial);
    gasBlock.position.set(0.12, -0.05, -1.0);
    gunModel.add(gasBlock);

    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.04), accentMaterial);
    frontSight.position.set(0.12, 0.02, -1.05);
    gunModel.add(frontSight);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.12, 16), highlightMaterial);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0.12, -0.06, -1.65);
    gunModel.add(muzzle);
    muzzleMesh = muzzle;

    const upperReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.35), gunMaterial);
    upperReceiver.position.set(0.06, -0.02, -0.4);
    gunModel.add(upperReceiver);

    const lowerReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.26), accentMaterial);
    lowerReceiver.position.set(0.05, -0.12, -0.35);
    gunModel.add(lowerReceiver);

    const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.1), accentMaterial);
    pistolGrip.position.set(-0.02, -0.24, -0.25);
    pistolGrip.rotation.x = 0.3;
    gunModel.add(pistolGrip);

    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.12), accentMaterial);
    magazine.position.set(0.08, -0.28, -0.32);
    magazine.rotation.x = 0.12;
    gunModel.add(magazine);

    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.5), gunMaterial);
    stock.position.set(0.08, -0.05, -0.02);
    gunModel.add(stock);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.5), accentMaterial);
    topRail.position.set(0.06, 0.05, -0.55);
    gunModel.add(topRail);

    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.05), accentMaterial);
    rearSight.position.set(0.06, 0.08, -0.35);
    gunModel.add(rearSight);

    gunModel.position.set(0.32, -0.34, -0.55);
    gunModel.rotation.set(-0.02, 0.03, 0.03);
    gunBasePosition.copy(gunModel.position);
    gunBaseRotation.copy(gunModel.rotation);

    weaponRig.add(gunModel);
}

function setupAudio() {
    gunshotAudio = new Audio('assets/gunshot.mp3');
    gunshotAudio.volume = 0.5;
    waveAudio = new Audio('assets/wave.mp3');
    waveAudio.volume = 0.6;
    hurtAudio = new Audio('assets/hurt.mp3');
    hurtAudio.volume = 0.55;
}

function playGunshot() {
    if (!gunshotAudio) return;
    gunshotAudio.currentTime = 0;
    gunshotAudio.play().catch(() => {});
}

function playWaveSound() {
    if (!waveAudio) return;
    waveAudio.currentTime = 0;
    waveAudio.play().catch(() => {});
}

function playHurtSound() {
    if (!hurtAudio) return;
    hurtAudio.currentTime = 0;
    hurtAudio.play().catch(() => {});
}

function updateMuzzleFlashPosition() {
    const muzzleFlash = document.getElementById('muzzle-flash');
    if (!muzzleMesh || !muzzleFlash) return;

    const position = new THREE.Vector3();
    muzzleMesh.getWorldPosition(position);
    position.project(camera);

    const x = (position.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-position.y * 0.5 + 0.5) * window.innerHeight;

    const clampedX = Math.min(Math.max(x, 0), window.innerWidth);
    const clampedY = Math.min(Math.max(y, 0), window.innerHeight);

    muzzleFlash.style.left = `${clampedX}px`;
    muzzleFlash.style.top = `${clampedY}px`;
}

function createEnvironment() {
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200);
    const groundTexture = new THREE.TextureLoader().load(GROUND_TEXTURE_URL);
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(8, 8);
    const groundMaterial = new THREE.MeshStandardMaterial({
        map: groundTexture,
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Wet street effect
    const streetGeometry = new THREE.PlaneGeometry(15, 100);
    const streetTexture = new THREE.TextureLoader().load(GROUND_TEXTURE_URL);
    streetTexture.wrapS = THREE.RepeatWrapping;
    streetTexture.wrapT = THREE.RepeatWrapping;
    streetTexture.repeat.set(1.5, 8);
    const streetMaterial = new THREE.MeshStandardMaterial({
        map: streetTexture,
        roughness: 0.5,
        metalness: 0.2
    });
    const street = new THREE.Mesh(streetGeometry, streetMaterial);
    street.rotation.x = -Math.PI / 2;
    street.position.y = 0.01;
    scene.add(street);

    // Buildings
    createBuildings();

    // Debris and cars
    createDebris();

    // KORBER sign
    createKorberSign();

    // Light beam
    createLightBeam();

    refreshCollisionBoxes();
}

function registerCollider(object, padding = 0.2, isClimbable = false) {
    colliders.push({
        object,
        box: new THREE.Box3(),
        padding,
        isClimbable  // Zombies can climb over this
    });
    collisionObjects.push(object);

    // Only add non-climbable objects to zombie navigation
    if (!isClimbable) {
        zombieNavigationObjects.push(object);
    }
}

function refreshCollisionBoxes() {
    colliders.forEach((collider) => {
        collider.box.setFromObject(collider.object);
    });
}

function isPositionBlocked(position, radius) {
    for (const collider of colliders) {
        collisionBox.copy(collider.box).expandByScalar(radius + collider.padding);
        if (collisionBox.containsPoint(position)) {
            return true;
        }
    }
    return false;
}

// Check if position is blocked for zombies (ignores climbable objects like debris)
function isPositionBlockedForZombie(position, radius) {
    for (const collider of colliders) {
        if (collider.isClimbable) continue;  // Zombies can walk over climbable objects
        collisionBox.copy(collider.box).expandByScalar(radius + collider.padding);
        if (collisionBox.containsPoint(position)) {
            return true;
        }
    }
    return false;
}

// Get the height of any climbable object (debris/cars) at a position for zombie climbing
function getClimbableHeightAt(position, radius) {
    let maxHeight = 0;

    // Check debris
    for (const debris of debrisPieces) {
        const debrisPos = debris.position;
        const dx = position.x - debrisPos.x;
        const dz = position.z - debrisPos.z;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);

        // Check if within debris radius (approximate)
        if (horizontalDist < 2.5) {
            const box = new THREE.Box3().setFromObject(debris);
            const debrisHeight = box.max.y;

            // Smooth falloff at edges
            const falloff = Math.max(0, 1 - (horizontalDist / 2.5));
            const effectiveHeight = debrisHeight * falloff;

            if (effectiveHeight > maxHeight) {
                maxHeight = effectiveHeight;
            }
        }
    }

    // Check cars
    for (const car of cars) {
        const carPos = car.position;
        const dx = position.x - carPos.x;
        const dz = position.z - carPos.z;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);

        // Check if within car radius (cars are bigger)
        if (horizontalDist < 3.5) {
            const box = new THREE.Box3().setFromObject(car);
            const carHeight = box.max.y;

            // Smooth falloff at edges
            const falloff = Math.max(0, 1 - (horizontalDist / 3.5));
            const effectiveHeight = carHeight * falloff;

            if (effectiveHeight > maxHeight) {
                maxHeight = effectiveHeight;
            }
        }
    }

    return maxHeight;
}

// Move with collisions for zombies (can climb over debris)
function moveZombieWithCollisions(position, delta, radius) {
    if (delta.lengthSq() === 0) return;
    const candidate = position.clone();
    candidate.x += delta.x;
    if (!isPositionBlockedForZombie(candidate, radius)) {
        position.x = candidate.x;
    }
    candidate.set(position.x, position.y, position.z + delta.z);
    if (!isPositionBlockedForZombie(candidate, radius)) {
        position.z = candidate.z;
    }
}

function moveWithCollisions(position, delta, radius) {
    if (delta.lengthSq() === 0) return;
    const candidate = position.clone();
    candidate.x += delta.x;
    if (!isPositionBlocked(candidate, radius)) {
        position.x = candidate.x;
    }
    candidate.set(position.x, position.y, position.z + delta.z);
    if (!isPositionBlocked(candidate, radius)) {
        position.z = candidate.z;
    }
}

function getClearDistance(origin, direction, range = 5) {
    navigationRaycaster.set(origin, direction);
    navigationRaycaster.far = range;
    const hits = navigationRaycaster.intersectObjects(collisionObjects, true);
    return hits.length > 0 ? hits[0].distance : range;
}

// Get clear distance for zombies (ignores climbable objects like cars and debris)
function getZombieClearDistance(origin, direction, range = 5) {
    navigationRaycaster.set(origin, direction);
    navigationRaycaster.far = range;
    const hits = navigationRaycaster.intersectObjects(zombieNavigationObjects, true);
    return hits.length > 0 ? hits[0].distance : range;
}

// ============================================
// ENHANCED ZOMBIE AI SYSTEM
// ============================================

// Zombie behavior types
const ZombieType = {
    SHAMBLER: 'shambler',     // Slow but persistent, basic behavior
    RUNNER: 'runner',         // Fast, aggressive, charges directly
    STALKER: 'stalker',       // Sneaky, tries to approach from blind spots
    FLANKER: 'flanker',       // Coordinates with others to surround player
    BRUTE: 'brute'            // Slow but tanky, breaks through obstacles
};

// Zombie states
const ZombieState = {
    IDLE: 'idle',             // Wandering aimlessly
    ALERTED: 'alerted',       // Heard something, investigating
    PURSUING: 'pursuing',     // Actively chasing player
    ATTACKING: 'attacking',   // In attack range
    STUNNED: 'stunned',       // Temporarily disabled (hit reaction)
    FLANKING: 'flanking',     // Moving to flank position
    WAITING: 'waiting'        // Holding position (for coordinated attacks)
};

// Initialize zombie AI data
function initZombieAI(zombie) {
    const types = Object.values(ZombieType);
    const typeWeights = [0.4, 0.25, 0.15, 0.15, 0.05]; // Probability weights
    const roll = Math.random();
    let cumulative = 0;
    let selectedType = ZombieType.SHAMBLER;
    for (let i = 0; i < types.length; i++) {
        cumulative += typeWeights[i];
        if (roll < cumulative) {
            selectedType = types[i];
            break;
        }
    }

    // Type-specific attributes
    const typeConfigs = {
        [ZombieType.SHAMBLER]: {
            baseSpeed: 0.035,
            aggroRange: 35,
            viewAngle: Math.PI * 0.8,
            patience: 5000,
            wobbleAmount: 0.25,
            speedVariation: 0.3
        },
        [ZombieType.RUNNER]: {
            baseSpeed: 0.065,
            aggroRange: 40,
            viewAngle: Math.PI * 0.6,
            patience: 2000,
            wobbleAmount: 0.08,
            speedVariation: 0.15
        },
        [ZombieType.STALKER]: {
            baseSpeed: 0.045,
            aggroRange: 45,
            viewAngle: Math.PI,
            patience: 8000,
            wobbleAmount: 0.12,
            speedVariation: 0.2
        },
        [ZombieType.FLANKER]: {
            baseSpeed: 0.05,
            aggroRange: 35,
            viewAngle: Math.PI * 0.7,
            patience: 4000,
            wobbleAmount: 0.15,
            speedVariation: 0.2
        },
        [ZombieType.BRUTE]: {
            baseSpeed: 0.028,
            aggroRange: 30,
            viewAngle: Math.PI * 0.5,
            patience: 10000,
            wobbleAmount: 0.3,
            speedVariation: 0.1
        }
    };

    const config = typeConfigs[selectedType];
    const waveMultiplier = 1 + gameState.wave * 0.08;

    return {
        type: selectedType,
        state: ZombieState.PURSUING,  // Start pursuing - they spawn to attack!
        previousState: ZombieState.PURSUING,
        stateTimer: 0,

        // Movement
        baseSpeed: config.baseSpeed * waveMultiplier * (1 + (Math.random() - 0.5) * config.speedVariation),
        currentSpeed: 0,
        wobbleOffset: Math.random() * Math.PI * 2,
        wobbleAmount: config.wobbleAmount,
        moveDirection: new THREE.Vector3(),
        targetPosition: null,

        // Perception
        aggroRange: config.aggroRange,
        viewAngle: config.viewAngle,
        lastKnownPlayerPos: null,
        lastSeenTime: 0,
        hearingRange: 15,

        // Behavior
        patience: config.patience,
        searchTime: 0,
        wanderTarget: null,
        wanderTimer: 0,
        flankAngle: (Math.random() - 0.5) * Math.PI,
        coordinationGroup: null,

        // Combat
        attackWindup: 0,
        attackCooldown: 0,
        hitStunTimer: 0,

        // Path memory for smoother movement
        pathHistory: [],
        pathUpdateTimer: 0
    };
}

// Check if zombie can see the player
function canZombieSeePlayer(zombie) {
    const ai = zombie.userData.ai;
    if (!ai) return true; // Fallback: always can see

    const toPlayer = new THREE.Vector3().subVectors(player.position, zombie.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();

    // Distance check - always aware within aggro range
    if (distance > ai.aggroRange) return false;

    // Skip angle check for close range - zombies can "sense" nearby players
    if (distance < 8) return true;

    // Angle check (field of view) for longer distances
    const zombieForward = new THREE.Vector3(0, 0, 1).applyQuaternion(zombie.quaternion);
    zombieForward.y = 0;
    if (zombieForward.lengthSq() < 0.0001) {
        zombieForward.set(0, 0, 1);
    }
    zombieForward.normalize();
    toPlayer.normalize();

    const dot = zombieForward.dot(toPlayer);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    if (angle > ai.viewAngle / 2) return false;

    // Line of sight check (raycast) - only check if we passed other checks
    const origin = zombie.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    const direction = new THREE.Vector3().subVectors(player.position, origin).normalize();
    navigationRaycaster.set(origin, direction);
    navigationRaycaster.far = distance;
    const hits = navigationRaycaster.intersectObjects(collisionObjects, true);

    return hits.length === 0 || hits[0].distance > distance - 0.5;
}

// Get a flanking position around the player
function getFlankPosition(zombie, index) {
    const ai = zombie.userData.ai;
    const baseAngle = ai.flankAngle + (index * Math.PI * 2 / Math.max(zombies.length, 1));
    const flankDistance = 4 + Math.random() * 2;

    // Find a position that's behind or to the side of where player is looking
    const playerForward = new THREE.Vector3();
    camera.getWorldDirection(playerForward);
    playerForward.y = 0;
    playerForward.normalize();

    const flankAngle = Math.atan2(playerForward.x, playerForward.z) + Math.PI + baseAngle;

    return new THREE.Vector3(
        player.position.x + Math.sin(flankAngle) * flankDistance,
        0,
        player.position.z + Math.cos(flankAngle) * flankDistance
    );
}

// Get wander target for idle behavior
function getWanderTarget(zombie) {
    const wanderRadius = 8;
    const attempts = 10;

    for (let i = 0; i < attempts; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 3 + Math.random() * wanderRadius;
        const target = new THREE.Vector3(
            zombie.position.x + Math.cos(angle) * distance,
            0,
            zombie.position.z + Math.sin(angle) * distance
        );

        // Keep within bounds
        target.x = Math.max(-38, Math.min(38, target.x));
        target.z = Math.max(-38, Math.min(38, target.z));

        if (!isPositionBlocked(target, 0.5)) {
            return target;
        }
    }

    return zombie.position.clone();
}

// Update zombie state machine
function updateZombieState(zombie, delta, now) {
    const ai = zombie.userData.ai;
    const toPlayer = new THREE.Vector3().subVectors(player.position, zombie.position);
    toPlayer.y = 0;
    const distanceToPlayer = toPlayer.length();

    const canSee = canZombieSeePlayer(zombie);

    // Update last known position if we can see player
    if (canSee) {
        ai.lastKnownPlayerPos = player.position.clone();
        ai.lastSeenTime = now;
    }

    // State transitions
    const previousState = ai.state;

    switch (ai.state) {
        case ZombieState.IDLE:
            // Idle zombies quickly become alert and pursue
            if (canSee || distanceToPlayer < 25) {
                ai.state = ZombieState.PURSUING;
            } else {
                // Wander behavior
                ai.wanderTimer -= delta * 1000;
                if (ai.wanderTimer <= 0 || !ai.wanderTarget) {
                    ai.wanderTarget = getWanderTarget(zombie);
                    ai.wanderTimer = 3000 + Math.random() * 4000;
                }
            }
            break;

        case ZombieState.ALERTED:
            ai.stateTimer -= delta * 1000;
            if (ai.stateTimer <= 0) {
                ai.state = ZombieState.PURSUING;
            }
            break;

        case ZombieState.PURSUING:
            if (distanceToPlayer < 1.5) {
                ai.state = ZombieState.ATTACKING;
            }
            // Flankers might switch to flanking behavior when far away
            else if (ai.type === ZombieType.FLANKER && distanceToPlayer > 10 && Math.random() < 0.005) {
                ai.state = ZombieState.FLANKING;
            }
            // Stalkers try to flank when far
            else if (ai.type === ZombieType.STALKER && distanceToPlayer > 12 && Math.random() < 0.003) {
                ai.state = ZombieState.FLANKING;
            }
            break;

        case ZombieState.FLANKING:
            // Switch back to pursuing when close
            if (distanceToPlayer < 4) {
                ai.state = ZombieState.PURSUING;
            }
            // Time limit on flanking
            ai.stateTimer = (ai.stateTimer || 0) + delta * 1000;
            if (ai.stateTimer > 5000) {
                ai.state = ZombieState.PURSUING;
                ai.stateTimer = 0;
            }
            break;

        case ZombieState.ATTACKING:
            if (distanceToPlayer > 2.5) {
                ai.state = ZombieState.PURSUING;
            }
            break;

        case ZombieState.STUNNED:
            ai.hitStunTimer -= delta * 1000;
            if (ai.hitStunTimer <= 0) {
                ai.state = ZombieState.PURSUING;
            }
            break;
    }

    // Track state changes
    if (ai.state !== previousState) {
        ai.previousState = previousState;
    }
}

// Calculate movement direction based on current state and type
function getZombieMoveDirection(zombie) {
    const ai = zombie.userData.ai;
    if (!ai) {
        // Fallback for zombies without AI (shouldn't happen)
        const direction = new THREE.Vector3().subVectors(player.position, zombie.position);
        direction.y = 0;
        return direction.lengthSq() > 0.0001 ? direction.normalize() : new THREE.Vector3();
    }

    const now = performance.now();
    const direction = new THREE.Vector3();

    // Apply wobble for more organic movement
    const wobble = Math.sin(now * 0.003 + ai.wobbleOffset) * ai.wobbleAmount;

    switch (ai.state) {
        case ZombieState.IDLE:
            if (ai.wanderTarget) {
                direction.subVectors(ai.wanderTarget, zombie.position);
                direction.y = 0;
                if (direction.length() < 1) {
                    ai.wanderTarget = null;
                    return new THREE.Vector3();
                }
            }
            break;

        case ZombieState.ALERTED:
            // Turn towards sound/sight but don't move yet
            if (ai.lastKnownPlayerPos) {
                direction.subVectors(ai.lastKnownPlayerPos, zombie.position);
            }
            direction.multiplyScalar(0.1); // Slow creep forward
            break;

        case ZombieState.PURSUING:
            // Always go towards actual player position (they're actively pursuing)
            direction.subVectors(player.position, zombie.position);

            // Runners take more direct paths
            if (ai.type !== ZombieType.RUNNER) {
                // Add slight randomness to path for non-runners
                direction.x += wobble * 0.3;
                direction.z += Math.cos(now * 0.002 + ai.wobbleOffset) * ai.wobbleAmount * 0.3;
            }
            break;

        case ZombieState.FLANKING: {
            const zombieIndex = zombies.indexOf(zombie);
            const flankPos = getFlankPosition(zombie, zombieIndex);
            direction.subVectors(flankPos, zombie.position);

            // If close to flank position, start approaching player
            if (direction.length() < 2) {
                direction.subVectors(player.position, zombie.position);
            }
            break;
        }

        case ZombieState.ATTACKING:
            direction.subVectors(player.position, zombie.position);
            direction.multiplyScalar(0.3); // Slow down when attacking
            break;

        case ZombieState.STUNNED:
            // Stagger backwards
            direction.subVectors(zombie.position, player.position);
            direction.multiplyScalar(0.2);
            break;
    }

    direction.y = 0;

    if (direction.lengthSq() < 0.0001) {
        return new THREE.Vector3();
    }

    // Apply wobble rotation
    if (ai.state === ZombieState.PURSUING || ai.state === ZombieState.FLANKING) {
        const wobbleAngle = wobble * 0.2;
        const cos = Math.cos(wobbleAngle);
        const sin = Math.sin(wobbleAngle);
        const x = direction.x * cos - direction.z * sin;
        const z = direction.x * sin + direction.z * cos;
        direction.x = x;
        direction.z = z;
    }

    return direction.normalize();
}

// Get speed multiplier based on state and type
function getZombieSpeedMultiplier(zombie) {
    const ai = zombie.userData.ai;
    if (!ai) return 1;

    let multiplier = 1;

    switch (ai.state) {
        case ZombieState.IDLE:
            multiplier = 0.3;
            break;
        case ZombieState.ALERTED:
            multiplier = 0.4;
            break;
        case ZombieState.PURSUING:
            multiplier = 1;
            // Runners get a speed boost when they have line of sight
            if (ai.type === ZombieType.RUNNER && canZombieSeePlayer(zombie)) {
                multiplier = 1.3;
            }
            break;
        case ZombieState.FLANKING:
            multiplier = 0.85;
            break;
        case ZombieState.ATTACKING:
            multiplier = 0.4;
            break;
        case ZombieState.STUNNED:
            multiplier = 0.2;
            break;
    }

    // Brutes are always slower but consistent
    if (ai.type === ZombieType.BRUTE) {
        multiplier *= 0.7;
    }

    return multiplier;
}

// Apply hit stun to zombie
function stunZombie(zombie, duration = 300) {
    if (zombie.userData.ai) {
        zombie.userData.ai.state = ZombieState.STUNNED;
        zombie.userData.ai.hitStunTimer = duration;
    }
}

function isPropSpawnClear(position, radius) {
    if (position.distanceTo(player.position) < radius + PLAYER_SPAWN_RADIUS) {
        return false;
    }
    for (const point of propSpawnPoints) {
        if (position.distanceTo(point.position) < radius + point.radius) {
            return false;
        }
    }
    return true;
}

function getPropSpawnPosition(minX, maxX, minZ, maxZ, radius, maxAttempts = 40) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const candidate = new THREE.Vector3(
            minX + Math.random() * (maxX - minX),
            0,
            minZ + Math.random() * (maxZ - minZ)
        );
        if (!isPositionBlocked(candidate, radius) && isPropSpawnClear(candidate, radius)) {
            return candidate;
        }
    }
    return new THREE.Vector3(0, 0, 0);
}

function createBuildings() {
    const buildingMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a35,
        roughness: 0.8
    });

    // Left side buildings
    for (let i = 0; i < 5; i++) {
        const height = 15 + Math.random() * 20;
        const width = 10 + Math.random() * 8;
        const depth = 10 + Math.random() * 5;

        const building = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            buildingMaterial
        );
        building.position.set(-25 - i * 5, height / 2, -40 + i * 15);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        buildings.push(building);
        registerCollider(building);

        // Add windows
        addWindows(building, width, height, depth);
    }

    // Right side buildings
    for (let i = 0; i < 5; i++) {
        const height = 12 + Math.random() * 18;
        const width = 8 + Math.random() * 10;
        const depth = 8 + Math.random() * 6;

        const building = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, depth),
            buildingMaterial
        );
        building.position.set(25 + i * 5, height / 2, -35 + i * 12);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        buildings.push(building);
        registerCollider(building);

        addWindows(building, width, height, depth);
    }

    // Main building (KORBER)
    const mainBuilding = new THREE.Mesh(
        new THREE.BoxGeometry(30, 25, 15),
        new THREE.MeshStandardMaterial({ color: 0x3a3a45, roughness: 0.7 })
    );
    mainBuilding.position.set(0, 12.5, -50);
    mainBuilding.castShadow = true;
    scene.add(mainBuilding);
    buildings.push(mainBuilding);
    registerCollider(mainBuilding);
}

function addWindows(building, width, height, depth) {
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x334455 });
    const litWindowMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd88 });

    const windowSize = 1;
    const spacing = 3;

    for (let y = 2; y < height - 2; y += spacing) {
        for (let x = -width / 2 + 2; x < width / 2 - 1; x += spacing) {
            const isLit = Math.random() > 0.7;
            const windowMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(windowSize, windowSize * 1.5),
                isLit ? litWindowMaterial : windowMaterial
            );
            windowMesh.position.set(
                building.position.x + x,
                y,
                building.position.z + depth / 2 + 0.1
            );
            scene.add(windowMesh);
        }
    }
}

function createDebris() {
    createCars();
    createDebrisModels();

    // Rubble piles
    // Street lamp posts
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });

    for (let i = 0; i < 4; i++) {
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.15, 8),
            poleMaterial
        );
        pole.position.set(-12 + i * 8, 4, -15);

        // Some are bent
        if (Math.random() > 0.5) {
            pole.rotation.z = (Math.random() - 0.5) * 0.5;
        }

        scene.add(pole);
        registerCollider(pole, 0.5);  // Larger padding so zombies navigate around

        // Lamp head
        const lampHead = new THREE.Mesh(
            new THREE.SphereGeometry(0.3),
            new THREE.MeshBasicMaterial({ color: 0xffaa44 })
        );
        lampHead.position.set(pole.position.x, 8, pole.position.z);
        scene.add(lampHead);
    }
}

function createDebrisModels() {
    if (debrisCreated || !debrisModel) return;

    for (let i = 0; i < 20; i++) {
        const debris = debrisModel.clone(true);
        debris.scale.setScalar(DEBRIS_SCALE);
        centerModelOnFloor(debris);
        debris.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        debris.position.copy(getPropSpawnPosition(-30, 30, -40, 20, 1.6));
        debris.position.y = 0.3;
        debris.rotation.set(0, Math.random() * Math.PI * 2, 0);
        scene.add(debris);
        registerCollider(debris, 0.1, true);  // Mark as climbable for zombies
        debrisPieces.push(debris);  // Track for height calculations
        propSpawnPoints.push({ position: debris.position.clone(), radius: 1.6 });
    }

    debrisCreated = true;
    refreshCollisionBoxes();
}

function createCars() {
    if (carsCreated || !carModel) return;

    // Destroyed cars
    for (let i = 0; i < 8; i++) {
        const car = carModel.clone(true);
        car.scale.setScalar(CAR_SCALE);
        car.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Random positioning
        car.position.copy(getPropSpawnPosition(-15, 15, -30, 20, 2.2));
        car.position.y = 0;
        centerModelOnFloor(car);
        car.position.y += CAR_GROUND_OFFSET;
        car.rotation.y = Math.random() * Math.PI;

        // Some cars are flipped or tilted
        if (Math.random() > 0.7) {
            car.rotation.z = Math.random() * 0.2;
        }

        scene.add(car);
        registerCollider(car, 0.3, true);  // Mark as climbable for zombies
        cars.push(car);
        propSpawnPoints.push({ position: car.position.clone(), radius: 2.2 });
    }

    carsCreated = true;
    refreshCollisionBoxes();
}

function createKorberSign() {
    // Sign base
    const signBase = new THREE.Mesh(
        new THREE.BoxGeometry(12, 3, 1),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    );
    signBase.position.set(0, 28, -50);
    scene.add(signBase);

    // Neon text effect (simplified with glowing boxes)
    const neonMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444 });

    // K
    createLetter([-4.5, 28, -49.4], 'K', neonMaterial);
    // O
    createLetter([-3, 28, -49.4], 'O', neonMaterial);
    // R
    createLetter([-1.5, 28, -49.4], 'R', neonMaterial);
    // B
    createLetter([0, 28, -49.4], 'B', neonMaterial);
    // E
    createLetter([1.5, 28, -49.4], 'E', neonMaterial);
    // R
    createLetter([3, 28, -49.4], 'R', neonMaterial);

    // Neon glow
    const glowLight = new THREE.PointLight(0xff3333, 2, 15);
    glowLight.position.set(0, 28, -48);
    scene.add(glowLight);
}

function createLetter(pos, letter, material) {
    // Simplified letter representation
    const letterMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 2, 0.2),
        material
    );
    letterMesh.position.set(pos[0], pos[1], pos[2]);
    scene.add(letterMesh);
}

function createLightBeam() {
    // Vertical light beam
    const beamGeometry = new THREE.CylinderGeometry(0.5, 2, 100, 32, 1, true);
    const beamMaterial = new THREE.MeshBasicMaterial({
        color: 0x4466ff,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.set(0, 50, -40);
    scene.add(beam);
}

function getZombieSpawnPosition(spawnRadius = 0.5) {
    const minDistance = 18;
    const maxDistance = 35;
    const maxAttempts = 40;
    const boundsLimit = 38;

    const clampToBounds = (position) => {
        position.x = Math.max(-boundsLimit, Math.min(boundsLimit, position.x));
        position.z = Math.max(-boundsLimit, Math.min(boundsLimit, position.z));
        return position;
    };

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = minDistance + Math.random() * (maxDistance - minDistance);
        const candidate = new THREE.Vector3(
            player.position.x + Math.cos(angle) * distance,
            0,
            player.position.z + Math.sin(angle) * distance
        );

        if (!isPositionBlocked(candidate, spawnRadius)) {
            return clampToBounds(candidate);
        }
    }

    for (let distance = maxDistance; distance >= minDistance; distance -= 2) {
        for (let step = 0; step < 16; step++) {
            const angle = (Math.PI * 2 * step) / 16;
            const candidate = new THREE.Vector3(
                player.position.x + Math.cos(angle) * distance,
                0,
                player.position.z + Math.sin(angle) * distance
            );
            if (!isPositionBlocked(candidate, spawnRadius)) {
                return clampToBounds(candidate);
            }
        }
    }

    for (let step = 0; step < 8; step++) {
        const angle = (Math.PI * 2 * step) / 8;
        const fallback = new THREE.Vector3(
            player.position.x + Math.cos(angle) * maxDistance,
            0,
            player.position.z + Math.sin(angle) * maxDistance
        );
        if (!isPositionBlocked(fallback, spawnRadius)) {
            return clampToBounds(fallback);
        }
    }

    return clampToBounds(player.position.clone());
}

function spawnZombie() {
    if (gameState.zombiesSpawned >= gameState.zombiesInWave) return;

    let zombie;
    if (zombieModel) {
        const zombieInstance = THREE.SkeletonUtils.clone(zombieModel);
        zombie = new THREE.Group();
        zombie.add(zombieInstance);
        zombieInstance.scale.set(ZOMBIE_SCALE, ZOMBIE_SCALE, ZOMBIE_SCALE);
        centerModelOnFloor(zombieInstance);
        zombieInstance.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.frustumCulled = false;
                const materials = Array.isArray(child.material)
                    ? child.material
                    : [child.material];
                materials.forEach((material) => {
                    if (material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial) {
                        material.roughness = Math.max(material.roughness ?? 0.7, 0.8);
                        material.metalness = Math.min(material.metalness ?? 0.2, 0.1);
                        if (material.envMapIntensity !== undefined) {
                            material.envMapIntensity = Math.min(material.envMapIntensity, 0.3);
                        }
                        material.needsUpdate = true;
                    }
                });
            }
        });
    } else {
        zombie = new THREE.Group();

        // Body (placeholder - cylinder)
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a5a3a,
            roughness: 0.9,
            metalness: 0.05
        });

        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.4, 0.5, 1.5),
            bodyMaterial
        );
        body.position.y = 1.25;
        zombie.add(body);

        // Head (placeholder - sphere)
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.35),
            new THREE.MeshStandardMaterial({
                color: 0x4a6a4a,
                roughness: 0.9,
                metalness: 0.05
            })
        );
        head.position.y = 2.2;
        zombie.add(head);

        // Glowing eyes
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.05), eyeMaterial);
        leftEye.position.set(-0.12, 2.25, 0.3);
        zombie.add(leftEye);

        const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.05), eyeMaterial);
        rightEye.position.set(0.12, 2.25, 0.3);
        zombie.add(rightEye);

        // Arms (placeholder - cylinders)
        const armGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8);

        const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
        leftArm.position.set(-0.6, 1.5, 0.2);
        leftArm.rotation.x = Math.PI / 3;
        leftArm.rotation.z = Math.PI / 6;
        zombie.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
        rightArm.position.set(0.6, 1.5, 0.2);
        rightArm.rotation.x = Math.PI / 3;
        rightArm.rotation.z = -Math.PI / 6;
        zombie.add(rightArm);

        // Legs (placeholder)
        const legGeometry = new THREE.CylinderGeometry(0.12, 0.1, 1);

        const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        leftLeg.position.set(-0.2, 0.5, 0);
        zombie.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        rightLeg.position.set(0.2, 0.5, 0);
        zombie.add(rightLeg);
    }

    zombie.traverse((child) => {
        if (child.isMesh) {
            child.frustumCulled = false;
        }
    });

    // Create invisible hitbox for reliable raycasting
    // This solves the issue where skinned meshes don't raycast properly
    const hitboxMaterial = new THREE.MeshBasicMaterial({
        visible: false  // Invisible but still raycastable
    });

    // Main body hitbox (capsule-like shape using cylinder + spheres)
    const bodyHitbox = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8),
        hitboxMaterial
    );
    bodyHitbox.position.y = 1.2;
    bodyHitbox.userData.isHitbox = true;
    zombie.add(bodyHitbox);

    // Head hitbox
    const headHitbox = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 8, 8),
        hitboxMaterial
    );
    headHitbox.position.y = 2.3;
    headHitbox.userData.isHitbox = true;
    headHitbox.userData.isHeadshot = true;  // For potential headshot bonus
    zombie.add(headHitbox);

    // Spawn position (random around player, avoiding collisions)
    zombie.position.copy(getZombieSpawnPosition(0.5));

    // Collect hitbox meshes for raycasting
    const hitMeshes = [];
    zombie.traverse((child) => {
        if (child.isMesh && child.userData.isHitbox) {
            child.userData.zombieRoot = zombie;
            hitMeshes.push(child);
        }
    });

    zombie.userData = {
        isZombieRoot: true,
        health: 1,
        damage: 20,
        stopRange: 1.0,
        minRange: 0,
        collisionRadius: 0.1,
        attackCooldown: 0,
        hitMeshes,
        lastPosition: zombie.position.clone(),
        lastMoveTime: performance.now(),
        velocity: new THREE.Vector3()
    };

    // Initialize the enhanced AI system
    zombie.userData.ai = initZombieAI(zombie);

    // Set speed and force based on AI type
    const ai = zombie.userData.ai;
    zombie.userData.speed = ai.baseSpeed;
    zombie.userData.maxForce = ai.baseSpeed * 0.6;

    // Brutes have more health
    if (ai.type === ZombieType.BRUTE) {
        zombie.userData.health = 3;
        zombie.userData.damage = 35;
    }

    if (zombieModel && zombieClips.length > 0) {
        const zombieInstance = zombie.children[0];
        const mixer = new THREE.AnimationMixer(zombieInstance);
        zombieClips.forEach((clip) => {
            const action = mixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat);
            action.play();
        });
        zombie.userData.mixer = mixer;
    }

    scene.add(zombie);
    zombies.push(zombie);
    gameState.zombiesSpawned++;
}

// findZombieRoot is kept as a fallback for hit detection

function findZombieRoot(object) {
    let current = object;
    while (current) {
        if (current.userData?.isZombieRoot) {
            return current;
        }
        current = current.parent;
    }
    return null;
}

function updateZombies(delta) {
    const now = performance.now();
    const frameScale = delta * 60;

    zombies.forEach((zombie, index) => {
        if (!zombie.userData) return;

        if (!zombie.userData.velocity) {
            zombie.userData.velocity = new THREE.Vector3();
        }

        // Update AI state machine
        if (zombie.userData.ai) {
            updateZombieState(zombie, delta, now);
        }

        // Calculate direction based on AI state
        const toPlayer = new THREE.Vector3();
        toPlayer.subVectors(player.position, zombie.position);
        toPlayer.y = 0;
        const horizontalDistance = Math.hypot(toPlayer.x, toPlayer.z);
        const toPlayerDirection = horizontalDistance > 0.0001 ? toPlayer.clone().normalize() : new THREE.Vector3();
        const direction = getZombieMoveDirection(zombie);

        const stopRange = zombie.userData.stopRange ?? 1.0;
        const minRange = zombie.userData.minRange ?? 0;
        const baseSpeed = zombie.userData.speed ?? 0.03;

        // Apply speed multiplier from AI state
        const speedMultiplier = getZombieSpeedMultiplier(zombie);
        const maxSpeed = baseSpeed * speedMultiplier;
        const maxForce = zombie.userData.maxForce ?? baseSpeed * 0.6;

        let desiredVelocity = new THREE.Vector3();

        // Different attack behavior based on AI state
        const ai = zombie.userData.ai;
        const isAttacking = ai ? ai.state === ZombieState.ATTACKING : horizontalDistance <= stopRange;

        if (!isAttacking && direction.lengthSq() > 0.0001) {
            desiredVelocity = direction.clone().multiplyScalar(maxSpeed);
        } else if (isAttacking) {
            // Attack player
            if (zombie.userData.attackCooldown <= 0 && horizontalDistance <= stopRange + 0.5) {
                // Attack windup for more telegraphed attacks
                if (ai) {
                    ai.attackWindup = (ai.attackWindup || 0) + delta * 1000;
                    if (ai.attackWindup >= 300) { // 300ms windup
                        takeDamage(zombie.userData.damage);
                        zombie.userData.attackCooldown = 60;
                        ai.attackWindup = 0;
                    }
                } else {
                    takeDamage(zombie.userData.damage);
                    zombie.userData.attackCooldown = 60;
                }
            }
            if (horizontalDistance < minRange) {
                desiredVelocity = toPlayerDirection.clone().multiplyScalar(-maxSpeed * 0.3);
            }
        }

        // Smooth arrival behavior
        const arrivalRadius = 3.5;
        if (horizontalDistance < arrivalRadius && horizontalDistance > stopRange && !isAttacking) {
            const rampedSpeed = maxSpeed * (horizontalDistance / arrivalRadius);
            if (direction.lengthSq() > 0.0001) {
                desiredVelocity = direction.clone().normalize().multiplyScalar(rampedSpeed);
            }
        }

        let steering = desiredVelocity.clone().sub(zombie.userData.velocity).clampLength(0, maxForce);

        // Obstacle avoidance (only for non-climbable objects like buildings and lampposts)
        const origin = zombie.position.clone().add(new THREE.Vector3(0, 1, 0));
        const lookAhead = 3 + maxSpeed * 25;

        // Only do obstacle avoidance if actively moving
        if (direction.lengthSq() > 0.0001) {
            const moveDir = direction.clone().normalize();
            const pathBlocked = getZombieClearDistance(origin, moveDir, lookAhead) < lookAhead * 0.7;

            if (pathBlocked) {
                const left = new THREE.Vector3(-moveDir.z, 0, moveDir.x).normalize();
                const right = new THREE.Vector3(moveDir.z, 0, -moveDir.x).normalize();
                const sideProbeDistance = Math.max(2.5, lookAhead * 0.6);
                const leftClear = getZombieClearDistance(origin, left, sideProbeDistance);
                const rightClear = getZombieClearDistance(origin, right, sideProbeDistance);

                if (!zombie.userData.avoidSide || Math.abs(leftClear - rightClear) > 0.2) {
                    zombie.userData.avoidSide = leftClear >= rightClear ? -1 : 1;
                }
                const avoidDirection = zombie.userData.avoidSide === -1 ? left : right;
                const avoidDesired = avoidDirection.multiplyScalar(maxSpeed);
                steering = avoidDesired.sub(zombie.userData.velocity).clampLength(0, maxForce * 1.4);
            } else {
                zombie.userData.avoidSide = null;
            }
        }

        // Separation from other zombies (enhanced for pack behavior)
        const separation = new THREE.Vector3();
        const separationRadius = (zombie.userData.collisionRadius ?? 0.7) * 2.5;
        const alignment = new THREE.Vector3();
        let neighborCount = 0;

        zombies.forEach((other) => {
            if (other === zombie) return;
            const offset = zombie.position.clone().sub(other.position);
            offset.y = 0;
            const distance = offset.length();

            if (distance > 0.0001 && distance < separationRadius) {
                // Separation force
                separation.add(offset.normalize().multiplyScalar((separationRadius - distance) / separationRadius));
            }

            // Alignment for pack behavior (only for pursuing zombies)
            if (distance < 6 && ai && ai.state === ZombieState.PURSUING && other.userData?.ai?.state === ZombieState.PURSUING) {
                if (other.userData.velocity) {
                    alignment.add(other.userData.velocity);
                    neighborCount++;
                }
            }
        });

        if (separation.lengthSq() > 0.0001) {
            const separationDesired = separation.normalize().multiplyScalar(maxSpeed);
            const separationSteering = separationDesired.sub(zombie.userData.velocity).clampLength(0, maxForce * 0.9);
            steering.add(separationSteering);
        }

        // Apply slight alignment for horde feel
        if (neighborCount > 0 && ai && ai.type !== ZombieType.STALKER) {
            alignment.divideScalar(neighborCount);
            const alignmentSteering = alignment.clone().sub(zombie.userData.velocity).clampLength(0, maxForce * 0.2);
            steering.add(alignmentSteering);
        }

        // Apply steering
        zombie.userData.velocity.add(steering.multiplyScalar(frameScale));
        if (zombie.userData.velocity.length() > maxSpeed) {
            zombie.userData.velocity.setLength(maxSpeed);
        }

        // Move with collisions (zombies can walk over debris)
        const moveDelta = zombie.userData.velocity.clone().multiplyScalar(frameScale);
        const previousPosition = zombie.position.clone();
        moveZombieWithCollisions(zombie.position, moveDelta, zombie.userData.collisionRadius ?? 0.7);

        // Adjust zombie height for climbing over debris and cars
        const climbHeight = getClimbableHeightAt(zombie.position, zombie.userData.collisionRadius ?? 0.7);
        const targetY = climbHeight;
        const currentY = zombie.position.y;

        // Smoothly interpolate Y position for climbing/descending
        if (Math.abs(targetY - currentY) > 0.01) {
            const climbSpeed = 0.15;  // How fast zombies climb
            if (targetY > currentY) {
                zombie.position.y = Math.min(targetY, currentY + climbSpeed);
            } else {
                zombie.position.y = Math.max(targetY, currentY - climbSpeed * 0.5);  // Descend slower
            }
        } else {
            zombie.position.y = targetY;
        }

        if (zombie.position.distanceToSquared(previousPosition) < 0.000001) {
            zombie.userData.velocity.set(0, 0, 0);
        }

        // Face direction of movement or player
        if (ai && (ai.state === ZombieState.IDLE || ai.state === ZombieState.ALERTED)) {
            // Idle/alert: slowly turn towards movement or interest
            if (ai.wanderTarget && ai.state === ZombieState.IDLE) {
                const targetLook = ai.wanderTarget.clone();
                targetLook.y = zombie.position.y;
                zombie.lookAt(targetLook);
            } else if (ai.lastKnownPlayerPos) {
                zombie.lookAt(ai.lastKnownPlayerPos.x, zombie.position.y, ai.lastKnownPlayerPos.z);
            }
        } else {
            // Active states: face player
            zombie.lookAt(player.position.x, zombie.position.y, player.position.z);
        }

        if (zombie.userData.attackCooldown > 0) {
            zombie.userData.attackCooldown--;
        }

        // Teleport stuck zombies after timeout
        if (!zombie.userData.lastPosition) {
            zombie.userData.lastPosition = zombie.position.clone();
            zombie.userData.lastMoveTime = now;
        } else {
            const movementDistance = zombie.position.distanceTo(zombie.userData.lastPosition);
            if (movementDistance > 0.05) {
                zombie.userData.lastPosition.copy(zombie.position);
                zombie.userData.lastMoveTime = now;
            } else if (now - zombie.userData.lastMoveTime > 10000) {
                // Respawn stuck zombie
                zombie.position.copy(getZombieSpawnPosition(0.5));
                zombie.userData.lastPosition.copy(zombie.position);
                zombie.userData.lastMoveTime = now;
                zombie.userData.attackCooldown = 0;
                zombie.userData.velocity.set(0, 0, 0);
                if (ai) {
                    ai.state = ZombieState.IDLE;
                    ai.lastKnownPlayerPos = null;
                }
            }
        }
    });
}

function shoot() {
    const now = performance.now();
    if (now - gameState.lastShotTime < 300) return;
    if (gameState.ammo <= 0 || gameState.isReloading) return;

    gameState.ammo--;
    gameState.shotsFired++;
    gameState.lastShotTime = now;
    updateAmmoDisplay();

    // Muzzle flash
    const muzzleFlash = document.getElementById('muzzle-flash');
    updateMuzzleFlashPosition();
    muzzleFlash.style.opacity = '1';
    setTimeout(() => muzzleFlash.style.opacity = '0', 50);

    playGunshot();

    // Gun recoil animation
    if (gunModel) {
        gunModel.position.z = gunBasePosition.z + 0.08;
        setTimeout(() => {
            gunModel.position.z = gunBasePosition.z;
        }, 100);
    }

    // Raycasting for hit detection
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // Check zombie hits using hitbox meshes
    const zombieMeshes = zombies.flatMap((z) => z.userData?.hitMeshes ?? []);
    const zombieIntersects = raycaster.intersectObjects(zombieMeshes, false);
    const environmentIntersects = raycaster.intersectObjects(collisionObjects, true);

    const nearestZombieHit = zombieIntersects[0];
    const nearestEnvironmentHit = environmentIntersects[0];

    if (nearestEnvironmentHit && (!nearestZombieHit || nearestEnvironmentHit.distance <= nearestZombieHit.distance)) {
        createBulletDecal(nearestEnvironmentHit);
    } else if (nearestZombieHit) {
        const hitObject = nearestZombieHit.object;
        const zombie = hitObject.userData.zombieRoot ?? findZombieRoot(hitObject);

        if (zombie?.userData) {
            // Check for headshot bonus
            const isHeadshot = hitObject.userData.isHeadshot;
            const damage = isHeadshot ? 50 : 25;  // Double damage for headshots
            
            zombie.userData.health -= damage;
            showHitMarker();
            gameState.shotsHit++;
            
            // Apply stun effect (longer for headshots)
            if (zombie.userData.health > 0) {
                stunZombie(zombie, isHeadshot ? 500 : 200);
            }

            // Blood effect at hit point
            createBloodEffect(nearestZombieHit.point);

            if (zombie.userData.health <= 0) {
                killZombie(zombie);
            }
        }
    }

    // Alert nearby zombies to the gunshot sound
    const gunshotAlertRange = 30;
    zombies.forEach((zombie) => {
        if (!zombie.userData?.ai) return;
        const ai = zombie.userData.ai;
        const distance = zombie.position.distanceTo(player.position);

        if (distance < gunshotAlertRange && ai.state === ZombieState.IDLE) {
            ai.state = ZombieState.ALERTED;
            ai.stateTimer = 300 + Math.random() * 400;
            ai.lastKnownPlayerPos = player.position.clone();
            ai.lastSeenTime = performance.now();
        }
    });

    // Create bullet tracer
    createBulletTracer(raycaster);

    // Auto reload if empty
    if (gameState.ammo <= 0 && gameState.reserveAmmo > 0) {
        reload();
    }
}

function createBulletTracer(raycaster) {
    const tracerLength = 30;
    const tracerGeometry = new THREE.BufferGeometry().setFromPoints([
        camera.position.clone(),
        raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(tracerLength))
    ]);
    const tracerMaterial = new THREE.LineBasicMaterial({
        color: 0xffcc66,
        transparent: true,
        opacity: 0.8
    });
    const tracer = new THREE.Line(tracerGeometry, tracerMaterial);
    scene.add(tracer);

    setTimeout(() => {
        tracerMaterial.opacity = 0.15;
    }, 40);
    setTimeout(() => scene.remove(tracer), 90);
}

function createBulletDecal(hit) {
    if (!hit?.point) return;
    if (!decalTexture) {
        decalTexture = new THREE.TextureLoader().load(DECAL_TEXTURE_URL);
    }
    const decalSize = 0.35 / 3;
    const decalGeometry = new THREE.PlaneGeometry(decalSize, decalSize);
    const decalMaterial = new THREE.MeshBasicMaterial({
        map: decalTexture,
        transparent: true,
        opacity: 0.85
    });
    const decal = new THREE.Mesh(decalGeometry, decalMaterial);
    decal.position.copy(hit.point);
    if (hit.face?.normal) {
        const target = hit.face.normal.clone().normalize();
        if (hit.object) {
            target.transformDirection(hit.object.matrixWorld);
        }
        decal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), target);
        decal.position.add(target.clone().multiplyScalar(0.02));
    }
    scene.add(decal);
    bulletDecals.push(decal);
    if (bulletDecals.length > 10) {
        const oldest = bulletDecals.shift();
        if (oldest) {
            scene.remove(oldest);
            oldest.geometry.dispose();
            oldest.material.dispose();
        }
    }
}

function createBloodEffect(position) {
    const particles = [];
    for (let i = 0; i < 10; i++) {
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.05),
            new THREE.MeshBasicMaterial({ color: 0x880000 })
        );
        particle.position.copy(position);
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.2,
            (Math.random() - 0.5) * 0.2
        );
        scene.add(particle);
        particles.push(particle);
    }

    // Animate and remove
    let frames = 0;
    const animateBlood = () => {
        frames++;
        particles.forEach((p) => {
            p.position.add(p.userData.velocity);
            p.userData.velocity.y -= 0.01;
        });

        if (frames < 30) {
            requestAnimationFrame(animateBlood);
        } else {
            particles.forEach((p) => scene.remove(p));
        }
    };
    animateBlood();
}

function showHitMarker() {
    const hitMarker = document.getElementById('hit-marker');
    hitMarker.style.opacity = '1';
    setTimeout(() => hitMarker.style.opacity = '0', 100);
}

function killZombie(zombie) {
    const index = zombies.indexOf(zombie);
    if (index > -1) {
        zombies.splice(index, 1);
        scene.remove(zombie);
        createGibEffect(zombie.position);

        gameState.kills++;
        gameState.score += 100;
        gameState.zombiesKilled++;

        updateHUD();
        addKillNotification();

        // Check wave completion
        if (gameState.zombiesKilled >= gameState.zombiesInWave) {
            nextWave();
        }
    }
}

function createGibEffect(position) {
    const chunks = [];
    for (let i = 0; i < 36; i++) {
        const chunk = new THREE.Mesh(
            new THREE.BoxGeometry(0.105, 0.105, 0.105),
            new THREE.MeshStandardMaterial({ color: 0x7a1a1a, roughness: 0.8 })
        );
        chunk.position.copy(position);
        chunk.position.y += 0.6 + Math.random() * 0.6;
        chunk.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.175,
            Math.random() * 0.175 + 0.075,
            (Math.random() - 0.5) * 0.175
        );
        chunk.userData.bounces = 2;
        scene.add(chunk);
        chunks.push(chunk);
    }

    let frames = 0;
    const animateGibs = () => {
        frames++;
        chunks.forEach((chunk) => {
            chunk.position.add(chunk.userData.velocity);
            chunk.userData.velocity.y -= 0.02;
            if (chunk.position.y <= 0.2 && chunk.userData.bounces > 0) {
                chunk.position.y = 0.2;
                chunk.userData.velocity.y *= -0.45;
                chunk.userData.velocity.x *= 0.6;
                chunk.userData.velocity.z *= 0.6;
                chunk.userData.bounces -= 1;
            }
        });

        if (frames < 140) {
            requestAnimationFrame(animateGibs);
        } else {
            chunks.forEach((chunk) => scene.remove(chunk));
        }
    };
    animateGibs();
}

function addKillNotification() {
    const killFeed = document.getElementById('kill-feed');
    const notification = document.createElement('div');
    notification.className = 'kill-notification';
    notification.textContent = '+100 ZOMBIE KILLED';
    killFeed.appendChild(notification);

    setTimeout(() => notification.remove(), 2000);
}

function nextWave() {
    scheduleWaveStart(gameState.wave + 1, 5);
}

function showWaveBanner() {
    const waveBanner = document.getElementById('wave-banner');
    if (!waveBanner) return;
    waveBanner.textContent = `WAVE ${gameState.wave}`;
    waveBanner.classList.remove('show');
    void waveBanner.offsetWidth;
    waveBanner.classList.add('show');
}

function startWave() {
    gameState.zombiesInWave = (5 + gameState.wave * 3) * 4;
    gameState.zombiesSpawned = 0;
    gameState.zombiesKilled = 0;
    updateHUD();
    playWaveSound();
    showWaveBanner();
    spawnTimer = 0;

    // Wave announcement effect
    const waveNumber = document.getElementById('wave-number');
    waveNumber.style.transform = 'scale(1.5)';
    waveNumber.style.transition = 'transform 0.3s ease';
    setTimeout(() => {
        waveNumber.style.transform = 'scale(1)';
    }, 300);
}

function scheduleWaveStart(waveNumber, delaySeconds) {
    wavePending = true;
    waveDelayTimer = delaySeconds;
    pendingWaveNumber = waveNumber;
    spawnTimer = 0;
}

function reload() {
    if (gameState.isReloading || gameState.ammo === gameState.maxAmmo) return;

    gameState.isReloading = true;
    gameState.reloadStartTime = performance.now();
    document.getElementById('reload-indicator').style.opacity = '1';

    setTimeout(() => {
        const needed = gameState.maxAmmo - gameState.ammo;
        gameState.ammo += needed;
        gameState.isReloading = false;

        document.getElementById('reload-indicator').style.opacity = '0';
        updateAmmoDisplay();
    }, gameState.reloadDuration);
}

function takeDamage(amount) {
    gameState.health = Math.max(0, gameState.health - amount);
    gameState.damageFlash = Math.min(1, gameState.damageFlash + 0.6);
    playHurtSound();

    updateHealthDisplay();

    if (gameState.health <= 0) {
        gameOver();
    }
}

function gameOver() {
    gameState.isPlaying = false;
    document.exitPointerLock();

    document.getElementById('final-wave').textContent = gameState.wave;
    document.getElementById('final-kills').textContent = gameState.kills;
    const accuracy = gameState.shotsFired > 0
        ? Math.round((gameState.shotsHit / gameState.shotsFired) * 100)
        : 0;
    document.getElementById('final-accuracy').textContent = `${accuracy}%`;
    document.getElementById('game-over').style.display = 'flex';
}

function resetGame() {
    gameState.health = 100;
    gameState.score = 0;
    gameState.kills = 0;
    gameState.wave = 1;
    gameState.ammo = 30;
    gameState.reserveAmmo = Infinity;
    gameState.isReloading = false;
    gameState.reloadStartTime = 0;
    gameState.lastShotTime = 0;
    gameState.shotsFired = 0;
    gameState.shotsHit = 0;
    gameState.zombiesInWave = 20;
    gameState.zombiesSpawned = 0;
    gameState.zombiesKilled = 0;
    gameState.damageFlash = 0;

    // Remove all zombies
    zombies.forEach((z) => scene.remove(z));
    zombies = [];

    // Reset player position
    player.position.set(0, 2, 0);

    updateHUD();
}

function updateHUD() {
    document.getElementById('score-value').textContent = gameState.score;
    document.getElementById('kills-value').textContent = gameState.kills;
    document.getElementById('wave-number').textContent = gameState.wave;
    updateAmmoDisplay();
}

function updateHealthDisplay() {
    const healthValue = document.getElementById('health-value');
    if (healthValue) {
        healthValue.textContent = Math.max(0, gameState.health);
    }
}

function updateAmmoDisplay() {
    document.getElementById('ammo-current').textContent = gameState.ammo;
    document.getElementById('ammo-reserve').textContent = Number.isFinite(gameState.reserveAmmo)
        ? gameState.reserveAmmo
        : '∞';
}

function setupEventListeners() {
    // Start game
    document.getElementById('start-screen').addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        gameState.isPlaying = true;
        document.body.requestPointerLock();
        scheduleWaveStart(gameState.wave, 1);
    });

    // Restart game
    document.getElementById('game-over').addEventListener('click', () => {
        document.getElementById('game-over').style.display = 'none';
        resetGame();
        gameState.isPlaying = true;
        document.body.requestPointerLock();
        scheduleWaveStart(gameState.wave, 1);
    });

    // Mouse look
    document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement && gameState.isPlaying) {
            player.rotation.y -= e.movementX * 0.002;
            player.rotation.x -= e.movementY * 0.002;
            player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.rotation.x));
        }
    });

    // Shooting
    document.addEventListener('mousedown', (e) => {
        if (e.button === 0 && gameState.isPlaying && document.pointerLockElement) {
            shoot();
        }
        if (e.button === 2 && gameState.isPlaying) {
            gameState.isAiming = true;
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 2) {
            gameState.isAiming = false;
        }
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;

        if (e.code === 'KeyR' && gameState.isPlaying) {
            reload();
        }
        if (e.code === 'ShiftLeft') {
            gameState.isSprinting = true;
        }
        if (e.code === 'Space' && gameState.isPlaying && !player.jumpQueued) {
            player.jumpQueued = true;
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;

        if (e.code === 'ShiftLeft') {
            gameState.isSprinting = false;
        }
    });

    // Pointer lock change
    document.addEventListener('pointerlockchange', () => {
        if (!document.pointerLockElement && gameState.isPlaying && gameState.health > 0) {
            // Paused - could add pause menu
        }
    });

    // Window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function updatePlayer() {
    if (!gameState.isPlaying) return;

    const speed = gameState.isSprinting ? player.sprintSpeed : player.speed;
    const groundY = 2;
    const gravity = 0.012;
    const jumpStrength = 0.22;

    // Movement
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const move = new THREE.Vector3();

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    if (keys['KeyW']) move.add(forward);
    if (keys['KeyS']) move.add(forward.clone().multiplyScalar(-1));
    if (keys['KeyA']) move.add(right.clone().multiplyScalar(-1));
    if (keys['KeyD']) move.add(right);

    if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed);
        moveWithCollisions(player.position, move, player.collisionRadius);
    }

    if (player.jumpQueued && player.isOnGround) {
        player.verticalVelocity = jumpStrength;
        player.isOnGround = false;
        player.jumpQueued = false;
    } else if (player.jumpQueued && !player.isOnGround) {
        player.jumpQueued = false;
    }

    if (!player.isOnGround) {
        player.verticalVelocity -= gravity;
        player.position.y += player.verticalVelocity;
        if (player.position.y <= groundY) {
            player.position.y = groundY;
            player.verticalVelocity = 0;
            player.isOnGround = true;
        }
    }

    // Boundary check
    player.position.x = Math.max(-40, Math.min(40, player.position.x));
    player.position.z = Math.max(-40, Math.min(40, player.position.z));

    // Update camera
    camera.position.copy(player.position);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.rotation.y;
    camera.rotation.x = player.rotation.x;
}

let spawnTimer = 0;
let waveDelayTimer = 0;
let wavePending = false;
let pendingWaveNumber = null;

function animate() {
    requestAnimationFrame(animate);
    const delta = animationClock.getDelta();

    if (gameState.isPlaying) {
        updatePlayer();
        updateZombies(delta);
        zombies.forEach((zombie) => {
            if (zombie.userData?.mixer) {
                zombie.userData.mixer.update(delta);
            }
        });

        if (wavePending) {
            waveDelayTimer = Math.max(0, waveDelayTimer - delta);
            if (waveDelayTimer <= 0) {
                wavePending = false;
                if (pendingWaveNumber !== null) {
                    gameState.wave = pendingWaveNumber;
                    pendingWaveNumber = null;
                }
                startWave();
            }
        }

        const targetFov = gameState.isAiming ? AIM_FOV : BASE_FOV;
        if (Math.abs(camera.fov - targetFov) > 0.01) {
            camera.fov += (targetFov - camera.fov) * 0.12;
            camera.updateProjectionMatrix();
        }
        if (gunModel) {
            const targetGunPosition = gameState.isAiming ? gunAimPosition : gunBasePosition;
            gunModel.position.lerp(targetGunPosition, 0.18);
            if (gameState.isReloading) {
                const elapsed = performance.now() - gameState.reloadStartTime;
                const progress = Math.min(1, Math.max(0, elapsed / gameState.reloadDuration));
                let swing;
                if (progress <= 0.6) {
                    swing = Math.sin((progress / 0.6) * (Math.PI / 2));
                } else {
                    const snapProgress = Math.min(1, ((progress - 0.6) / 0.4) * 3);
                    swing = 1 - Math.pow(snapProgress, 2);
                }
                gunModel.rotation.x = gunBaseRotation.x + 0.35 * swing;
                gunModel.rotation.y = gunBaseRotation.y + 0.15 * swing;
                gunModel.rotation.z = gunBaseRotation.z - 0.6 * swing;
                gunModel.position.y -= 0.08 * swing;
                gunModel.position.z -= 0.04 * swing;
            } else {
                gunModel.rotation.copy(gunBaseRotation);
            }
        }

        if (gameState.health < gameState.maxHealth) {
            gameState.health = Math.min(
                gameState.maxHealth,
                gameState.health + gameState.regenRate * delta
            );
        }
        if (gameState.damageFlash > 0) {
            gameState.damageFlash = Math.max(0, gameState.damageFlash - delta * 1.5);
        }
        const overlay = document.getElementById('damage-overlay');
        const healthRatio = gameState.health / gameState.maxHealth;
        const baseTint = Math.pow(1 - healthRatio, 0.55) * 1.3;
        const flashTint = gameState.damageFlash * 0.75;
        const redIntensity = Math.min(1, 0.35 + (1 - healthRatio) * 0.65 + gameState.damageFlash * 0.2);
        overlay.style.setProperty('--damage-red', redIntensity.toFixed(3));
        overlay.style.opacity = Math.min(1, baseTint + flashTint).toFixed(3);
        updateHealthDisplay();

        // Spawn zombies periodically
        if (!wavePending) {
            spawnTimer++;
        }
        if (!wavePending && spawnTimer >= 120 && gameState.zombiesSpawned < gameState.zombiesInWave) {
            spawnZombie();
            spawnTimer = 0;
        }
    }

    renderer.render(scene, camera);
}

// Initialize game
init();
