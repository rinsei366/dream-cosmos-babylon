import * as BABYLON from '@babylonjs/core';
import { SolidParticleSystem } from '@babylonjs/core/Particles/solidParticleSystem';
import { ShaderStore } from '@babylonjs/core/Engines/shaderStore';
let isMyConstellation = false;

// 💬 Supabaseクライアント初期化
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dibjpauhjkxcaqjgjnic.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpYmpwYXVoamt4Y2FxamdqbmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4NDEwMzYsImV4cCI6MjA1OTQxNzAzNn0.z2YC36n5in0kP4KalQwKqMt6Ypl3U95bcvIYYbAbcuc';
const supabase = createClient(supabaseUrl, supabaseKey);

// 1. キャンバス取得
const canvas = document.getElementById('app');

// 2. エンジン作成
const engine = new BABYLON.Engine(canvas, true);

// 2.5 Shaderを直接登録

function setFoxImage(mood = "idle") {
  const fox = document.querySelector("#moonFoxUI img");
  fox.src = `/textures/moonfox_${mood}.png`;
}

// background.vertex.fx
ShaderStore.ShadersStore["backgroundVertexShader"] = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

uniform mat4 worldViewProjection;

varying vec2 vUV;

void main(void) {
    gl_Position = worldViewProjection * vec4(position, 1.0);
    vUV = uv;
}
`;

// background.fragment.fx
ShaderStore.ShadersStore["backgroundFragmentShader"] = ` precision highp float;

varying vec2 vUV;
uniform float uTime;

void main(void) {
    vec2 uv = vUV - 0.5;
    float strength = 0.3 / length(uv) + 0.3 * sin(uTime + uv.x * 10.0) + 0.2 * cos(uTime * 0.5 + uv.y * 10.0);
    vec3 color = vec3(0.1, 0.2, 0.4) * strength;
    gl_FragColor = vec4(color, 1.0);
}
`;


// 3. シーン作成
const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0, 0, 0, 1); // 黒背景

// タグ別の重力中心座標
const tagCenters = {
  "#Courage": new BABYLON.Vector3(300, 100, -100),
  "#Cosmos": new BABYLON.Vector3(-200, 50, 300),
  "#Healing": new BABYLON.Vector3(100, -150, 100),
  "#Rebirth": new BABYLON.Vector3(-250, -100, -200),
  "#Nature": new BABYLON.Vector3(200, 0, -250),
  "#Technology": new BABYLON.Vector3(0, 200, 200),
};

// タグごとの色設定（星雲の色にも使う）
const tagCloudColors = {
  "#Courage":   new BABYLON.Color3(1.0, 0.5, 0.2),
  "#Cosmos":    new BABYLON.Color3(0.2, 0.5, 1.0),
  "#Healing":   new BABYLON.Color3(0.5, 1.0, 0.8),
  "#Rebirth":   new BABYLON.Color3(0.9, 0.6, 1.0),
  "#Nature":    new BABYLON.Color3(0.5, 1.0, 0.4),
  "#Technology":new BABYLON.Color3(0.4, 0.9, 1.0),
};

const spreadRadius = 50;

function getRandomPositionAround(center) {
  return new BABYLON.Vector3(
    center.x + (Math.random() - 0.5) * spreadRadius,
    center.y + (Math.random() - 0.5) * spreadRadius,
    center.z + (Math.random() - 0.5) * spreadRadius * 3
  );
}

// 4. カメラ作成（自由移動）
const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.5, 100, BABYLON.Vector3.Zero(), scene);
camera.attachControl(canvas, true);
// ズームの範囲制限
camera.lowerRadiusLimit = 150;   // 最も近づいても150まで
camera.upperRadiusLimit = 400;   // 最も遠くても400まで
camera.wheelDeltaPercentage = 0.01; // ホイール感度も下げる（なめらかズーム）


// 5. ライト作成
const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
light.intensity = 0.7;

const glowLayer = new BABYLON.GlowLayer("glow", scene);
glowLayer.intensity = 1.0;

// 背景球体を作成
const backgroundSphere = BABYLON.MeshBuilder.CreateSphere("backgroundSphere", { segments: 32, diameter: 2000 }, scene);
backgroundSphere.isPickable = false; 

// 背景用のGLSLマテリアル
const backgroundMaterial = new BABYLON.ShaderMaterial("backgroundShader", scene, {
    vertex: "background",
    fragment: "background",
}, {
    attributes: ["position", "normal", "uv"],
    uniforms: ["worldViewProjection", "uTime"],
});

// マテリアル設定
backgroundMaterial.backFaceCulling = false; // 球の内側を描画
backgroundSphere.material = backgroundMaterial;

// 時間を渡してアニメさせる
scene.registerBeforeRender(() => {
    backgroundMaterial.setFloat("uTime", performance.now() * 0.001);
});

// 6. 星を大量生成
const starCount = 1000;
for (let i = 0; i < starCount; i++) {
    const sphere = BABYLON.MeshBuilder.CreateSphere(`star${i}`, { diameter: 0.5 }, scene);
    sphere.position.x = (Math.random() - 0.5) * 400;
    sphere.position.y = (Math.random() - 0.5) * 400;
    sphere.position.z = (Math.random() - 0.5) * 400;

    const material = new BABYLON.StandardMaterial(`mat${i}`, scene);
    material.emissiveColor = new BABYLON.Color3(1, 1, 1); 
    material.disableLighting = true;
    sphere.material = material;
}

// ✅ Supabase投稿データ取得関数
async function fetchDreamStars() {
  const { data, error } = await supabase
    .from('dreams')
    .select('*')
    .neq('dream_text', '');

  if (error) {
    console.error('Supabase fetch error:', error);
    return [];
  }

  return data.map(dream => ({
    x: dream.position_x,
    y: dream.position_y,
    z: dream.position_z,
    category: dream.category,
    tags: dream.tags,
    dream_text: dream.dream_text,
    dream_text_en: dream.dream_text_en,
    user_name: dream.user_name
  }));
}

function getFilteredPostStars(posts) {
  const selectedCategory = document.getElementById('categorySelect')?.value;
  const selectedTags = Array.from(
    document.querySelectorAll('.tagCheckbox:checked')
  ).map(cb => cb.value);

  const myUserName = localStorage.getItem("myUserName");

  if (isMyConstellation && myUserName) {
    posts = posts.filter(post => post.user_name === myUserName);
  }  

  return posts.filter(star => {
    const matchCategory = selectedCategory
      ? star.category === selectedCategory
      : true;

    const matchTags = selectedTags.length > 0
      ? selectedTags.every(tag => star.tags.includes(tag))
      : true;

    return matchCategory && matchTags;
  });
}

// カテゴリごとの色
const categoryColors = {
  Adventure: new BABYLON.Color3(0.2, 0.6, 1.0),   // 青
  Healing:   new BABYLON.Color3(0.5, 1.0, 0.8),   // 緑
  Creation:  new BABYLON.Color3(1.0, 0.5, 1.0),   // ピンク
  Challenge: new BABYLON.Color3(1.0, 0.6, 0.3),      // オレンジ系
  "Love & Connection": new BABYLON.Color3(1.0, 0.4, 0.6), // ローズ系
  Growth:    new BABYLON.Color3(0.6, 1.0, 0.4),      // 明るいグリー
};

const postStarsMeshes = [];
const starbursts = []; // ✅ starburstたちをまとめて保持する配列

let allPosts = [];

async function updatePostStarsDisplay() {
  const posts = await fetchDreamStars();
  console.log("[Step1] Supabase取得:", posts);
  const filtered = getFilteredPostStars(posts);
  console.log("[Step2] フィルター後の投稿星:", filtered);
  allPosts = posts;

  // 既存の投稿星削除
  postStarsMeshes.forEach(mesh => mesh.dispose());
  postStarsMeshes.length = 0;

  filtered.forEach((star, index) => {
    console.log(`[Step3] postCore${index} を描画`, star);
    const baseColor = categoryColors[star.category] || new BABYLON.Color3(1, 1, 1);
    const tag = star.tags?.[0];
    const fallbackCenter = new BABYLON.Vector3(
      (Math.random() - 0.5) * 400,
      (Math.random() - 0.5) * 400,
      (Math.random() - 0.5) * 400
    );
    const center = tagCenters[tag] || fallbackCenter;
    const pos = new BABYLON.Vector3(star.x, star.y, star.z);

    const core = BABYLON.MeshBuilder.CreateSphere(`postCore${index}`, { diameter: 6.0 }, scene);
    const coreMat = new BABYLON.StandardMaterial(`coreMat${index}`, scene);
    coreMat.emissiveColor = baseColor;
    coreMat.disableLighting = true;
    core.material = coreMat;
    core.position = pos;
    core.isPickable = true;

    animatedPostStars.push({ material: coreMat, baseColor });

    const aura = BABYLON.MeshBuilder.CreateSphere(`postAura${index}`, { diameter: 3 }, scene);
    animatedPostStars.push({ material: coreMat, auraMesh: aura, baseColor });
   
    const auraMat = new BABYLON.StandardMaterial(`auraMat${index}`, scene);
    auraMat.emissiveColor = baseColor;
    auraMat.alpha = 0.08;
    auraMat.disableLighting = true;
    aura.material = auraMat;
    aura.position = pos.clone();
    aura.isPickable = false;

    postStarsMeshes.push(core, aura);

    if (!starsByTag[tag]) starsByTag[tag] = [];
starsByTag[tag].push(core);

    const starburst = BABYLON.MeshBuilder.CreatePlane(`starburst${index}`, { size: 6 }, scene);

    const starburstMat = new BABYLON.StandardMaterial(`starburstMat${index}`, scene);
    starburstMat.diffuseTexture = new BABYLON.Texture("/textures/starburst.png", scene);
    starburstMat.opacityTexture = starburstMat.diffuseTexture;
    starburstMat.diffuseTexture.hasAlpha = true;
    starburstMat.useAlphaFromDiffuseTexture = true;
    starburstMat.emissiveColor = baseColor;
    starburstMat.disableLighting = true;
    starburstMat.alpha = 1;
    starburstMat.diffuseTexture.updateSamplingMode(BABYLON.Texture.NEAREST_NEAREST);
       
starburst.material = starburstMat;
starburst.isPickable = false;
starburst.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

// ✅ この行を追加：
starbursts.push(starburst);

  });
  console.log("[Step4] scene.meshes 中の postCore一覧:", scene.meshes.filter(m => m.name.includes("postCore")));
}

// ✅ BGM制御（ループ再生 + トグル）
const bgm = document.getElementById("bgm");
const bgmToggle = document.getElementById("bgmToggle");

// 初期はミュート（音量0）
bgm.volume = 0;

// 自動再生制限に備えた再生処理（try-catch）
bgm.play().catch(() => {
  console.log("🔇 Autoplay is blocked by browser settings");
});

let bgmOn = false;
bgmToggle.addEventListener("click", () => {
  bgmOn = !bgmOn;
  bgm.volume = bgmOn ? 0.4 : 0;
  bgmToggle.textContent = bgmOn ? "🔊 Sound OFF" : "🔈 Sound ON";

  // 再生試行（ブロックされててもOK）
  if (bgmOn) {
    bgm.play().catch(() => {});
  }
});

// 投稿星の生成
const animatedPostStars = [];
const starsByTag = {};

// ⭐ 各タグごとの雲を生成
Object.entries(tagCenters).forEach(([tag, center]) => {
  const cloud = new BABYLON.SolidParticleSystem(`cloud_${tag}`, scene);

  const cloudParticle = BABYLON.MeshBuilder.CreateSphere(`cloudParticle_${tag}`, { diameter: 2 }, scene);
  cloud.addShape(cloudParticle, 300);
  cloudParticle.isVisible = false;

  const mesh = cloud.buildMesh();
  mesh.material = new BABYLON.StandardMaterial(`cloudMat_${tag}`, scene);
  mesh.material.emissiveColor = tagCloudColors[tag] || new BABYLON.Color3(1, 1, 1);
  mesh.material.alpha = 0.06;
  mesh.material.disableLighting = true;
  mesh.isPickable = false;

  cloudParticle.dispose();

  cloud.initParticles = () => {
    for (let p = 0; p < cloud.nbParticles; p++) {
      cloud.particles[p].position = getRandomPositionAround(center);
    }
  };

  cloud.setParticles();
});

Object.entries(starsByTag).forEach(([tag, stars]) => {
stars.forEach((starA, i) => {
  const distances = stars.map((starB, j) => ({
    index: j,
    dist: BABYLON.Vector3.Distance(starA.position, starB.position),
  })).filter(d => d.index !== i).sort((a, b) => a.dist - b.dist).slice(0, 3);

  distances.forEach(({ index }) => {
    const starB = stars[index];
    const line = BABYLON.MeshBuilder.CreateLines(`line_${tag}_${i}_${index}`, {
      points: [starA.position, starB.position],
    }, scene);
    line.color = new BABYLON.Color3(1, 1, 1);
  });
});
});

// 🎞 レンダーループ
engine.runRenderLoop(() => {
scene.render();
});

window.addEventListener('resize', () => {
  engine.resize();

  // ✅ すべての starburst を再適用（billboardのままにする）
  starbursts.forEach(s => {
    s.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  });
});

// ゆらぎ（シーン内）に統合する：registerBeforeRender 内で追記
scene.registerBeforeRender(() => {
  const now = performance.now();
  backgroundMaterial.setFloat("uTime", now * 0.001);

  const t = now * 0.002;
  animatedPostStars.forEach(({ material, baseColor }, i) => {
    const pulse = 0.7 + 0.3 * Math.sin(t + i);
    material.emissiveColor = new BABYLON.Color3(
      baseColor.r * pulse,
      baseColor.g * pulse,
      baseColor.b * pulse
    );
  });
});

// 微粒子パーティクルを作成
const sps = new SolidParticleSystem('sps', scene);

// パーティクル元の形（小さい球）
const particleMesh = BABYLON.MeshBuilder.CreateSphere('particle', { diameter: 0.5 }, scene);

// パーティクル用マテリアルを作る
const particleMaterial = new BABYLON.StandardMaterial("particleMat", scene);
particleMaterial.emissiveColor = new BABYLON.Color3(0.8, 0.8, 1.0); // 少し光る水色
particleMaterial.disableLighting = true;
particleMesh.material = particleMaterial;


// 大量の粒子を追加
sps.addShape(particleMesh, 2000); // 数量は自由（軽いので数千個いける）

// 粒子の初期化設定
sps.buildMesh();
particleMesh.dispose(); // 元メッシュは不要なので削除

// 位置・速度の初期設定
sps.particles.forEach(p => {
    p.position.x = (Math.random() - 0.5) * 1000;
    p.position.y = (Math.random() - 0.5) * 1000;
    p.position.z = (Math.random() - 0.5) * 1000;

    p.velocity = new BABYLON.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
    );
});

// アニメーション（粒子を動かす）
scene.registerBeforeRender(() => {
  const now = performance.now();

  // 背景用GLSLアニメ
  backgroundMaterial.setFloat("uTime", now * 0.001);

  // 投稿星のゆらぎ＋Planeの鼓動
const t = now * 0.002;
animatedPostStars.forEach(({ material, mesh, baseColor }, i) => {
  const pulse = 0.7 + 0.3 * Math.sin(t + i);

  // コアのゆらぎ（色）
  if (material) {
    material.emissiveColor = new BABYLON.Color3(
      baseColor.r * pulse,
      baseColor.g * pulse,
      baseColor.b * pulse
    );
  }

  // Planeの拡大縮小（鼓動）
  if (mesh) {
    mesh.scaling.setAll(pulse);
  }
});
   
  sps.particles.forEach(p => {
        p.position.addInPlace(p.velocity);

        // 範囲外に出たら戻す
        if (p.position.length() > 600) {
            p.position.scaleInPlace(0.5);
        }
    });
    sps.setParticles();
});

const planetTextures = [
  "/jupiter.jpg",
  "/saturn.jpg",
  "/neptune.jpg",
  "/mars.jpg"
];

const planetCount = 8;
for (let i = 0; i < planetCount; i++) {
    const planet = BABYLON.MeshBuilder.CreateSphere(`planet${i}`, {
        diameter: Math.random() * 100 + 100
    }, scene);

    planet.position.x = (Math.random() - 0.5) * 2000;
    planet.position.y = (Math.random() - 0.5) * 2000;
    planet.position.z = (Math.random() - 0.5) * 2000;

    const planetMaterial = new BABYLON.StandardMaterial(`planetMat${i}`, scene);
    const texturePath = planetTextures[Math.floor(Math.random() * planetTextures.length)];
    planetMaterial.diffuseTexture = new BABYLON.Texture(texturePath, scene);
    planetMaterial.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    planetMaterial.alpha = 1.0;
    planet.material = planetMaterial;
}



// 9. ポインター検知
const hoverBubble = document.getElementById("hoverBubble");
scene.onPointerObservable.add((pointerInfo) => {
  switch (pointerInfo.type) {
      case BABYLON.PointerEventTypes.POINTERMOVE:
          const pickResult = scene.pick(scene.pointerX, scene.pointerY);

          if (pickResult?.hit && pickResult.pickedMesh?.name?.includes("postCore")) {
            const matchedPost = allPosts.find((p, idx) => `postCore${idx}` === pickResult.pickedMesh.name);
            if (matchedPost) {
              hoverBubble.style.display = "block";
              hoverBubble.innerText = matchedPost.dream_text_en || "A dream is glowing...";
              console.log("[Step5] pick結果:", pickResult?.pickedMesh?.name);    
              hoverBubble.style.left = `${pointerInfo.event.clientX + 12}px`;
              hoverBubble.style.top = `${pointerInfo.event.clientY - 40}px`;
            }
          } else {
            hoverBubble.style.display = "none";
          }
          break;
    
        case BABYLON.PointerEventTypes.POINTEROUT:
          hoverBubble.style.display = "none";
          break;

          case BABYLON.PointerEventTypes.POINTERDOWN:
  const pickResultTap = scene.pick(scene.pointerX, scene.pointerY);

  if (pickResultTap?.hit && pickResultTap.pickedMesh?.name?.includes("postCore")) {
    const matchedPostTap = allPosts.find((p, idx) => `postCore${idx}` === pickResultTap.pickedMesh.name);
    if (matchedPostTap) {
      hoverBubble.style.display = "block";
      hoverBubble.innerText = matchedPostTap.dream_text_en || "A dream is glowing...";
      hoverBubble.style.left = `${pointerInfo.event.clientX + 12}px`;
      hoverBubble.style.top = `${pointerInfo.event.clientY - 40}px`;
    }
  } else {
    hoverBubble.style.display = "none";
  }
  break;

      }
    });

// 7. レンダーループ
engine.runRenderLoop(() => {
    scene.render();
});

// 8. 画面リサイズ対応
window.addEventListener('resize', () => {
    engine.resize();
});

const hour = new Date().getHours();
let timeLine = "";

if (hour < 6) {
  timeLine = "The stars are still asleep… 🌙";
} else if (hour < 12) {
  timeLine = "Good morning! Fresh dreams await ☀️";
} else if (hour < 18) {
  timeLine = "Good afternoon! The stars are watching 🌈";
} else {
  timeLine = "Back again under the evening sky? 🌌";
}

const foxLines = [
  { text: timeLine, mood: "think" },
  { text: "Welcome to the Dream Constellation! 🌌", mood: "happy" },
  { text: "Hmm... this star feels mysterious.", mood: "think" },
  { text: "Whoa! That one just blinked! 😲", mood: "surprise" },
  { text: "Even tiny dreams shine bright in here. 💫", mood: "idle" },
  { text: "This universe holds unspoken dreams…", mood: "think" },
  { text: "Even the tiniest spark can light up the dark. 💫", mood: "happy" },
  { text: "Hmm... I sense a new dream nearby.", mood: "think" },
  { text: "Whoa! A shooting star passed by!", mood: "surprise" },
  { text: "You can talk to stars, you know. Just whisper. 🌠", mood: "think" },
  { text: "That one over there… it's glowing for you.", mood: "happy" },
  { text: "Something magical is about to happen.", mood: "surprise" },
  { text: "I’m listening. Your dream matters.", mood: "happy" },
  { text: "The stars have secrets, and I keep them all. 🤫", mood: "think" },
  { text: "Want to know a secret? I have a dream too.", mood: "happy" },
  { text: "Somewhere in this sky… someone just wished.", mood: "think" },
  { text: "Whoa! I felt that sparkle in my tail! ⚡️", mood: "surprise" },
  { text: "Dreams are like stars—some flicker, some burn. All shine.", mood: "think" },
  { text: "${userName}, did you feel that heartbeat? That was a dream.", mood: "surprise" },
  { text: "Keep dreaming. The universe is listening. 🌌", mood: "happy" }
];

function showRandomFoxLine() {
  const bubble = document.getElementById("moonFoxBubble");
  const random = foxLines[Math.floor(Math.random() * foxLines.length)];
  const userName = localStorage.getItem("myUserName") || "you";
  const personalizedText = random.text.replaceAll("${userName}",userName);

  bubble.style.opacity = 0;
  setTimeout(() => {
    bubble.innerText = personalizedText;
    bubble.style.opacity = 1;
    setFoxImage(random.mood); 
  }, 200);
}

// イベント登録（フィルター変更時に呼び出す）
document.getElementById('categorySelect')?.addEventListener('change', updatePostStarsDisplay);
document.querySelectorAll('.tagCheckbox').forEach(cb => {
  cb.addEventListener('change', updatePostStarsDisplay);
});

// 💬 Moon Fox ガイド用のタグ別セリフ集
const foxTagLines = {
  "#Courage": { text: "I sense bravery blooming… 💪", mood: "happy" },
  "#Cosmos": { text: "The universe is vast and waiting. 🌌", mood: "think" },
  "#Healing": { text: "A gentle light is shining… 🌿", mood: "happy" },
  "#Rebirth": { text: "Something is being reborn. ✨", mood: "surprise" },
  "#Nature": { text: "I smell the forest... 🍃", mood: "think" },
  "#Technology": { text: "Wires hum... something’s awakening. 🤖", mood: "think" },
  "#Art": { text: "A spark of beauty... I see it! 🎨", mood: "happy" },
  "#Music": { text: "I hear a melody from a dream. 🎵", mood: "think" },
  "#Friendship": { text: "That one feels warm… like a friend. 🤝", mood: "happy" },
  "#FutureSelf": { text: "A future version of you just smiled. 🔮", mood: "think" },
  "#Freedom": { text: "Wings spread… I feel flight coming. 🕊️", mood: "happy" },
  "#Flying": { text: "Something just lifted off the ground! 🚀", mood: "surprise" },
  "#DreamLoop": { text: "Deja vu? This dream loops again… ♻️", mood: "think" }
};

// ✅ タグ変更時にMoon Foxが反応するように追加
const tagCheckboxes = document.querySelectorAll('.tagCheckbox');
tagCheckboxes.forEach(cb => {
  cb.addEventListener('change', () => {
    updatePostStarsDisplay();

    if (cb.checked && foxTagLines[cb.value]) {
      const { text, mood } = foxTagLines[cb.value];
      showFoxReaction(text, mood);
    }
  });
});

function showFoxReaction(text, mood = "idle") {
  const bubble = document.getElementById("moonFoxBubble");
  bubble.innerText = text;
  setFoxImage(mood);
  setTimeout(() => {
    setFoxImage("idle");
  }, 3000);
}

// 初期表示＆ループ（6秒ごと）
showRandomFoxLine();
setInterval(showRandomFoxLine, 6000);

// 最初に一度だけSupabaseから取得して描画
updatePostStarsDisplay();

// 投稿星の確認
scene.meshes.filter(m => m.name.includes("postCore"))

window.updatePostStarsDisplay = updatePostStarsDisplay;

document.getElementById("showAllBtn").addEventListener("click", () => {
  isMyConstellation = false;
  updatePostStarsDisplay();
});

document.getElementById("showMineBtn").addEventListener("click", () => {
  isMyConstellation = true;
  updatePostStarsDisplay();
});