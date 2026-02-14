import * as THREE from "https://esm.sh/three@0.164.1";
import { PointerLockControls } from "https://esm.sh/three@0.164.1/examples/jsm/controls/PointerLockControls.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 10, 80);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 4, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.HemisphereLight(0xffffff, 0x4a5b31, 0.8);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(20, 35, 10);
sun.castShadow = true;
sun.shadow.camera.left = -40;
sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40;
sun.shadow.camera.bottom = -40;
scene.add(sun);

const textures = {
  grass: new THREE.MeshLambertMaterial({ color: 0x4caf50 }),
  dirt: new THREE.MeshLambertMaterial({ color: 0x8b5a2b }),
  stone: new THREE.MeshLambertMaterial({ color: 0x8d8d8d }),
  wood: new THREE.MeshLambertMaterial({ color: 0xa1733d }),
};

const blockTypes = [
  { key: "1", name: "Tierra", material: textures.dirt },
  { key: "2", name: "Piedra", material: textures.stone },
  { key: "3", name: "Madera", material: textures.wood },
  { key: "4", name: "Pasto", material: textures.grass },
];

let currentBlockType = blockTypes[0];
const blockLabel = document.getElementById("block-name");
const hint = document.getElementById("hint");

const blockSize = 1;
const cubeGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
const world = new Map();
const blocksGroup = new THREE.Group();
scene.add(blocksGroup);

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

function generateTerrain() {
  const size = 24;
  for (let x = -size; x <= size; x += 1) {
    for (let z = -size; z <= size; z += 1) {
      const noise = Math.sin(x * 0.35) * Math.cos(z * 0.4);
      const height = Math.round(noise * 2);

      for (let y = -2; y <= height; y += 1) {
        const material = y === height ? textures.grass : textures.dirt;
        const name = y === height ? "Pasto" : "Tierra";
        addBlock(x, y, z, material, name);
      }
    }
  }

  for (let i = 0; i < 45; i += 1) {
    const x = Math.floor(Math.random() * 40 - 20);
    const z = Math.floor(Math.random() * 40 - 20);

    for (let y = 1; y <= 3; y += 1) {
      addBlock(x, y + 1, z, textures.wood, "Madera");
    }

    for (let lx = -2; lx <= 2; lx += 1) {
      for (let lz = -2; lz <= 2; lz += 1) {
        for (let ly = 4; ly <= 5; ly += 1) {
          if (Math.abs(lx) + Math.abs(lz) > 3) continue;
          addBlock(x + lx, ly, z + lz, textures.grass, "Pasto");
        }
      }
    }
  }
}

generateTerrain();

const controls = new PointerLockControls(camera, document.body);

renderer.domElement.addEventListener("click", () => {
  controls.lock();
});

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
const speed = 7.5;
const playerHeight = 1.7;

function getGroundHeightAt(x, z) {
  const bx = Math.round(x);
  const bz = Math.round(z);

  for (let y = 20; y >= -5; y -= 1) {
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

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  updatePlayer(delta);
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
