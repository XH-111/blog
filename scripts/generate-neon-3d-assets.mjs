import fs from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const outDir = path.resolve("public/assets/3d");

class NodeFileReader {
  constructor() {
    this.result = null;
    this.onerror = null;
    this.onloadend = null;
  }

  readAsArrayBuffer(blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        this.result = buffer;
        this.onloadend?.({ target: this });
      })
      .catch((error) => this.onerror?.(error));
  }

  readAsDataURL(blob) {
    blob.arrayBuffer()
      .then((buffer) => {
        const mimeType = blob.type || "application/octet-stream";
        this.result = `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;
        this.onloadend?.({ target: this });
      })
      .catch((error) => this.onerror?.(error));
  }
}

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = NodeFileReader;
}

function makeStandardMaterial(name, color, emissive = color, emissiveIntensity = 0.3) {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    metalness: 0.45,
    roughness: 0.34,
  });
  material.name = name;
  return material;
}

function makeNeonMaterial(name, color, opacity = 1) {
  const material = new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: opacity < 1,
  });
  material.name = name;
  return material;
}

const materials = {
  darkMetal: makeStandardMaterial("dark_neon_metal", 0x061022, 0x061a2d, 0.65),
  blueTrim: makeStandardMaterial("cyan_emissive_trim", 0x06354a, 0x00dfff, 0.7),
  glass: makeStandardMaterial("smoked_blue_glass", 0x14304b, 0x0a4a68, 0.45),
  cyan: makeNeonMaterial("cyan_neon", 0x72f7ff, 0.96),
  magenta: makeNeonMaterial("magenta_neon", 0xff4df3, 0.92),
  amber: makeNeonMaterial("amber_neon", 0xffc65a, 0.9),
  white: makeNeonMaterial("soft_white_neon", 0xf4fbff, 1),
  catBody: makeStandardMaterial("midnight_cat_body", 0x15192a, 0x2c1748, 0.2),
  catChest: makeStandardMaterial("cat_cyan_chest", 0x153d4d, 0x00e5ff, 0.38),
  catEye: makeNeonMaterial("cat_cyan_eyes", 0x8fffff, 1),
};

function addMesh(parent, name, geometry, material, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

function addCylinderBetween(parent, name, start, end, radius, material) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material);
  mesh.name = name;
  mesh.position.copy(from.add(to).multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(mesh);
  return mesh;
}

const pixelFont = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
};

function addPixelText(parent, name, text, size, material, position, rotation = [0, 0, 0]) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  group.rotation.set(...rotation);
  parent.add(group);

  const cell = size;
  const gap = size * 0.24;
  const depth = Math.max(0.012, size * 0.28);
  const charWidth = 5 * cell + 4 * gap;
  const charGap = size * 1.15;
  const spaceWidth = size * 2.6;
  const lineHeight = 7 * cell + 6 * gap;
  const chars = [...text.toUpperCase()];
  const totalWidth = chars.reduce((width, char) => width + (char === " " ? spaceWidth : charWidth + charGap), -charGap);
  let cursor = -totalWidth / 2;

  chars.forEach((char) => {
    if (char === " ") {
      cursor += spaceWidth;
      return;
    }

    const glyph = pixelFont[char] || pixelFont.X;
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, colIndex) => {
        if (pixel !== "1") return;
        addMesh(
          group,
          `${name}_${char}_${rowIndex}_${colIndex}`,
          new THREE.BoxGeometry(cell, cell, depth),
          material,
          [
            cursor + colIndex * (cell + gap) + cell / 2,
            lineHeight / 2 - rowIndex * (cell + gap) - cell / 2,
            0,
          ]
        );
      });
    });
    cursor += charWidth + charGap;
  });

  return group;
}

function createNeonCat() {
  const cat = new THREE.Group();
  cat.name = "neon_cat_companion";

  addMesh(cat, "cat_body", new THREE.SphereGeometry(0.58, 28, 18), materials.catBody, [0, 0.42, 0], [0, 0, 0], [1.08, 0.72, 0.58]);
  addMesh(cat, "cat_chest_glow", new THREE.SphereGeometry(0.28, 20, 12), materials.catChest, [0, 0.34, 0.43], [0, 0, 0], [0.82, 0.5, 0.18]);
  addMesh(cat, "cat_head", new THREE.SphereGeometry(0.42, 28, 18), materials.catBody, [0, 1.02, 0.1], [0, 0, 0], [1, 0.86, 0.88]);

  addMesh(cat, "cat_left_ear", new THREE.ConeGeometry(0.18, 0.44, 4), materials.catBody, [-0.27, 1.36, 0.08], [0.16, 0, -0.45]);
  addMesh(cat, "cat_right_ear", new THREE.ConeGeometry(0.18, 0.44, 4), materials.catBody, [0.27, 1.36, 0.08], [0.16, 0, 0.45]);
  addMesh(cat, "cat_left_eye", new THREE.SphereGeometry(0.045, 16, 10), materials.catEye, [-0.14, 1.06, 0.47], [0, 0, 0], [1.2, 0.65, 0.4]);
  addMesh(cat, "cat_right_eye", new THREE.SphereGeometry(0.045, 16, 10), materials.catEye, [0.14, 1.06, 0.47], [0, 0, 0], [1.2, 0.65, 0.4]);
  addMesh(cat, "cat_nose", new THREE.SphereGeometry(0.032, 12, 8), materials.magenta, [0, 0.98, 0.5], [0, 0, 0], [1, 0.7, 0.5]);

  addCylinderBetween(cat, "cat_whisker_left_top", [-0.05, 0.98, 0.5], [-0.48, 1.06, 0.55], 0.008, materials.cyan);
  addCylinderBetween(cat, "cat_whisker_left_low", [-0.05, 0.94, 0.5], [-0.46, 0.88, 0.55], 0.008, materials.cyan);
  addCylinderBetween(cat, "cat_whisker_right_top", [0.05, 0.98, 0.5], [0.48, 1.06, 0.55], 0.008, materials.cyan);
  addCylinderBetween(cat, "cat_whisker_right_low", [0.05, 0.94, 0.5], [0.46, 0.88, 0.55], 0.008, materials.cyan);

  addMesh(cat, "cat_front_left_paw", new THREE.SphereGeometry(0.13, 16, 10), materials.catBody, [-0.28, -0.02, 0.32], [0, 0, 0], [1, 0.55, 1.25]);
  addMesh(cat, "cat_front_right_paw", new THREE.SphereGeometry(0.13, 16, 10), materials.catBody, [0.28, -0.02, 0.32], [0, 0, 0], [1, 0.55, 1.25]);
  addMesh(cat, "cat_back_left_paw", new THREE.SphereGeometry(0.15, 16, 10), materials.catBody, [-0.35, -0.02, -0.25], [0, 0, 0], [1.15, 0.55, 1.25]);
  addMesh(cat, "cat_back_right_paw", new THREE.SphereGeometry(0.15, 16, 10), materials.catBody, [0.35, -0.02, -0.25], [0, 0, 0], [1.15, 0.55, 1.25]);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.44, 0.45, -0.24),
    new THREE.Vector3(0.82, 0.78, -0.28),
    new THREE.Vector3(0.72, 1.14, 0.06),
    new THREE.Vector3(0.42, 1.04, 0.28),
  ]);
  addMesh(cat, "cat_cyan_tail", new THREE.TubeGeometry(tailCurve, 36, 0.045, 10, false), materials.cyan, [0, 0, 0]);

  addCylinderBetween(cat, "cat_neck_collar", [-0.34, 0.79, 0.32], [0.34, 0.79, 0.32], 0.018, materials.magenta);
  addMesh(cat, "cat_collar_tag", new THREE.SphereGeometry(0.045, 12, 8), materials.amber, [0, 0.74, 0.4]);

  cat.userData = {
    assetRole: "companion",
    originalAsset: true,
    animationHint: "Idle bob, blink, and tail sway can be driven in Three.js.",
  };
  return cat;
}

function createNeonBlogRoom() {
  const room = new THREE.Group();
  room.name = "xh_blog_neon_room";

  addMesh(room, "floor_base", new THREE.BoxGeometry(7.2, 0.22, 4.2), materials.darkMetal, [0, -0.1, 0]);
  addMesh(room, "rear_wall", new THREE.BoxGeometry(5.4, 2.8, 0.22), materials.glass, [-0.85, 1.32, -1.55], [0, -0.06, 0]);
  addMesh(room, "store_counter", new THREE.BoxGeometry(3.9, 0.82, 0.92), materials.darkMetal, [-0.7, 0.38, 0.08]);
  addMesh(room, "terminal_screen", new THREE.BoxGeometry(2.24, 0.68, 0.05), materials.cyan, [-0.7, 0.62, 0.57]);
  addMesh(room, "terminal_magenta_bar", new THREE.BoxGeometry(2.35, 0.08, 0.08), materials.magenta, [-0.7, 0.2, 0.64]);
  addMesh(room, "roof_light_bar", new THREE.BoxGeometry(5.55, 0.18, 0.2), materials.cyan, [-0.75, 2.64, -1.25], [0, -0.06, 0]);
  addMesh(room, "antenna_tower", new THREE.BoxGeometry(0.48, 2.95, 0.48), materials.blueTrim, [-3.1, 1.28, -0.4]);
  addCylinderBetween(room, "antenna_pin", [-3.1, 2.75, -0.4], [-3.1, 3.75, -0.4], 0.025, materials.cyan);

  addPixelText(room, "main_sign_text", "XH BLOG", 0.072, materials.cyan, [-0.9, 1.72, -1.42], [0, -0.06, 0]);
  addPixelText(room, "main_sign_caption", "TECH NOTES", 0.026, materials.white, [-0.9, 1.4, -1.4], [0, -0.06, 0]);

  const halo = addMesh(room, "floor_cyan_halo", new THREE.TorusGeometry(2.7, 0.025, 12, 112), materials.cyan, [-0.35, 0.03, 0.1], [Math.PI / 2, 0, 0]);
  halo.userData.assetRole = "floorGlow";

  const signPost = new THREE.Group();
  signPost.name = "route_sign_post";
  signPost.position.set(2.55, 0.26, 0.12);
  signPost.rotation.y = -0.38;
  room.add(signPost);
  addCylinderBetween(signPost, "sign_post_pole", [0, -0.18, 0], [0, 1.92, 0], 0.035, materials.blueTrim);

  const signs = [
    ["sign_posts", "POSTS", "/posts", materials.cyan, 1.45, 0.33],
    ["sign_about", "ABOUT", "/about", materials.magenta, 0.92, -0.28],
    ["sign_messages", "MSG", "/messages", materials.amber, 0.38, 0.24],
  ];

  signs.forEach(([name, label, route, material, y, x], index) => {
    const board = addMesh(signPost, name, new THREE.BoxGeometry(1.45, 0.42, 0.08), materials.darkMetal, [x, y, 0], [0, 0, index % 2 ? 0.08 : -0.08]);
    board.userData.route = route;
    addPixelText(signPost, `${name}_label`, label, 0.039, material, [x, y - 0.02, 0.065], [0, 0, index % 2 ? 0.08 : -0.08]);
  });

  for (let index = 0; index < 7; index += 1) {
    const material = [materials.cyan, materials.magenta, materials.amber][index % 3];
    addMesh(
      room,
      `floating_neon_cube_${index + 1}`,
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      material,
      [-3.1 + index * 1.05, 1.15 + Math.sin(index) * 0.48, -0.15 + Math.cos(index * 1.4) * 1.15],
      [index * 0.26, index * 0.18, index * 0.31]
    );
  }

  for (let index = 0; index < 5; index += 1) {
    const material = index % 2 ? materials.magenta : materials.amber;
    addMesh(room, `front_floor_neon_strip_${index + 1}`, new THREE.BoxGeometry(0.86, 0.035, 0.04), material, [-2.1 + index * 1.03, 0.04, 1.62]);
  }

  room.userData = {
    assetRole: "heroScene",
    originalAsset: true,
    routes: {
      sign_posts: "/posts",
      sign_about: "/about",
      sign_messages: "/messages",
    },
  };

  return room;
}

async function exportGlb(object, fileName) {
  const exporter = new GLTFExporter();
  object.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });
  const data = await exporter.parseAsync(object, {
    binary: true,
    onlyVisible: true,
    trs: false,
    includeCustomExtensions: false,
  });
  await fs.writeFile(path.join(outDir, fileName), Buffer.from(data));
}

function makePreviewSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#050711"/>
  <path d="M0 566h1280M0 622h1280M0 678h1280M112 500l-90 220M252 500l-36 220M392 500l12 220M532 500l60 220M672 500l108 220M812 500l156 220M952 500l204 220" stroke="#0a6f8b" stroke-width="2" opacity=".55"/>
  <ellipse cx="650" cy="508" rx="320" ry="92" fill="none" stroke="#00e5ff" stroke-width="8" opacity=".8"/>
  <rect x="322" y="268" width="480" height="210" rx="12" fill="#071426" stroke="#00e5ff" stroke-width="4"/>
  <rect x="394" y="318" width="336" height="96" fill="#10d8eb" opacity=".9"/>
  <rect x="408" y="430" width="305" height="18" fill="#ff3df2"/>
  <rect x="284" y="178" width="560" height="60" rx="8" fill="#062638"/>
  <text x="562" y="220" text-anchor="middle" fill="#72f7ff" font-family="Consolas,monospace" font-size="44" font-weight="700">XH BLOG</text>
  <g transform="translate(910 238) rotate(-10)">
    <line x1="48" y1="112" x2="48" y2="330" stroke="#00e5ff" stroke-width="10"/>
    <rect x="-42" y="28" width="190" height="52" fill="#071426" stroke="#72f7ff" stroke-width="5"/>
    <rect x="-72" y="104" width="190" height="52" fill="#071426" stroke="#ff3df2" stroke-width="5"/>
    <rect x="-14" y="180" width="190" height="52" fill="#071426" stroke="#ffc65a" stroke-width="5"/>
    <text x="52" y="64" fill="#72f7ff" text-anchor="middle" font-family="Consolas,monospace" font-size="28">POSTS</text>
    <text x="22" y="140" fill="#ff8df8" text-anchor="middle" font-family="Consolas,monospace" font-size="28">ABOUT</text>
    <text x="82" y="216" fill="#ffc65a" text-anchor="middle" font-family="Consolas,monospace" font-size="28">MSG</text>
  </g>
  <g transform="translate(782 482)">
    <ellipse cx="0" cy="26" rx="60" ry="42" fill="#15192a" stroke="#72f7ff" stroke-width="3"/>
    <circle cx="42" cy="-8" r="38" fill="#15192a" stroke="#ff3df2" stroke-width="3"/>
    <path d="M18-38l18-40 22 44M58-38l28-34 5 46" fill="#15192a" stroke="#72f7ff" stroke-width="3"/>
    <circle cx="30" cy="-12" r="5" fill="#8fffff"/>
    <circle cx="54" cy="-12" r="5" fill="#8fffff"/>
    <path d="M-48 20c-42-48 24-96 64-64" fill="none" stroke="#72f7ff" stroke-width="8" stroke-linecap="round"/>
  </g>
</svg>`;
}

const cat = createNeonCat();
const room = createNeonBlogRoom();
const combined = createNeonBlogRoom();
const combinedCat = createNeonCat();
combinedCat.name = "neon_cat_scene_companion";
combinedCat.position.set(1.2, 0.05, 1.06);
combinedCat.rotation.y = -0.45;
combinedCat.scale.setScalar(0.58);
combined.add(combinedCat);
combined.name = "xh_blog_neon_scene_with_cat";

await fs.mkdir(outDir, { recursive: true });
await exportGlb(cat, "neon-cat.glb");
await exportGlb(room, "neon-blog-room.glb");
await exportGlb(combined, "neon-blog-scene.glb");
await fs.writeFile(path.join(outDir, "neon-3d-assets-preview.svg"), makePreviewSvg(), "utf8");
await fs.writeFile(
  path.join(outDir, "neon-3d-assets.manifest.json"),
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    license: "Original generated assets for this blog project.",
    assets: [
      {
        file: "/assets/3d/neon-cat.glb",
        role: "companion",
        description: "Small neon cat replacement for the reference portfolio dog model.",
      },
      {
        file: "/assets/3d/neon-blog-room.glb",
        role: "environment",
        description: "Original cyber-neon blog room with route sign objects.",
      },
      {
        file: "/assets/3d/neon-blog-scene.glb",
        role: "readyToUseHero",
        description: "Combined blog room and neon cat scene for homepage hero use.",
      },
      {
        file: "/assets/3d/neon-3d-assets-preview.svg",
        role: "preview",
        description: "Flat preview sheet for quick visual identification.",
      },
    ],
    routeObjects: {
      sign_posts: "/posts",
      sign_about: "/about",
      sign_messages: "/messages",
    },
    notes: [
      "These files do not copy GLB, texture, audio, or mesh data from the reference portfolio.",
      "Text labels use English so they can be baked into geometry without external Chinese font files.",
      "Homepage animation such as cat idle bob, blink, and tail sway should be driven in Three.js.",
    ],
  }, null, 2)}\n`,
  "utf8"
);

console.log(`Generated neon 3D assets in ${outDir}`);
