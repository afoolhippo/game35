"use strict";

const {
  Engine,
  Render,
  Runner,
  Bodies,
  Composite,
  Events,
} = Matter;

const GAME_ID = "game35";
const GAME_TITLE = "カバキャッチャー";

const SUPABASE_URL =
  "https://gmncxnybsovlallxgnkd.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_ly3h5OhL8HDSHhYdmJq_Fw_9pG3mhla";

const kabaDb = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const titleScreen = document.getElementById("titleScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");

const titleImage = document.getElementById("titleImage");
const startBtn = document.getElementById("startBtn");
const backTitleBtn = document.getElementById("backTitleBtn");

const gameArea = document.getElementById("gameArea");
const craneEl = document.getElementById("crane");
const shotText = document.getElementById("shotText");
const scoreText = document.getElementById("scoreText");
const messageEl = document.getElementById("message");

const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const dropBtn = document.getElementById("dropBtn");

const resultImage = document.getElementById("resultImage");
const resultTitle = document.getElementById("resultTitle");
const resultScore = document.getElementById("resultScore");
const resultButtons = document.getElementById("resultButtons");

const shareButton = document.getElementById("shareButton");
const registerButton = document.getElementById("registerButton");
const retryButton = document.getElementById("retryButton");
const arcadeButton = document.getElementById("arcadeButton");

let engine = null;
let render = null;
let runner = null;

let width = 360;
let height = 480;

let craneX = 180;
let shotCount = 0;
let score = 0;
let dropping = false;
let gameOver = false;
let canCollect = false;

let sprites = [];
let weights = [];
let allPrizes = [];

let lastTitle = "";
let lastScore = 0;
let scoreRegistered = false;

let settleTimer = null;

const MAX_SHOTS = 3;
const PRIZE_SIZE = 48;
const WEIGHT_SIZE = 36;

const MIN_FINAL_WAIT = 3000;
const MAX_FINAL_WAIT = 8000;
const STILL_CHECK_INTERVAL = 250;
const STILL_REQUIRED_MS = 1250;
const STILL_SPEED = 0.22;
const STILL_ANGULAR_SPEED = 0.025;

const PRIZES = {
  normal: {
    texture: "plush_normal.png",
    point: 1,
  },
  sunglasses: {
    texture: "plush_sunglasses.png",
    point: 5,
  },
  crown: {
    texture: "plush_crown.png",
    point: 10,
  },
};

const bgm = new Audio("bgm.mp3");
bgm.loop = true;
bgm.volume = 0.45;

const dropSe = new Audio("drop.mp3");
dropSe.volume = 0.72;

const getSePool = Array.from({ length: 8 }, () => {
  const audio = new Audio("get.mp3");
  audio.volume = 0.62;
  return audio;
});
let getSeIndex = 0;

function playBgm() {
  bgm.currentTime = 0;
  bgm.play().catch(() => {});
}

function stopBgm() {
  bgm.pause();
  bgm.currentTime = 0;
}

function playDropSe() {
  dropSe.currentTime = 0;
  dropSe.play().catch(() => {});
}

function playGetSe(point) {
  const audio = getSePool[getSeIndex];
  getSeIndex = (getSeIndex + 1) % getSePool.length;

  audio.pause();
  audio.currentTime = 0;

  if (point >= 10) {
    audio.playbackRate = 1.25;
  } else if (point >= 5) {
    audio.playbackRate = 1.1;
  } else {
    audio.playbackRate = 1;
  }

  audio.play().catch(() => {});
}

function showScreen(screen) {
  [titleScreen, gameScreen, resultScreen].forEach((s) => {
    s.classList.remove("active");
  });

  screen.classList.add("active");
}

function resetResultButtons() {
  scoreRegistered = false;
  registerButton.disabled = false;
  registerButton.textContent = "記録を登録";
  resultButtons.classList.add("hidden");
}

function showResultButtonsLater() {
  resultButtons.classList.add("hidden");

  setTimeout(() => {
    resultButtons.classList.remove("hidden");
  }, 1500);
}

function startGame() {
  cleanupMatter();
  resetResultButtons();

  stopBgm();

  shotCount = 0;
  score = 0;
  dropping = false;
  gameOver = false;
  canCollect = false;

  weights = [];
  allPrizes = [];

  shotText.textContent = "1";
  scoreText.textContent = "0";
  messageEl.textContent = "位置を決めてDROP！";

  showScreen(gameScreen);

  setTimeout(() => {
    setupWorld();
    playBgm();
  }, 80);
}

function setupWorld() {
  gameArea.innerHTML = "";
  sprites = [];

  width = gameArea.clientWidth;
  height = gameArea.clientHeight;
  craneX = width / 2;

  engine = Engine.create();
  engine.gravity.y = 0.96;

  render = Render.create({
    element: gameArea,
    engine,
    options: {
      width,
      height,
      wireframes: false,
      background: "transparent",
      pixelRatio: window.devicePixelRatio || 1,
    },
  });

  const wallThickness = 44;
  const floorY = height - 22;

  const leftWall = Bodies.rectangle(
    -22,
    height / 2,
    wallThickness,
    height,
    {
      isStatic: true,
      render: { visible: false },
    }
  );

  const rightWall = Bodies.rectangle(
    width + 22,
    height / 2,
    wallThickness,
    height,
    {
      isStatic: true,
      render: { visible: false },
    }
  );

  /*
    左右端が出口。
    中央の広い床上に景品を積む。
  */
  const floorCenter = Bodies.rectangle(
    width / 2,
    floorY,
    width * 0.72,
    wallThickness,
    {
      isStatic: true,
      render: {
        fillStyle: "#37434a",
        strokeStyle: "#263238",
        lineWidth: 2,
      },
    }
  );

  const exitLeft = Bodies.rectangle(
    width * 0.07,
    height + 22,
    width * 0.15,
    64,
    {
      isStatic: true,
      isSensor: true,
      label: "exit",
      render: { visible: false },
    }
  );

  const exitRight = Bodies.rectangle(
    width * 0.93,
    height + 22,
    width * 0.15,
    64,
    {
      isStatic: true,
      isSensor: true,
      label: "exit",
      render: { visible: false },
    }
  );

  Composite.add(engine.world, [
    leftWall,
    rightWall,
    floorCenter,
    exitLeft,
    exitRight,
  ]);

  createPrizePile();

  Events.on(engine, "collisionStart", (event) => {
    event.pairs.forEach((pair) => {
      const a = pair.bodyA;
      const b = pair.bodyB;

      if (a.label === "exit" && b.plugin?.kind === "prize") {
        collectPrize(b);
      }

      if (b.label === "exit" && a.plugin?.kind === "prize") {
        collectPrize(a);
      }
    });
  });

  Events.on(engine, "afterUpdate", syncSprites);

  Render.run(render);

  runner = Runner.create();
  Runner.run(runner, engine);

  syncCrane();

  /*
    初期配置の微小な揺れが落下判定にならないよう、
    まず景品を少し落ち着かせる。
  */
  setTimeout(() => {
    canCollect = true;
  }, 1200);
}

function createPrizePile() {
  const list = [
    ...Array(18).fill("normal"),
    ...Array(3).fill("sunglasses"),
    "crown",
  ];

  shuffle(list);

  /*
    22個。
    下段ほど多く、中央床から大きくはみ出さない配置。
    各プレイで少しだけ位置を変えて山の形を変える。
  */
  const rows = [6, 5, 5, 4, 2];
  const gapX = 45;
  const gapY = 44;
  const baseY = height - 75;
  const centerX = width / 2;

  let index = 0;

  rows.forEach((count, row) => {
    const rowWidth = (count - 1) * gapX;

    const rowShift =
      row === 0
        ? rand(-5, 5)
        : rand(-10, 10);

    const startX =
      centerX -
      rowWidth / 2 +
      rowShift;

    for (let i = 0; i < count; i++) {
      const typeName = list[index];
      index += 1;

      const x =
        startX +
        i * gapX +
        rand(-2.5, 2.5);

      const y =
        baseY -
        row * gapY +
        rand(-1.5, 1.5);

      createPrize(typeName, x, y);
    }
  });
}

function createPrize(typeName, x, y) {
  const type = PRIZES[typeName];

  const body = Bodies.rectangle(
    x,
    y,
    PRIZE_SIZE,
    PRIZE_SIZE,
    {
      chamfer: { radius: 8 },
      restitution: 0.01,
      friction: 0.92,
      frictionStatic: 1.1,
      frictionAir: 0.02,
      density: 0.0023,
      label: `prize_${typeName}`,
      render: {
        fillStyle: "transparent",
        strokeStyle: "transparent",
      },
    }
  );

  body.plugin = {
    kind: "prize",
    type: typeName,
    point: type.point,
    texture: type.texture,
    collected: false,
  };

  Composite.add(engine.world, body);
  allPrizes.push(body);

  createSprite(body, type.texture, PRIZE_SIZE);
}

function createSprite(body, src, size) {
  const img = document.createElement("img");

  img.className = "prizeSprite";
  img.src = src;
  img.alt = "";
  img.style.width = `${size}px`;
  img.style.height = `${size}px`;
  img.style.imageRendering = "pixelated";

  gameArea.appendChild(img);

  sprites.push({
    body,
    el: img,
    size,
  });
}

function syncSprites() {
  sprites.forEach((item) => {
    const { body, el, size } = item;

    if (!body || !el || body.plugin?.collected) {
      if (el) {
        el.style.display = "none";
      }
      return;
    }

    el.style.display = "block";
    el.style.left =
      `${body.position.x - size / 2}px`;

    el.style.top =
      `${body.position.y - size / 2}px`;

    el.style.transform =
      `rotate(${body.angle}rad)`;
  });
}

function collectPrize(body) {
  if (!canCollect) return;
  if (!body || body.plugin.collected) return;

  body.plugin.collected = true;

  score += body.plugin.point;
  scoreText.textContent = String(score);

  playGetSe(body.plugin.point);
  showScorePopup(body.position.x, body.plugin.point);

  const sprite = sprites.find(
    (item) => item.body === body
  );

  if (sprite?.el) {
    sprite.el.remove();
  }

  Composite.remove(engine.world, body);
}

function showScorePopup(x, point) {
  const popup = document.createElement("div");

  popup.className =
    point >= 5
      ? "scorePopup big"
      : "scorePopup";

  popup.textContent =
    point >= 10
      ? "+10!!"
      : point >= 5
        ? "+5!"
        : "+1";

  popup.style.left =
    `${Math.max(48, Math.min(width - 48, x))}px`;

  popup.style.top =
    `${Math.max(110, height - 125)}px`;

  gameArea.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 1050);
}

function moveCrane(direction) {
  if (dropping || gameOver) return;

  craneX += direction * 24;

  craneX = Math.max(
    36,
    Math.min(width - 36, craneX)
  );

  syncCrane();
}

function syncCrane() {
  craneEl.style.left = `${craneX}px`;
}

function dropWeight() {
  if (dropping || gameOver) return;
  if (shotCount >= MAX_SHOTS) return;

  dropping = true;
  shotCount += 1;

  playDropSe();

  messageEl.textContent =
    shotCount === MAX_SHOTS
      ? "ラスト！"
      : `SHOT ${shotCount}！`;

  const weight = Bodies.rectangle(
    craneX,
    58,
    WEIGHT_SIZE,
    WEIGHT_SIZE,
    {
      chamfer: { radius: 6 },
      restitution: 0.005,
      friction: 0.86,
      frictionStatic: 1.1,
      frictionAir: 0.012,
      density: 0.037,
      label: "weight",
      render: {
        fillStyle: "#555",
        strokeStyle: "#263238",
        lineWidth: 3,
      },
    }
  );

  Composite.add(engine.world, weight);
  weights.push(weight);

  if (shotCount < MAX_SHOTS) {
    setTimeout(() => {
      dropping = false;

      shotText.textContent =
        String(shotCount + 1);

      messageEl.textContent =
        "次の位置を決めよう！";
    }, 1700);

    return;
  }

  /*
    3発目は固定時間で終わらせない。
    最低3秒待った後、景品・重りの速度を監視。
    約1.25秒静止が続けば終了。
    最大8秒で強制終了。
  */
  messageEl.textContent =
    "ラスト！落ちきるまで待とう…";

  waitForPhysicsToSettle();
}

function waitForPhysicsToSettle() {
  const startTime = performance.now();
  let stillSince = null;

  clearSettleTimer();

  settleTimer = setInterval(() => {
    if (!engine || gameOver) {
      clearSettleTimer();
      return;
    }

    const elapsed =
      performance.now() - startTime;

    if (elapsed >= MAX_FINAL_WAIT) {
      clearSettleTimer();
      endGame();
      return;
    }

    if (elapsed < MIN_FINAL_WAIT) {
      return;
    }

    const bodiesToWatch = [
      ...allPrizes.filter(
        (body) =>
          !body.plugin?.collected &&
          Composite.get(engine.world, body.id, "body")
      ),
      ...weights.filter(
        (body) =>
          Composite.get(engine.world, body.id, "body")
      ),
    ];

    if (bodiesToWatch.length === 0) {
      clearSettleTimer();
      endGame();
      return;
    }

    const isStill =
      bodiesToWatch.every((body) => {
        return (
          body.speed < STILL_SPEED &&
          Math.abs(body.angularSpeed) <
            STILL_ANGULAR_SPEED
        );
      });

    if (isStill) {
      if (stillSince === null) {
        stillSince = performance.now();
      }

      if (
        performance.now() - stillSince >=
        STILL_REQUIRED_MS
      ) {
        clearSettleTimer();
        endGame();
      }
    } else {
      stillSince = null;
    }
  }, STILL_CHECK_INTERVAL);
}

function clearSettleTimer() {
  if (settleTimer) {
    clearInterval(settleTimer);
    settleTimer = null;
  }
}

function endGame() {
  if (gameOver) return;

  gameOver = true;
  clearSettleTimer();

  stopBgm();

  let title = "";
  let img = "";

  if (score <= 8) {
    title = "見習いクレーン係";
    img = "result1.png";
  } else if (score <= 24) {
    title = "ぬいぐるみハンター";
    img = "result2.png";
  } else {
    title = "伝説のカバ捕獲王";
    img = "result3.png";
  }

  lastTitle = title;
  lastScore = score;

  resultImage.src = img;
  resultTitle.textContent = title;
  resultScore.textContent = `${score}点`;

  cleanupMatter();

  showScreen(resultScreen);
  showResultButtonsLater();
}

function cleanupMatter() {
  clearSettleTimer();

  if (render) {
    Render.stop(render);

    if (render.canvas) {
      render.canvas.remove();
    }

    render.textures = {};
    render = null;
  }

  if (runner) {
    Runner.stop(runner);
    runner = null;
  }

  if (engine) {
    Composite.clear(engine.world, false);
    Engine.clear(engine);
    engine = null;
  }

  sprites.forEach((item) => {
    if (item.el) {
      item.el.remove();
    }
  });

  gameArea
    .querySelectorAll(".scorePopup")
    .forEach((el) => el.remove());

  sprites = [];
  weights = [];
  allPrizes = [];
}

function backToTitle() {
  stopBgm();
  cleanupMatter();
  resetResultButtons();
  showScreen(titleScreen);
}

function shareResult() {
  const text =
`カバぬい、雪崩れました🦛🧸

${lastScore}点

無料ブラウザゲーム
「カバキャッチャー」

https://afoolhippo.github.io/game35/

#カバキャッチャー
#カバゲーセン`;

  const url =
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

  window.open(url, "_blank");
}

async function registerScore() {
  if (scoreRegistered) {
    alert("この記録は登録済みです");
    return;
  }

  const nickname = prompt(
    "ニックネームを入力してね",
    "匿名カバ"
  );

  if (!nickname) return;

  registerButton.disabled = true;
  registerButton.textContent = "登録中...";

  const { error } = await kabaDb
    .from("kaba_scores")
    .insert({
      game_id: GAME_ID,
      game_title: GAME_TITLE,
      nickname,
      rank_title: lastTitle,
      score: lastScore,
    });

  if (error) {
    console.error(error);

    registerButton.disabled = false;
    registerButton.textContent = "記録を登録";

    alert("登録に失敗しました");
    return;
  }

  scoreRegistered = true;
  registerButton.textContent = "登録済み";

  alert("記録を登録しました！");
}

function shuffle(array) {
  for (
    let i = array.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(Math.random() * (i + 1));

    [array[i], array[j]] =
      [array[j], array[i]];
  }

  return array;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

titleImage.addEventListener(
  "click",
  startGame
);

startBtn.addEventListener(
  "click",
  startGame
);

backTitleBtn.addEventListener(
  "click",
  backToTitle
);

leftBtn.addEventListener(
  "click",
  () => moveCrane(-1)
);

rightBtn.addEventListener(
  "click",
  () => moveCrane(1)
);

dropBtn.addEventListener(
  "click",
  dropWeight
);

shareButton.addEventListener(
  "click",
  shareResult
);

registerButton.addEventListener(
  "click",
  registerScore
);

retryButton.addEventListener(
  "click",
  startGame
);

arcadeButton.addEventListener(
  "click",
  () => {
    window.location.href =
      "https://afoolhippo.github.io/home/?skipTitle=1";
  }
);

window.addEventListener(
  "keydown",
  (e) => {
    if (
      !gameScreen.classList.contains("active")
    ) {
      return;
    }

    if (e.key === "ArrowLeft") {
      moveCrane(-1);
    }

    if (e.key === "ArrowRight") {
      moveCrane(1);
    }

    if (
      e.key === " " ||
      e.key === "Enter"
    ) {
      e.preventDefault();
      dropWeight();
    }
  }
);

window.addEventListener(
  "resize",
  () => {
    if (
      gameScreen.classList.contains("active")
    ) {
      startGame();
    }
  }
);
