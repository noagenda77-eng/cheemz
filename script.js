// Game state
const gameState = {
    health: 100,
    maxHealth: 100,
    score: 0,
    kills: 0,
    wave: 1,
    ammo: 30,
    maxAmmo: 30,
    reserveAmmo: 120,
    isReloading: false,
    isPlaying: false,
    isSprinting: false,
    zombiesInWave: 5,
    zombiesSpawned: 0,
    zombiesKilled: 0
};

// Player state
const player = {
    position: new THREE.Vector3(0, 2, 0),
    velocity: new THREE.Vector3(),
    rotation: { x: 0, y: 0 },
    speed: 0.15,
    sprintSpeed: 0.25
};

// Input state
const keys = {};
const mouse = { x: 0, y: 0 };

// Three.js setup
let scene, camera, renderer;
let zombies = [];
let bullets = [];
let buildings = [];
let zombieModel = null;
let zombieClips = [];
let flashlight = null;
let flashlightTarget = null;
let gunModel = null;
let weaponRig = null;
let muzzleMesh = null;
let gunshotAudio = null;
const gunBasePosition = new THREE.Vector3();
const animationClock = new THREE.Clock();

const ZOMBIE_MODEL_URL = 'assets/zombie.glb';
const ZOMBIE_SCALE = 1.2;

// Initialize Three.js
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a15);
    scene.fog = new THREE.FogExp2(0x0a0a15, 0.02);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
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

    weaponRig.add(gunModel);
}

function setupAudio() {
    gunshotAudio = new Audio('assets/gunshot.mp3');
    gunshotAudio.volume = 0.5;
}

function playGunshot() {
    if (!gunshotAudio) return;
    gunshotAudio.currentTime = 0;
    gunshotAudio.play().catch(() => {});
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
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Wet street effect
    const streetGeometry = new THREE.PlaneGeometry(15, 100);
    const streetMaterial = new THREE.MeshStandardMaterial({
        color: 0x222233,
        roughness: 0.3,
        metalness: 0.4
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
    // Destroyed cars
    const carMaterial = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.6 });

    for (let i = 0; i < 8; i++) {
        const car = new THREE.Group();

        // Car body
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(2, 1, 4),
            carMaterial
        );
        body.position.y = 0.7;
        car.add(body);

        // Car roof
        const roof = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 0.8, 2),
            carMaterial
        );
        roof.position.y = 1.5;
        roof.position.z = -0.3;
        car.add(roof);

        // Random positioning
        car.position.set(
            -15 + Math.random() * 30,
            0,
            -30 + Math.random() * 50
        );
        car.rotation.y = Math.random() * Math.PI;

        // Some cars are flipped or tilted
        if (Math.random() > 0.7) {
            car.rotation.z = Math.random() * 0.5;
        }

        scene.add(car);
    }

    // Rubble piles
    const rubbleMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 });

    for (let i = 0; i < 20; i++) {
        const rubble = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.5 + Math.random()),
            rubbleMaterial
        );
        rubble.position.set(
            -30 + Math.random() * 60,
            0.3,
            -40 + Math.random() * 60
        );
        rubble.rotation.set(Math.random(), Math.random(), Math.random());
        scene.add(rubble);
    }

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

        // Lamp head
        const lampHead = new THREE.Mesh(
            new THREE.SphereGeometry(0.3),
            new THREE.MeshBasicMaterial({ color: 0xffaa44 })
        );
        lampHead.position.set(pole.position.x, 8, pole.position.z);
        scene.add(lampHead);
    }
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
            }
        });
    } else {
        zombie = new THREE.Group();

        // Body (placeholder - cylinder)
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a5a3a,
            roughness: 0.8
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
            new THREE.MeshStandardMaterial({ color: 0x4a6a4a })
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

    // Spawn position (random around player)
    const angle = Math.random() * Math.PI * 2;
    const distance = 25 + Math.random() * 15;
    zombie.position.set(
        player.position.x + Math.cos(angle) * distance,
        0,
        player.position.z + Math.sin(angle) * distance
    );

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
        speed: 0.03 + gameState.wave * 0.005,
        damage: 10 + gameState.wave * 2,
        attackCooldown: 0,
        hitMeshes
    };
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

function updateZombies() {
    zombies.forEach((zombie) => {
        if (!zombie.userData) return;

        // Move towards player
        const direction = new THREE.Vector3();
        direction.subVectors(player.position, zombie.position);
        direction.y = 0;
        direction.normalize();

        // Face player
        zombie.lookAt(player.position.x, zombie.position.y, player.position.z);

        const distanceToPlayer = zombie.position.distanceTo(player.position);

        if (distanceToPlayer > 2) {
            zombie.position.add(direction.multiplyScalar(zombie.userData.speed));
        } else {
            // Attack player
            if (zombie.userData.attackCooldown <= 0) {
                takeDamage(zombie.userData.damage);
                zombie.userData.attackCooldown = 60;
            }
        }

        if (zombie.userData.attackCooldown > 0) {
            zombie.userData.attackCooldown--;
        }
    });
}

function shoot() {
    if (gameState.ammo <= 0 || gameState.isReloading) return;

    gameState.ammo--;
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
    const intersects = raycaster.intersectObjects(zombieMeshes, false);

    if (intersects.length > 0) {
        const hitObject = intersects[0].object;
        const zombie = hitObject.userData.zombieRoot ?? findZombieRoot(hitObject);

        if (zombie?.userData) {
            // Check for headshot bonus
            const isHeadshot = hitObject.userData.isHeadshot;
            const damage = isHeadshot ? 50 : 25;  // Double damage for headshots
            
            zombie.userData.health -= damage;
            showHitMarker();

            // Blood effect at hit point
            createBloodEffect(intersects[0].point);

            if (zombie.userData.health <= 0) {
                killZombie(zombie);
            }
        }
    }

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
            new THREE.BoxGeometry(0.42, 0.42, 0.42),
            new THREE.MeshStandardMaterial({ color: 0x7a1a1a, roughness: 0.8 })
        );
        chunk.position.copy(position);
        chunk.position.y += 0.6 + Math.random() * 0.6;
        chunk.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.35,
            Math.random() * 0.35 + 0.15,
            (Math.random() - 0.5) * 0.35
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

        if (frames < 70) {
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
    gameState.wave++;
    gameState.zombiesInWave = 5 + gameState.wave * 3;
    gameState.zombiesSpawned = 0;
    gameState.zombiesKilled = 0;

    // Bonus ammo
    gameState.reserveAmmo += 30;

    updateHUD();

    // Wave announcement effect
    const waveNumber = document.getElementById('wave-number');
    waveNumber.style.transform = 'scale(1.5)';
    waveNumber.style.transition = 'transform 0.3s ease';
    setTimeout(() => {
        waveNumber.style.transform = 'scale(1)';
    }, 300);
}

function reload() {
    if (gameState.isReloading || gameState.reserveAmmo <= 0 || gameState.ammo === gameState.maxAmmo) return;

    gameState.isReloading = true;
    document.getElementById('reload-indicator').style.opacity = '1';

    setTimeout(() => {
        const needed = gameState.maxAmmo - gameState.ammo;
        const toReload = Math.min(needed, gameState.reserveAmmo);

        gameState.ammo += toReload;
        gameState.reserveAmmo -= toReload;
        gameState.isReloading = false;

        document.getElementById('reload-indicator').style.opacity = '0';
        updateAmmoDisplay();
    }, 2000);
}

function takeDamage(amount) {
    gameState.health -= amount;

    // Damage overlay flash
    const overlay = document.getElementById('damage-overlay');
    overlay.style.opacity = '0.8';
    setTimeout(() => overlay.style.opacity = '0', 200);

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
    document.getElementById('game-over').style.display = 'flex';
}

function resetGame() {
    gameState.health = 100;
    gameState.score = 0;
    gameState.kills = 0;
    gameState.wave = 1;
    gameState.ammo = 30;
    gameState.reserveAmmo = 120;
    gameState.isReloading = false;
    gameState.zombiesInWave = 5;
    gameState.zombiesSpawned = 0;
    gameState.zombiesKilled = 0;

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
    updateHealthDisplay();
    updateAmmoDisplay();
}

function updateHealthDisplay() {
    document.getElementById('health-value').textContent = Math.max(0, gameState.health);
    document.getElementById('health-bar').style.width = Math.max(0, gameState.health) + '%';
}

function updateAmmoDisplay() {
    document.getElementById('ammo-current').textContent = gameState.ammo;
    document.getElementById('ammo-reserve').textContent = gameState.reserveAmmo;
}

function setupEventListeners() {
    // Start game
    document.getElementById('start-screen').addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        gameState.isPlaying = true;
        document.body.requestPointerLock();
    });

    // Restart game
    document.getElementById('game-over').addEventListener('click', () => {
        document.getElementById('game-over').style.display = 'none';
        resetGame();
        gameState.isPlaying = true;
        document.body.requestPointerLock();
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
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;

        if (e.code === 'KeyR' && gameState.isPlaying) {
            reload();
        }
        if (e.code === 'ShiftLeft') {
            gameState.isSprinting = true;
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

    // Movement
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

    if (keys['KeyW']) player.position.add(forward.clone().multiplyScalar(speed));
    if (keys['KeyS']) player.position.add(forward.clone().multiplyScalar(-speed));
    if (keys['KeyA']) player.position.add(right.clone().multiplyScalar(-speed));
    if (keys['KeyD']) player.position.add(right.clone().multiplyScalar(speed));

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

function animate() {
    requestAnimationFrame(animate);
    const delta = animationClock.getDelta();

    if (gameState.isPlaying) {
        updatePlayer();
        updateZombies();
        zombies.forEach((zombie) => {
            if (zombie.userData?.mixer) {
                zombie.userData.mixer.update(delta);
            }
        });

        // Spawn zombies periodically
        spawnTimer++;
        if (spawnTimer >= 120 && gameState.zombiesSpawned < gameState.zombiesInWave) {
            spawnZombie();
            spawnTimer = 0;
        }
    }

    renderer.render(scene, camera);
}

// Initialize game
init();
