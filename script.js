/* 贪吃蛇 · 闯关版 —— 原生 HTML / CSS / JavaScript 实现，无任何第三方依赖 */
(function () {
  'use strict';

  /* ================= 一、常量配置 ================= */
  const COLS = 48;             // 横向格子数
  const ROWS = 48;             // 纵向格子数
  const CELL = 20;             // 每格逻辑像素
  const BOARD = COLS * CELL;   // 棋盘逻辑边长（960）

  const APPLES_PER_LEVEL = 5;  // 每吃多少个苹果升一级
  const STAGE_TARGET = 8;      // 每关需要吃掉的苹果数
  const GOLDEN_TTL = 7000;     // 金苹果存活时间（毫秒）
  const MAX_QUEUE = 2;         // 方向输入缓冲长度
  const STAGE_COUNTDOWN = 2600; // 关卡过场倒计时（毫秒）

  const SCORE_KEY = 'snake-best-score-v1';
  const SOUND_KEY = 'snake-sound-v1';
  const LEVELUP_KEY = 'snake-level-ups-v1';
  const PLAYS_KEY = 'snake-plays-v1';
  const DIFF_KEY = 'snake-difficulty-v1';

  // 难度：影响基础速度、最快速度、升级加速幅度与金苹果概率
  const DIFFICULTIES = {
    easy:   { label: '简单', base: 210, min: 110, step: 9, golden: 0.26 },
    normal: { label: '普通', base: 165, min: 85,  step: 9, golden: 0.18 },
    hard:   { label: '困难', base: 125, min: 65,  step: 8, golden: 0.12 }
  };

  // 十个关卡：障碍布局按 48 × 48 棋盘生成
  const STAGES = [
    { name: '空场',     desc: '一片开阔的空地，先熟悉操作。',       walls: [] },
    { name: '十字路口', desc: '横竖两道石墙横在中央，注意绕行。',   walls: wallPlus() },
    { name: '四方阵',   desc: '四角各有一座石阵，中间留出行走空间。', walls: wallBlocks() },
    { name: '回字迷宫', desc: '环形围墙只留四处缺口，考验走位。',   walls: wallRing() },
    { name: '双闸回廊', desc: '两道长墙开出方向相反的缺口，找准节奏穿越。', walls: wallGates() },
    { name: '交错过道', desc: '三道长墙错位开口，在狭窄通道间上下穿行。', walls: wallLanes() },
    { name: '风车回廊', desc: '四道折墙组成风车，沿着旋转的缺口绕行。', walls: wallPinwheel() },
    { name: '双环锁阵', desc: '内外两圈石墙各留四门，需要连续穿越两层防线。', walls: wallDoubleRing() },
    { name: '蜂巢石阵', desc: '散布的石柱切碎路线，蛇身越长越考验走位。', walls: wallPillars() },
    { name: '王座终局', desc: '穿过外环、绕开守卫，在王座前完成最后挑战。', walls: wallFortress() }
  ];

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  /* ---------- 关卡障碍定义 ---------- */
  function wallPlus() {
    const cells = [];
    for (let y = 6; y <= 41; y++) cells.push({ x: 24, y: y });
    for (let x = 14; x <= 33; x++) cells.push({ x: x, y: 24 });
    return cells;
  }

  function wallBlocks() {
    const cells = [];
    const corners = [[9, 9], [33, 9], [9, 33], [33, 33]];
    for (let c = 0; c < corners.length; c++) {
      const bx = corners[c][0];
      const by = corners[c][1];
      for (let y = by; y < by + 6; y++) {
        for (let x = bx; x < bx + 6; x++) cells.push({ x: x, y: y });
      }
    }
    return cells;
  }

  function wallRing() {
    const cells = [];
    const min = 8;
    const max = 39;
    const gapFrom = 22;
    const gapTo = 26;
    for (let x = min; x <= max; x++) {
      if (x < gapFrom || x > gapTo) {
        cells.push({ x: x, y: min });
        cells.push({ x: x, y: max });
      }
    }
    for (let y = min; y <= max; y++) {
      if (y < gapFrom || y > gapTo) {
        cells.push({ x: min, y: y });
        cells.push({ x: max, y: y });
      }
    }
    // 中央的实心方块
    for (let y = 20; y <= 27; y++) {
      for (let x = 20; x <= 27; x++) cells.push({ x: x, y: y });
    }
    return cells;
  }

  function addWallRect(cells, x, y, width, height) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        cells.push({ x: x + dx, y: y + dy });
      }
    }
  }

  function wallGates() {
    const cells = [];

    // 左侧长墙只保留中央缺口，右侧长墙则留出上下两个缺口。
    for (let y = 6; y <= 41; y++) {
      if (y < 17 || y > 29) cells.push({ x: 15, y: y });
      if (y < 13 || (y > 19 && y < 33) || y > 39) cells.push({ x: 33, y: y });
    }

    addWallRect(cells, 7, 8, 3, 3);
    addWallRect(cells, 38, 37, 3, 3);
    return cells;
  }

  function wallLanes() {
    const cells = [];
    const lanes = [
      { y: 11, gaps: [[15, 20], [32, 37]] },
      { y: 23, gaps: [[8, 13], [28, 33]] },
      { y: 35, gaps: [[18, 23], [39, 44]] }
    ];

    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      for (let x = 0; x < COLS; x++) {
        let isGap = false;
        for (let g = 0; g < lane.gaps.length; g++) {
          if (x >= lane.gaps[g][0] && x <= lane.gaps[g][1]) isGap = true;
        }
        if (!isGap) cells.push({ x: x, y: lane.y });
      }
    }

    return cells;
  }

  function wallPinwheel() {
    const cells = [];

    addWallRect(cells, 18, 8, 2, 17);
    addWallRect(cells, 18, 18, 15, 2);
    addWallRect(cells, 29, 24, 2, 17);
    addWallRect(cells, 16, 29, 15, 2);
    addWallRect(cells, 23, 22, 2, 5);
    return cells;
  }

  function wallDoubleRing() {
    const cells = [];
    const rings = [
      { min: 6, max: 41, gapFrom: 21, gapTo: 26 },
      { min: 15, max: 32, gapFrom: 22, gapTo: 25 }
    ];

    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r];
      for (let x = ring.min; x <= ring.max; x++) {
        if (x < ring.gapFrom || x > ring.gapTo) {
          cells.push({ x: x, y: ring.min });
          cells.push({ x: x, y: ring.max });
        }
      }
      for (let y = ring.min; y <= ring.max; y++) {
        if (y < ring.gapFrom || y > ring.gapTo) {
          cells.push({ x: ring.min, y: y });
          cells.push({ x: ring.max, y: y });
        }
      }
    }

    return cells;
  }

  function wallPillars() {
    const cells = [];
    const pillars = [
      [9, 8], [22, 8], [35, 8],
      [14, 16], [28, 16], [40, 16],
      [7, 25], [20, 25], [34, 25],
      [13, 34], [27, 34], [40, 34],
      [20, 41]
    ];

    for (let i = 0; i < pillars.length; i++) {
      addWallRect(cells, pillars[i][0], pillars[i][1], 4, 4);
    }
    return cells;
  }

  function wallFortress() {
    const cells = [];
    const min = 7;
    const max = 40;
    const gapFrom = 21;
    const gapTo = 26;

    for (let x = min; x <= max; x++) {
      if (x < gapFrom || x > gapTo) {
        cells.push({ x: x, y: min });
        cells.push({ x: x, y: max });
      }
    }
    for (let y = min; y <= max; y++) {
      if (y < gapFrom || y > gapTo) {
        cells.push({ x: min, y: y });
        cells.push({ x: max, y: y });
      }
    }

    // 中央王座与四向守卫。
    addWallRect(cells, 22, 22, 4, 4);
    addWallRect(cells, 23, 13, 2, 7);
    addWallRect(cells, 23, 28, 2, 7);
    addWallRect(cells, 13, 23, 7, 2);
    addWallRect(cells, 28, 23, 7, 2);

    addWallRect(cells, 11, 11, 3, 3);
    addWallRect(cells, 34, 11, 3, 3);
    addWallRect(cells, 11, 34, 3, 3);
    addWallRect(cells, 34, 34, 3, 3);
    return cells;
  }

  /* ================= 二、DOM 与画布 ================= */
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');

  const els = {
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    stage: document.getElementById('stage'),
    level: document.getElementById('level'),
    length: document.getElementById('length'),
    upgrades: document.getElementById('upgrades'),
    plays: document.getElementById('plays'),
    difficultyText: document.getElementById('difficultyText'),
    overlay: document.getElementById('overlay'),
    overlayEmoji: document.getElementById('overlayEmoji'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlayText: document.getElementById('overlayText'),
    overlayBtn: document.getElementById('overlayBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    restartBtn: document.getElementById('restartBtn'),
    soundBtn: document.getElementById('soundBtn')
  };

  const diffButtons = document.querySelectorAll('.seg-btn');

  /* ================= 三、游戏状态 ================= */
  const state = {
    snake: [],                    // 蛇身坐标数组，索引 0 为蛇头
    dir: DIRS.right,              // 当前方向
    queue: [],                    // 待执行的方向指令
    food: null,                   // 当前食物 { x, y, type, expiresAt }
    walls: new Set(),             // 当前关卡的障碍格子
    grow: 0,                      // 额外生长节数
    score: 0,
    best: 0,
    level: 1,
    apples: 0,                    // 本局吃掉的苹果总数
    stageApples: 0,               // 本关吃掉的苹果数
    stage: 1,
    levelUps: 0,                  // 累计升级次数（跨局保存）
    plays: 0,                     // 累计开局次数（跨局保存）
    difficulty: 'normal',
    speed: DIFFICULTIES.normal.base,
    status: 'ready',              // ready | running | paused | stage | over
    sound: true,
    acc: 0,                       // 步进计时器
    stageTimer: 0,                // 关卡过场倒计时
    stageShown: -1                // 已显示过的秒数，避免重复写 DOM
  };

  let lastTime = 0;
  let wallLayer = null;           // 障碍物离屏画布，每关只绘制一次

  /* ================= 四、通用工具 ================= */
  function clampNum(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hexToRgb(hex) {
    let value = hex.replace('#', '');
    if (value.length === 3) {
      value = value.split('').map(function (c) { return c + c; }).join('');
    }
    const num = parseInt(value, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function mixColor(from, to, t) {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    const r = Math.round(a.r + (b.r - a.r) * t);
    const g = Math.round(a.g + (b.g - a.g) * t);
    const bl = Math.round(a.b + (b.b - a.b) * t);
    return 'rgb(' + r + ', ' + g + ', ' + bl + ')';
  }

  function roundRect(c, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + radius, y);
    c.lineTo(x + w - radius, y);
    c.quadraticCurveTo(x + w, y, x + w, y + radius);
    c.lineTo(x + w, y + h - radius);
    c.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    c.lineTo(x + radius, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - radius);
    c.lineTo(x, y + radius);
    c.quadraticCurveTo(x, y, x + radius, y);
    c.closePath();
  }

  function isWall(x, y) {
    return state.walls.has(x + ',' + y);
  }

  /* ================= 五、绘制 ================= */
  function resizeCanvas() {
    const dpr = clampNum(window.devicePixelRatio || 1, 1, 2);
    const display = canvas.clientWidth || BOARD;
    canvas.width = Math.round(display * dpr);
    canvas.height = Math.round(display * dpr);
    const scale = (display * dpr) / BOARD;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    render(performance.now());
  }

  function drawBoard() {
    const gradient = ctx.createLinearGradient(0, 0, BOARD, BOARD);
    gradient.addColorStop(0, '#0c1626');
    gradient.addColorStop(1, '#0a1a1f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, BOARD, BOARD);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < COLS; i++) {
      const p = i * CELL + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, BOARD);
      ctx.moveTo(0, p);
      ctx.lineTo(BOARD, p);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(52, 211, 153, 0.35)';
    ctx.lineWidth = 2;
    roundRect(ctx, 1, 1, BOARD - 2, BOARD - 2, 10);
    ctx.stroke();
  }

  function buildWallLayer() {
    wallLayer = null;
    if (!state.walls.size) return;
    try {
      const layer = document.createElement('canvas');
      layer.width = BOARD;
      layer.height = BOARD;
      const lctx = layer.getContext('2d');
      if (!lctx) return;

      state.walls.forEach(function (key) {
        const parts = key.split(',');
        const px = Number(parts[0]) * CELL;
        const py = Number(parts[1]) * CELL;
        const gradient = lctx.createLinearGradient(px, py, px, py + CELL);
        gradient.addColorStop(0, '#4b5b78');
        gradient.addColorStop(1, '#2c3a55');
        lctx.fillStyle = gradient;
        lctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        lctx.fillStyle = 'rgba(226, 232, 240, 0.16)';
        lctx.fillRect(px + 1, py + 1, CELL - 2, 2);
      });
      wallLayer = layer;
    } catch (err) {
      wallLayer = null;
    }
  }

  function drawWalls() {
    if (wallLayer) {
      ctx.drawImage(wallLayer, 0, 0);
      return;
    }
    if (!state.walls.size) return;
    ctx.fillStyle = '#3b4a63';
    state.walls.forEach(function (key) {
      const parts = key.split(',');
      ctx.fillRect(Number(parts[0]) * CELL + 1, Number(parts[1]) * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  function drawFood(now) {
    const food = state.food;
    if (!food) return;

    const cx = (food.x + 0.5) * CELL;
    const cy = (food.y + 0.5) * CELL;
    const golden = food.type === 'golden';
    const pulse = 1 + Math.sin(now / 220) * (golden ? 0.1 : 0.05);
    const radius = CELL * 0.34 * pulse;

    if (golden) {
      const left = Math.max(0, food.expiresAt - now);
      const ratio = clampNum(left / GOLDEN_TTL, 0, 1);
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.47, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();

      const gradient = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, radius * 0.15, cx, cy, radius);
      gradient.addColorStop(0, '#fde68a');
      gradient.addColorStop(1, '#d97706');
      ctx.shadowColor = 'rgba(251, 191, 36, 0.9)';
      ctx.shadowBlur = 16;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      const gradient = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, radius * 0.15, cx, cy, radius);
      gradient.addColorStop(0, '#fca5a5');
      gradient.addColorStop(1, '#b91c1c');
      ctx.shadowColor = 'rgba(239, 68, 68, 0.75)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(cx - radius * 0.3, cy - radius * 0.35, radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSnake() {
    const total = state.snake.length;
    for (let i = total - 1; i >= 0; i--) {
      const seg = state.snake[i];
      const t = total <= 1 ? 0 : i / (total - 1);
      const pad = i === 0 ? 1.2 : 1.6;
      const size = CELL - pad * 2;

      ctx.shadowBlur = 0;
      if (i === 0) {
        ctx.fillStyle = '#4ade80';
        ctx.shadowColor = 'rgba(74, 222, 128, 0.85)';
        ctx.shadowBlur = 14;
      } else {
        ctx.fillStyle = mixColor('#34d399', '#0e7490', t);
      }
      roundRect(ctx, seg.x * CELL + pad, seg.y * CELL + pad, size, size, i === 0 ? 7 : 6);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    drawEyes();
  }

  function drawEyes() {
    const head = state.snake[0];
    if (!head) return;

    const cx = (head.x + 0.5) * CELL;
    const cy = (head.y + 0.5) * CELL;
    const dir = state.dir;
    const forward = CELL * 0.22;
    const side = CELL * 0.22;
    const eyes = [];

    if (dir.x !== 0) {
      eyes.push({ x: cx + dir.x * forward, y: cy - side });
      eyes.push({ x: cx + dir.x * forward, y: cy + side });
    } else {
      eyes.push({ x: cx - side, y: cy + dir.y * forward });
      eyes.push({ x: cx + side, y: cy + dir.y * forward });
    }

    for (let i = 0; i < eyes.length; i++) {
      const eye = eyes[i];
      ctx.fillStyle = '#eafff5';
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, CELL * 0.115, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#06281d';
      ctx.beginPath();
      ctx.arc(eye.x + dir.x * 1.2, eye.y + dir.y * 1.2, CELL * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render(now) {
    const time = typeof now === 'number' ? now : performance.now();
    ctx.clearRect(0, 0, BOARD, BOARD);
    drawBoard();
    drawWalls();
    drawFood(time);
    drawSnake();
  }

  /* ================= 六、音效 ================= */
  let audioCtx = null;

  function ensureAudio() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(function () { /* 忽略恢复失败 */ });
      }
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      audioCtx = new AudioCtor();
    } catch (err) {
      audioCtx = null;
    }
  }

  function tone(freq, duration, options) {
    if (!state.sound || !audioCtx) return;
    const opts = options || {};
    const start = audioCtx.currentTime + (opts.delay || 0);
    const volume = opts.volume === undefined ? 0.05 : opts.volume;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(freq, start);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(opts.slideTo, start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  const SOUNDS = {
    start: function () {
      tone(520, 0.09, { type: 'triangle' });
      tone(780, 0.12, { type: 'triangle', delay: 0.08 });
    },
    eat: function () {
      tone(660, 0.08, { type: 'square' });
      tone(990, 0.09, { type: 'square', delay: 0.06 });
    },
    golden: function () {
      tone(660, 0.08, { type: 'triangle' });
      tone(880, 0.08, { type: 'triangle', delay: 0.07 });
      tone(1180, 0.12, { type: 'triangle', delay: 0.14 });
    },
    level: function () {
      tone(680, 0.1, { type: 'sawtooth', volume: 0.035 });
      tone(1020, 0.14, { type: 'sawtooth', volume: 0.035, delay: 0.09 });
    },
    stage: function () {
      tone(560, 0.12, { type: 'triangle' });
      tone(840, 0.12, { type: 'triangle', delay: 0.1 });
      tone(1120, 0.18, { type: 'triangle', delay: 0.2 });
    },
    over: function () {
      tone(400, 0.18, { type: 'sawtooth', slideTo: 180 });
      tone(220, 0.32, { type: 'sawtooth', slideTo: 90, delay: 0.16 });
    }
  };

  function playSound(name) {
    const fn = SOUNDS[name];
    if (fn) fn();
  }

  /* ================= 七、本地存档 ================= */
  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch (err) {
      /* 隐私模式下可能写入失败，忽略即可 */
    }
  }

  function loadProgress() {
    state.best = parseInt(readStorage(SCORE_KEY), 10) || 0;
    state.levelUps = parseInt(readStorage(LEVELUP_KEY), 10) || 0;
    state.plays = parseInt(readStorage(PLAYS_KEY), 10) || 0;
    const diff = readStorage(DIFF_KEY);
    if (diff && DIFFICULTIES[diff]) state.difficulty = diff;
    if (readStorage(SOUND_KEY) === 'off') state.sound = false;
    state.speed = DIFFICULTIES[state.difficulty].base;
  }

  /* ================= 八、界面刷新 ================= */
  function updateHud() {
    els.score.textContent = state.score;
    els.best.textContent = state.best;
    els.stage.textContent = state.stage + ' / ' + STAGES.length;
    els.level.textContent = state.level;
    els.length.textContent = state.snake.length;
    els.upgrades.textContent = state.levelUps;
    els.plays.textContent = state.plays;
    els.difficultyText.textContent = DIFFICULTIES[state.difficulty].label;
  }

  function popEl(el) {
    el.classList.remove('pop');
    void el.offsetWidth; // 触发重排以重启动画
    el.classList.add('pop');
  }

  function updateSoundButton() {
    els.soundBtn.textContent = state.sound ? '音效：开' : '音效：关';
    els.soundBtn.classList.toggle('btn-ghost', !state.sound);
  }

  function updateDiffButtons() {
    for (let i = 0; i < diffButtons.length; i++) {
      const key = diffButtons[i].getAttribute('data-diff');
      diffButtons[i].classList.toggle('is-active', key === state.difficulty);
    }
  }

  function showOverlay(config) {
    els.overlayEmoji.textContent = config.emoji;
    els.overlayTitle.textContent = config.title;
    els.overlayText.textContent = config.text;
    els.overlayBtn.textContent = config.button;
    els.overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    els.overlay.classList.add('hidden');
  }

  /* ================= 九、关卡与食物 ================= */
  function spawnFood() {
    const occupied = new Set();
    for (let i = 0; i < state.snake.length; i++) {
      occupied.add(state.snake[i].x + ',' + state.snake[i].y);
    }

    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const key = x + ',' + y;
        if (occupied.has(key) || state.walls.has(key)) continue;
        free.push({ x: x, y: y });
      }
    }

    if (free.length === 0) {
      state.food = null;
      return;
    }

    const pick = free[Math.floor(Math.random() * free.length)];
    const golden = Math.random() < DIFFICULTIES[state.difficulty].golden;
    state.food = {
      x: pick.x,
      y: pick.y,
      type: golden ? 'golden' : 'normal',
      expiresAt: golden ? performance.now() + GOLDEN_TTL : Infinity
    };
  }

  function resetSnake() {
    const y = Math.floor(ROWS / 2);
    state.snake = [
      { x: 4, y: y },
      { x: 3, y: y },
      { x: 2, y: y }
    ];
    state.dir = DIRS.right;
    state.queue.length = 0;
    state.grow = 0;
    state.acc = 0;
  }

  function buildWalls(index) {
    state.walls = new Set();
    const layout = STAGES[index - 1];
    if (!layout) return;
    for (let i = 0; i < layout.walls.length; i++) {
      const cell = layout.walls[i];
      state.walls.add(cell.x + ',' + cell.y);
    }
  }

  // 进入某一关的静态准备：清空障碍、重摆蛇、重新生成食物
  function applyStage(index) {
    state.stage = index;
    state.stageApples = 0;
    buildWalls(index);
    buildWallLayer();
    resetSnake();
    state.food = null;
    spawnFood();
    updateHud();
  }

  function queueDir(next) {
    if (state.status !== 'running') return;
    const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir;
    const same = next.x === last.x && next.y === last.y;
    const reverse = next.x === -last.x && next.y === -last.y;
    if (same || reverse) return;
    if (state.queue.length >= MAX_QUEUE) return;
    state.queue.push(next);
  }

  function handleEat(food) {
    const golden = food.type === 'golden';
    state.score += golden ? 30 : 10;
    if (golden) state.grow += 1;
    state.apples += 1;
    state.stageApples += 1;

    // 升级
    const cfg = DIFFICULTIES[state.difficulty];
    const nextLevel = Math.floor(state.apples / APPLES_PER_LEVEL) + 1;
    if (nextLevel > state.level) {
      state.levelUps += nextLevel - state.level;
      state.level = nextLevel;
      state.speed = Math.max(cfg.min, cfg.base - (state.level - 1) * cfg.step);
      writeStorage(LEVELUP_KEY, state.levelUps);
      popEl(els.level);
      popEl(els.upgrades);
      playSound('level');
    } else {
      playSound(golden ? 'golden' : 'eat');
    }

    // 最高分
    if (state.score > state.best) {
      state.best = state.score;
      writeStorage(SCORE_KEY, state.best);
      popEl(els.best);
    }
    popEl(els.score);

    // 过关判定
    if (state.stageApples >= STAGE_TARGET) {
      if (state.stage < STAGES.length) {
        enterStage(state.stage + 1);
      } else {
        win();
      }
      updateHud();
      return;
    }

    spawnFood();
    updateHud();
    if (!state.food) win();
  }

  function step() {
    if (state.queue.length) {
      const next = state.queue.shift();
      if (!(next.x === -state.dir.x && next.y === -state.dir.y)) state.dir = next;
    }

    const head = state.snake[0];
    const nx = head.x + state.dir.x;
    const ny = head.y + state.dir.y;

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      gameOver('撞到墙壁了');
      return;
    }
    if (isWall(nx, ny)) {
      gameOver('撞到石墙了');
      return;
    }

    const willEat = !!state.food && state.food.x === nx && state.food.y === ny;
    const tailFree = !willEat && state.grow === 0;
    const limit = tailFree ? state.snake.length - 1 : state.snake.length;

    for (let i = 0; i < limit; i++) {
      const seg = state.snake[i];
      if (seg.x === nx && seg.y === ny) {
        gameOver('咬到自己的身体了');
        return;
      }
    }

    state.snake.unshift({ x: nx, y: ny });

    if (willEat) {
      handleEat(state.food);
    } else if (state.grow > 0) {
      state.grow -= 1;
      updateHud();
    } else {
      state.snake.pop();
    }
  }

  /* ================= 十、流程控制 ================= */
  function startGame() {
    ensureAudio();
    state.score = 0;
    state.level = 1;
    state.apples = 0;
    state.speed = DIFFICULTIES[state.difficulty].base;
    state.plays += 1;
    writeStorage(PLAYS_KEY, state.plays);
    applyStage(1);
    state.status = 'running';
    els.pauseBtn.textContent = '暂停';
    hideOverlay();
    playSound('start');
  }

  // 过关：先展示倒计时过场，再真正开始新一关
  function enterStage(index) {
    state.status = 'stage';
    state.stage = index;
    state.stageApples = 0;
    state.food = null;
    state.grow = 0;
    state.stageTimer = STAGE_COUNTDOWN;
    state.stageShown = -1;
    buildWalls(index);
    buildWallLayer();
    resetSnake();
    els.pauseBtn.textContent = '暂停';
    showOverlay({
      emoji: '🚩',
      title: '第 ' + index + ' 关 · ' + STAGES[index - 1].name,
      text: STAGES[index - 1].desc,
      button: '立即开始'
    });
    playSound('stage');
    updateHud();
  }

  function beginCurrentStage() {
    state.status = 'running';
    state.acc = 0;
    state.stageApples = 0;
    state.food = null;
    spawnFood();
    els.pauseBtn.textContent = '暂停';
    hideOverlay();
    updateHud();
    playSound('start');
  }

  function togglePause() {
    if (state.status === 'running') {
      state.status = 'paused';
      els.pauseBtn.textContent = '继续';
      showOverlay({
        emoji: '⏸️',
        title: '已暂停',
        text: '按空格键，或点击下方按钮继续游戏。',
        button: '继续游戏'
      });
    } else if (state.status === 'paused') {
      state.status = 'running';
      state.acc = 0;
      els.pauseBtn.textContent = '暂停';
      hideOverlay();
    }
  }

  function gameOver(reason) {
    state.status = 'over';
    state.queue.length = 0;
    if (state.score > state.best) {
      state.best = state.score;
      writeStorage(SCORE_KEY, state.best);
    }
    updateHud();
    playSound('over');
    showOverlay({
      emoji: '💥',
      title: '游戏结束',
      text: reason + '。你在第 ' + state.stage + ' 关倒下，本局得分 ' + state.score +
        ' 分，最高分 ' + state.best + ' 分。',
      button: '再来一局'
    });
  }

  function win() {
    state.status = 'over';
    state.queue.length = 0;
    if (state.score > state.best) {
      state.best = state.score;
      writeStorage(SCORE_KEY, state.best);
    }
    updateHud();
    playSound('stage');
    showOverlay({
      emoji: '🏆',
      title: '全部通关！',
      text: '你走完了全部 ' + STAGES.length + ' 关，最终得分 ' + state.score + ' 分，最高分 ' + state.best + ' 分。',
      button: '再来一局'
    });
  }

  function setDifficulty(key) {
    if (!DIFFICULTIES[key] || key === state.difficulty) return;
    state.difficulty = key;
    writeStorage(DIFF_KEY, key);
    updateDiffButtons();

    // 切换难度即回到准备状态，重新开局时才计入「开局次数」
    ensureAudio();
    state.score = 0;
    state.level = 1;
    state.apples = 0;
    state.status = 'ready';
    state.speed = DIFFICULTIES[key].base;
    applyStage(1);
    els.pauseBtn.textContent = '暂停';
    showOverlay({
      emoji: '🎚️',
      title: '难度：' + DIFFICULTIES[key].label,
      text: '已切换到' + DIFFICULTIES[key].label + '难度，点击开始挑战第 1 关。',
      button: '开始游戏'
    });
  }

  /* ================= 十一、主循环 ================= */
  function loop(now) {
    window.requestAnimationFrame(loop);

    if (!lastTime) lastTime = now;
    let delta = now - lastTime;
    lastTime = now;
    if (delta > 200) delta = 200; // 切换标签页后避免瞬间连走多步

    if (state.status === 'running') {
      if (state.food && state.food.type === 'golden' && now >= state.food.expiresAt) {
        spawnFood();
      }

      state.acc += delta;
      let guard = 0;
      while (state.acc >= state.speed && state.status === 'running' && guard < 5) {
        state.acc -= state.speed;
        step();
        guard += 1;
      }
      if (state.status !== 'running') state.acc = 0;
    } else if (state.status === 'stage') {
      state.stageTimer -= delta;
      const seconds = Math.max(0, Math.ceil(state.stageTimer / 1000));
      if (seconds !== state.stageShown) {
        state.stageShown = seconds;
        els.overlayText.textContent = seconds > 0
          ? STAGES[state.stage - 1].desc + '（' + seconds + ' 秒后自动开始）'
          : '开始！';
      }
      if (state.stageTimer <= 0) beginCurrentStage();
    }

    render(now);
  }

  /* ================= 十二、输入处理 ================= */
  const KEY_MAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', a: 'left', s: 'down', d: 'right',
    W: 'up', A: 'left', S: 'down', D: 'right'
  };

  function pressDirection(name) {
    if (state.status === 'ready') startGame();
    if (state.status === 'paused') togglePause();
    queueDir(DIRS[name]);
  }

  function onKeyDown(event) {
    const key = event.key;

    if (key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      if (state.status === 'stage') {
        beginCurrentStage();
      } else if (state.status === 'running' || state.status === 'paused') {
        togglePause();
      } else {
        startGame();
      }
      return;
    }

    if (key === 'Enter') {
      if (state.status === 'stage') beginCurrentStage();
      else if (state.status === 'ready' || state.status === 'over') startGame();
      return;
    }

    if (key === 'r' || key === 'R') {
      startGame();
      return;
    }

    const dirName = KEY_MAP[key];
    if (!dirName) return;
    event.preventDefault();
    pressDirection(dirName);
  }

  const padButtons = document.querySelectorAll('.pad-btn');
  for (let i = 0; i < padButtons.length; i++) {
    padButtons[i].addEventListener('click', function () {
      pressDirection(this.getAttribute('data-dir'));
    });
  }

  for (let i = 0; i < diffButtons.length; i++) {
    diffButtons[i].addEventListener('click', function () {
      setDifficulty(this.getAttribute('data-diff'));
    });
  }

  let touchStart = null;

  canvas.addEventListener('touchstart', function (event) {
    if (event.touches.length !== 1) return;
    touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });

  canvas.addEventListener('touchend', function (event) {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;

    let dirName;
    if (Math.abs(dx) > Math.abs(dy)) {
      dirName = dx > 0 ? 'right' : 'left';
    } else {
      dirName = dy > 0 ? 'down' : 'up';
    }
    pressDirection(dirName);
  }, { passive: true });

  els.overlayBtn.addEventListener('click', function () {
    if (state.status === 'stage') beginCurrentStage();
    else if (state.status === 'paused') togglePause();
    else startGame();
  });

  els.pauseBtn.addEventListener('click', function () {
    if (state.status === 'stage') beginCurrentStage();
    else if (state.status === 'ready' || state.status === 'over') startGame();
    else togglePause();
  });

  els.restartBtn.addEventListener('click', startGame);

  els.soundBtn.addEventListener('click', function () {
    state.sound = !state.sound;
    writeStorage(SOUND_KEY, state.sound ? 'on' : 'off');
    updateSoundButton();
    if (state.sound) {
      ensureAudio();
      playSound('eat');
    }
  });

  document.addEventListener('keydown', onKeyDown);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state.status === 'running') togglePause();
  });

  /* ================= 十三、初始化 ================= */
  function init() {
    loadProgress();
    applyStage(1);
    updateSoundButton();
    updateDiffButtons();
    showOverlay({
      emoji: '🎮',
      title: '准备好了吗？',
      text: '当前难度：' + DIFFICULTIES[state.difficulty].label + '。共 ' + STAGES.length +
        ' 关，每关吃满 ' + STAGE_TARGET + ' 个苹果即可过关。',
      button: '开始游戏'
    });
    resizeCanvas();

    if (window.ResizeObserver) {
      new ResizeObserver(resizeCanvas).observe(canvas);
    } else {
      window.addEventListener('resize', resizeCanvas);
    }

    window.requestAnimationFrame(loop);
  }

  init();
})();
