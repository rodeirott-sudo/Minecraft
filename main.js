import * as THREE from "https://esm.sh/three@0.164.1";
import { PointerLockControls } from "https://esm.sh/three@0.164.1/examples/jsm/controls/PointerLockControls.js";
import { Sky } from "https://esm.sh/three@0.164.1/examples/jsm/objects/Sky.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fd7ff);
scene.fog = new THREE.Fog(0x9fd7ff, 35, 180);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);
camera.position.set(0, 5, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.HemisphereLight(0xbde0ff, 0x3e5131, 0.6);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xfff3cf, 1.35);
sun.position.set(45, 65, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -65;
sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65;
sun.shadow.camera.bottom = -65;
scene.add(sun);

const fillLight = new THREE.DirectionalLight(0x9ad0ff, 0.25);
fillLight.position.set(-20, 25, -30);
scene.add(fillLight);

const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);
const skyUniforms = sky.material.uniforms;
skyUniforms["turbidity"].value = 3;
skyUniforms["rayleigh"].value = 1.6;
skyUniforms["mieCoefficient"].value = 0.006;
skyUniforms["mieDirectionalG"].value = 0.8;

const sunDirection = new THREE.Vector3();
const phi = THREE.MathUtils.degToRad(77);
const theta = THREE.MathUtils.degToRad(125);
sunDirection.setFromSphericalCoords(1, phi, theta);
skyUniforms["sunPosition"].value.copy(sunDirection);

const waterGeometry = new THREE.PlaneGeometry(260, 260, 1, 1);
const waterMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x3ba8ff,
  transparent: true,
  opacity: 0.5,
  roughness: 0.22,
  metalness: 0.04,
  clearcoat: 0.45,
  clearcoatRoughness: 0.1,
});
const water = new THREE.Mesh(waterGeometry, waterMaterial);
water.rotation.x = -Math.PI / 2;
water.position.y = -0.7;
scene.add(water);

function adjustColor(hex, amount) {
  const color = new THREE.Color(hex);
  color.offsetHSL(0, 0, amount / 100);
  return color;
}

function createVoxelTexture(baseHex, variation = 24) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const baseColor = new THREE.Color(baseHex);
  ctx.fillStyle = `#${baseColor.getHexString()}`;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i += 1) {
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    const w = Math.ceil(Math.random() * 2);
    const h = Math.ceil(Math.random() * 2);
    const shade = (Math.random() - 0.5) * variation;
    const pixelColor = adjustColor(baseHex, shade);
    ctx.fillStyle = `#${pixelColor.getHexString()}`;
    ctx.fillRect(x, y, w, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const textures = {
  grass: createVoxelTexture(0x5aa748, 22),
  dirt: createVoxelTexture(0x8a5930, 20),
  stone: createVoxelTexture(0x8f8f8f, 16),
  wood: createVoxelTexture(0xa2723b, 24),
};

const materials = {
  grass: new THREE.MeshStandardMaterial({ map: textures.grass, roughness: 0.9, metalness: 0 }),
  dirt: new THREE.MeshStandardMaterial({ map: textures.dirt, roughness: 0.95, metalness: 0 }),
  stone: new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 0.85, metalness: 0.03 }),
  wood: new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.8, metalness: 0.02 }),
};

const blockTypes = [
  { key: "1", name: "Tierra", material: materials.dirt },
  { key: "2", name: "Piedra", material: materials.stone },
  { key: "3", name: "Madera", material: materials.wood },
  { key: "4", name: "Pasto", material: materials.grass },
];

let currentBlockType = blockTypes[0];
const blockLabel = document.getElementById("block-name");
const hint = document.getElementById("hint");

const blockSize = 1;
const cubeGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
const world = new Map();
const blocksGroup = new THREE.Group();
scene.add(blocksGroup);

const cloudGroup = new THREE.Group();
scene.add(cloudGroup);

function keyFromPosition(x, y, z) {
  return `${x},${y},${z}`;
}

function addBlock(x, y, z, material, blockName = "Bloque") {
  const key = keyFromPosition(x, y, z);
  if (world.has(key)) return;

  const mesh = new THREE.Mesh(cubeGeometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.blockName = blockName;

  world.set(key, mesh);
  blocksGroup.add(mesh);
}

function removeBlock(x, y, z) {
  const key = keyFromPosition(x, y, z);
  const block = world.get(key);
  if (!block) return;

  blocksGroup.remove(block);
  world.delete(key);
}

function generateClouds() {
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
    roughness: 0.95,
    metalness: 0,
  });

  for (let i = 0; i < 18; i += 1) {
    const cloud = new THREE.Group();
    const puffCount = 4 + Math.floor(Math.random() * 4);
    for (let p = 0; p < puffCount; p += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random() * 1.4, 10, 10), cloudMaterial);
      puff.position.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 3.5);
      puff.scale.y *= 0.65;
      cloud.add(puff);
    }

    cloud.position.set(Math.random() * 180 - 90, 18 + Math.random() * 10, Math.random() * 180 - 90);
    cloud.userData.drift = 0.45 + Math.random() * 0.55;
    cloudGroup.add(cloud);
  }
}

function generateTerrain() {
  const size = 28;
  for (let x = -size; x <= size; x += 1) {
    for (let z = -size; z <= size; z += 1) {
      const hillA = Math.sin(x * 0.18) * 2.7;
      const hillB = Math.cos(z * 0.23) * 2.1;
      const hillC = Math.sin((x + z) * 0.09) * 1.6;
      const height = Math.floor((hillA + hillB + hillC) * 0.7);

      for (let y = -4; y <= height; y += 1) {
        let material = materials.dirt;
        let name = "Tierra";

        if (y <= -2) {
          material = materials.stone;
          name = "Piedra";
        } else if (y === height) {
          material = materials.grass;
          name = "Pasto";
        }

        addBlock(x, y, z, material, name);
      }
    }
  }

  for (let i = 0; i < 55; i += 1) {
    const x = Math.floor(Math.random() * 46 - 23);
    const z = Math.floor(Math.random() * 46 - 23);
    let topY = -2;
    for (let y = 14; y >= -4; y -= 1) {
      if (world.has(keyFromPosition(x, y, z))) {
        topY = y;
        break;
      }
    }

    const trunkHeight = 3 + Math.floor(Math.random() * 2);
    for (let y = 1; y <= trunkHeight; y += 1) {
      addBlock(x, topY + y, z, materials.wood, "Madera");
    }

    for (let lx = -2; lx <= 2; lx += 1) {
      for (let lz = -2; lz <= 2; lz += 1) {
        for (let ly = trunkHeight - 1; ly <= trunkHeight + 1; ly += 1) {
          if (Math.abs(lx) + Math.abs(lz) > 3) continue;
          addBlock(x + lx, topY + ly + 1, z + lz, materials.grass, "Pasto");
        }
      }
    }
  }
}

generateTerrain();
generateClouds();

const controls = new PointerLockControls(camera, document.body);
renderer.domElement.addEventListener("click", () => controls.lock());

controls.addEventListener("lock", () => {
  hint.textContent = "Construye libremente. 1-4 cambia de bloque.";
});
controls.addEventListener("unlock", () => {
  hint.textContent = "Pulsa click para volver a capturar el cursor.";
});

const keys = { forward: false, backward: false, left: false, right: false, jump: false };
let velocityY = 0;
let onGround = false;
const gravity = 21;
const speed = 8;
const playerHeight = 1.72;

function getGroundHeightAt(x, z) {
  const bx = Math.round(x);
  const bz = Math.round(z);

  for (let y = 24; y >= -6; y -= 1) {
    if (world.has(keyFromPosition(bx, y, bz))) {
      return y + 0.5;
    }
  }
  return -10;
}

window.addEventListener("keydown", (event) => {
  if (event.code === "KeyW") keys.forward = true;
  if (event.code === "KeyS") keys.backward = true;
  if (event.code === "KeyA") keys.left = true;
  if (event.code === "KeyD") keys.right = true;
  if (event.code === "Space") keys.jump = true;

  const selected = blockTypes.find((type) => type.key === event.key);
  if (selected) {
    currentBlockType = selected;
    blockLabel.textContent = selected.name;
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "KeyW") keys.forward = false;
  if (event.code === "KeyS") keys.backward = false;
  if (event.code === "KeyA") keys.left = false;
  if (event.code === "KeyD") keys.right = false;
  if (event.code === "Space") keys.jump = false;
});

const raycaster = new THREE.Raycaster();
const mouseCenter = new THREE.Vector2(0, 0);

window.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("mousedown", (event) => {
  if (!controls.isLocked) return;

  raycaster.setFromCamera(mouseCenter, camera);
  const intersects = raycaster.intersectObjects(blocksGroup.children, false);
  if (!intersects.length) return;

  const hit = intersects[0];
  const hitPoint = hit.point.clone().addScaledVector(hit.face.normal, -0.01);
  const targetPos = hitPoint.divideScalar(blockSize).floor();

  if (event.button === 0) {
    removeBlock(targetPos.x, targetPos.y, targetPos.z);
  }

  if (event.button === 2) {
    const placePoint = hit.point.clone().addScaledVector(hit.face.normal, 0.51);
    const placePos = placePoint.divideScalar(blockSize).floor();

    const cameraGrid = new THREE.Vector3(
      Math.round(camera.position.x),
      Math.round(camera.position.y - playerHeight / 2),
      Math.round(camera.position.z)
    );

    const isInsidePlayer =
      placePos.x === cameraGrid.x &&
      Math.abs(placePos.y - cameraGrid.y) <= 1 &&
      placePos.z === cameraGrid.z;

    if (!isInsidePlayer) {
      addBlock(
        placePos.x,
        placePos.y,
        placePos.z,
        currentBlockType.material,
        currentBlockType.name
      );
    }
  }
});

const clock = new THREE.Clock();

function updatePlayer(delta) {
  if (!controls.isLocked) return;

  const direction = new THREE.Vector3();
  if (keys.forward) direction.z -= 1;
  if (keys.backward) direction.z += 1;
  if (keys.left) direction.x -= 1;
  if (keys.right) direction.x += 1;

  if (direction.lengthSq() > 0) {
    direction.normalize();
    controls.moveRight(direction.x * speed * delta);
    controls.moveForward(direction.z * speed * delta);
  }

  const groundHeight = getGroundHeightAt(camera.position.x, camera.position.z) + playerHeight;

  velocityY -= gravity * delta;
  if (keys.jump && onGround) {
    velocityY = 8;
    onGround = false;
  }

  camera.position.y += velocityY * delta;

  if (camera.position.y <= groundHeight) {
    camera.position.y = groundHeight;
    velocityY = 0;
    onGround = true;
  }
}

function updateSky(time) {
  const daylight = Math.sin(time * 0.05) * 0.5 + 0.5;
  sun.intensity = 0.7 + daylight * 0.9;
  ambientLight.intensity = 0.4 + daylight * 0.35;
  fillLight.intensity = 0.12 + daylight * 0.25;
  water.material.opacity = 0.4 + daylight * 0.15;

  cloudGroup.children.forEach((cloud) => {
    cloud.position.x += cloud.userData.drift * 0.01;
    if (cloud.position.x > 120) cloud.position.x = -120;
  });
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const elapsed = clock.elapsedTime;
  updatePlayer(delta);
  updateSky(elapsed);
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
