/* =========================================================================
   DEDU'S BIRTHDAY SURPRISE — script.js
   -------------------------------------------------------------------------
   HOW THIS FILE IS ORGANISED
     1. CONFIG ............ the stuff you will most likely want to edit
     2. Small helpers
     3. Sound engine ...... sound effects + background music
     4. Visual effects .... hearts, bubbles, stars, confetti, explosions
     5. Bear + cake drawing (original SVG illustrations)
     6. Page switching
     7. Page 1 to Page 5 logic
     8. Start-up
   ========================================================================= */
"use strict";

/* =========================================================================
   1. CONFIG — EDIT ME!
   ========================================================================= */
const CONFIG = {

  /* ---- BACKGROUND MUSIC ----
     Put your mp3 in the  assets/sounds  folder and type its name here.
     If the file is missing, a gentle built-in music-box tune plays instead. */
  musicFile: "assets/sounds/birthday-music.mp3",
  musicVolume: 0.35,          // 0 (silent) to 1 (loud). Keep it low!
  sfxVolume: 0.8,             // volume of button / pop-up sounds

  /* ---- OPTIONAL SOUND-EFFECT FILES ----
     Leave "" to use the built-in sounds. Or point to your own files, e.g.
     click: "assets/sounds/click.mp3"  */
  sfxFiles: {
    click: "", pop: "", tick: "", ding: "", happy: "", sad: "",
    blow: "", celebrate: "", cut: "", magic: ""
  },

  /* ---- BEAR PICTURES ----
     Put your own bear images (PNG with transparent background works best)
     in  assets/images  . If a file is found it replaces the drawn bear. */
  bearImages: {
    mom:      "assets/images/mom-bear.png",
    dad:      "assets/images/dad-bear.png",
    daughter: "assets/images/daughter-bear.png"
  },

  /* ---- MESSAGES ---- */
  messages: {
    yes:    "Yayyy! Let's share our love together, daughter! 💚",
    no:     "Sad... don't do this! Your parents love you so much! 🥺",
    didIt:  "YOU DID IT! HAPPY BIRTHDAY, DEDU! 🎉",
    cut:    "One big slice of love, specially for you! 💚"
  },

  /* ---- THE LETTER (page 4) ----
     Change the text between the backticks ` ` . New lines are kept. */
  letter:
`Dear Dedu,

Happy birthday to our sweetest daughter!

Today is all about you. We hope your special day is filled with happiness, laughter, beautiful memories, and endless love.

You deserve all the wonderful things this world has to offer. Never forget how special you are and how much you are loved.

No matter how far apart we are, you will always have a special place in our hearts.

Keep smiling, keep shining, and never stop being your adorable self.

With all our love,
Mom & Dad 💚`,

  letterEditable: true,       // true = you can click the letter and type to edit it
  typingSpeed: 24,            // milliseconds per letter (smaller = faster)

  /* ---- TIMING ---- */
  countdownFrom: 10,          // the countdown starts here and goes down to 0
  autoAdvanceDelay: 2400      // ms to wait after "YES!" before going to page 2
};


/* =========================================================================
   2. SMALL HELPERS
   ========================================================================= */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const rand = (min, max) => Math.random() * (max - min) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* "later" = setTimeout that is automatically cancelled when we change page,
   so a timer from one page can never mess up the next page. */
let timers = [];
function later(fn, ms) {
  const id = setTimeout(fn, ms);
  timers.push(id);
  return id;
}
function clearTimers() { timers.forEach(clearTimeout); timers = []; }

/* Re-start a CSS animation on an element */
function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;            // forces the browser to "forget" the old animation
  el.classList.add(cls);
}

/* Show a message in a message box (.message) */
function showMsg(el, text, mood) {
  const banner = el.classList.contains("banner") ? " banner" : "";   // keep the big style on page 3
  el.textContent = text;
  el.className = "message" + banner + " " + (mood || "");
  restartAnim(el, "show");
}


/* =========================================================================
   3. SOUND ENGINE
   All sound effects are created with the browser's Web Audio API, so you
   don't need any audio files. The website works fine if sound is blocked.
   ========================================================================= */
let ctx = null, sfxGain = null, synthMusicGain = null;

function initAudio() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    ctx = new AC();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = CONFIG.sfxVolume * 0.5;
    sfxGain.connect(ctx.destination);
    synthMusicGain = ctx.createGain();
    synthMusicGain.gain.value = 0;
    synthMusicGain.connect(ctx.destination);
    return true;
  } catch (e) { return false; }
}
function resumeAudio() { if (ctx && ctx.state === "suspended") ctx.resume(); }

/* One soft musical note */
function tone(freq, when, dur, o = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type || "sine";
  osc.frequency.setValueAtTime(freq, t);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
  const vol = o.vol !== undefined ? o.vol : 0.2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(o.dest || sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/* A burst of filtered noise (used for blowing, cutting, sparkles) */
function noise(when, dur, o = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = o.type || "bandpass";
  filter.frequency.setValueAtTime(o.freq || 1000, t);
  if (o.sweepTo) filter.frequency.linearRampToValueAtTime(o.sweepTo, t + dur);
  filter.Q.value = o.q || 0.8;
  const g = ctx.createGain();
  const vol = o.vol !== undefined ? o.vol : 0.3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.25);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(filter); filter.connect(g); g.connect(sfxGain);
  src.start(t);
}

/* The built-in sound effects */
const SFX = {
  click()     { tone(700, 0, 0.1, { type: "triangle", vol: 0.18, slideTo: 1000 }); },
  pop()       { tone(420, 0, 0.12, { vol: 0.2, slideTo: 900 }); tone(1200, 0.06, 0.1, { vol: 0.07 }); },
  tick()      { tone(1000, 0, 0.07, { type: "triangle", vol: 0.12 }); },
  ding()      { tone(1046, 0, 0.7, { vol: 0.16 }); tone(1568, 0.05, 0.7, { vol: 0.08 }); },
  happy()     { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.3, { type: "triangle", vol: 0.17 })); },
  sad()       { [392, 349, 311, 262].forEach((f, i) => tone(f, i * 0.22, 0.45, { type: "triangle", vol: 0.15, slideTo: f * 0.96 })); },
  blow()      { noise(0, 1.3, { freq: 700, sweepTo: 1800, q: 0.6, vol: 0.32 }); },
  celebrate() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, i * 0.1, 0.5, { type: "triangle", vol: 0.13 }));
    noise(0.1, 0.8, { type: "highpass", freq: 5000, vol: 0.08 });
  },
  cut()       { noise(0, 0.3, { type: "highpass", freq: 3000, vol: 0.2 }); tone(880, 0.25, 0.45, { vol: 0.12 }); tone(1318, 0.32, 0.45, { vol: 0.08 }); },
  magic()     { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, i * 0.08, 0.5, { vol: 0.1 })); }
};

/* Play a sound effect by name (uses your own file if you set one in CONFIG) */
function playSfx(name) {
  try {
    const file = CONFIG.sfxFiles[name];
    if (file) {
      const a = new Audio(file);
      a.volume = Math.min(1, CONFIG.sfxVolume * 0.6);
      a.play().catch(() => {});
      return;
    }
    if (!initAudio()) return;
    resumeAudio();
    if (SFX[name]) SFX[name]();
  } catch (e) { /* sound is optional, never break the site */ }
}

/* ---------- BACKGROUND MUSIC ---------- */
let musicOn = false;
let bgmEl = null;            // <audio> element for your mp3
let synthRunning = false;    // true while the built-in tune is playing
let synthTimer = null;

/* "Happy Birthday" as music-box notes: [frequency in Hz, length in beats] */
const MELODY = [
  [392,.75],[392,.25],[440,1],[392,1],[523,1],[494,2],
  [392,.75],[392,.25],[440,1],[392,1],[587,1],[523,2],
  [392,.75],[392,.25],[784,1],[659,1],[523,1],[494,1],[440,2],
  [698,.75],[698,.25],[659,1],[523,1],[587,1],[523,2]
];

function musicBoxNote(freq, when) {
  tone(freq,     when, 1.1, { type: "sine", vol: 0.3,  dest: synthMusicGain });
  tone(freq * 2, when, 0.6, { type: "sine", vol: 0.08, dest: synthMusicGain });
}
function playSynthLoop() {
  if (!synthRunning) return;
  const beat = 0.55;
  let t = 0.05;
  MELODY.forEach(([f, b]) => { musicBoxNote(f, t); t += b * beat; });
  [262, 330, 392, 523].forEach((f, i) => musicBoxNote(f, t + i * 0.28));   // little ending sparkle
  t += 2.2;
  synthTimer = setTimeout(playSynthLoop, t * 1000);
}
function startSynthMusic() {
  if (synthRunning) return;
  if (!initAudio()) return;
  resumeAudio();
  synthRunning = true;
  synthMusicGain.gain.cancelScheduledValues(ctx.currentTime);
  synthMusicGain.gain.setTargetAtTime(CONFIG.musicVolume, ctx.currentTime, 0.3);
  playSynthLoop();
}
function stopSynthMusic() {
  synthRunning = false;
  clearTimeout(synthTimer);
  if (ctx && synthMusicGain) synthMusicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
}

function startMusic() {
  musicOn = true;
  updateMusicBtn();
  if (CONFIG.musicFile) {
    if (!bgmEl) {
      bgmEl = new Audio(CONFIG.musicFile);
      bgmEl.loop = true;
      bgmEl.volume = CONFIG.musicVolume;
      // If the mp3 can't be found/played, fall back to the built-in tune
      bgmEl.addEventListener("error", () => { if (musicOn) startSynthMusic(); });
    }
    const p = bgmEl.play();
    if (p && p.catch) p.catch(() => { if (bgmEl.error && musicOn) startSynthMusic(); });
    return;
  }
  startSynthMusic();
}
function stopMusic() {
  musicOn = false;
  updateMusicBtn();
  if (bgmEl) bgmEl.pause();
  stopSynthMusic();
}
function updateMusicBtn() {
  const b = $("#musicBtn");
  b.textContent = musicOn ? "🎵 Music ON" : "🔇 Music OFF";
  b.classList.toggle("on", musicOn);
  b.setAttribute("aria-pressed", String(musicOn));
}


/* =========================================================================
   4. VISUAL EFFECTS
   ========================================================================= */
const HEARTS = ["💚", "💚", "🤍", "💗", "💚"];

/* Add an element to the background layer and delete it after "life" ms */
function addFx(el, life) {
  $("#fx").appendChild(el);
  setTimeout(() => el.remove(), life);
}
function spawnHeart() {
  if (document.hidden) return;
  const el = document.createElement("span");
  el.className = "fall-heart";
  el.textContent = pick(HEARTS);
  const dur = rand(7, 12);
  el.style.left = rand(0, 100) + "%";
  el.style.fontSize = rand(14, 32) + "px";
  el.style.setProperty("--dur", dur + "s");
  el.style.setProperty("--drift", rand(-60, 60) + "px");
  el.style.setProperty("--rot", rand(-60, 60) + "deg");
  addFx(el, dur * 1000 + 200);
}
function spawnBubble() {
  if (document.hidden) return;
  const el = document.createElement("span");
  el.className = "bubble";
  const size = rand(18, 62);
  const dur = rand(9, 15);
  el.style.width = el.style.height = size + "px";
  el.style.left = rand(0, 100) + "%";
  el.style.setProperty("--dur", dur + "s");
  el.style.setProperty("--drift", rand(-50, 50) + "px");
  addFx(el, dur * 1000 + 200);
}
function spawnSparkle() {
  if (document.hidden) return;
  const el = document.createElement("span");
  el.className = "sparkle";
  el.textContent = pick(["✨", "✨", "⭐", "🌟"]);
  el.style.left = rand(3, 95) + "%";
  el.style.top = rand(5, 90) + "%";
  el.style.fontSize = rand(14, 26) + "px";
  addFx(el, 2000);
}
/* Permanent twinkling/moving stars and soft green glow blobs */
function createStarsAndGlow() {
  const small = window.innerWidth < 600;
  for (let i = 0; i < (small ? 14 : 26); i++) {
    const s = document.createElement("span");
    s.className = "star";
    s.textContent = pick(["✦", "✧", "★", "✦"]);
    s.style.left = rand(0, 98) + "%";
    s.style.top = rand(0, 95) + "%";
    s.style.fontSize = rand(10, 24) + "px";
    s.style.setProperty("--tw", rand(2, 5) + "s");
    s.style.setProperty("--dr", rand(6, 14) + "s");
    s.style.setProperty("--dx", rand(-30, 30) + "px");
    s.style.setProperty("--dy", rand(-30, 30) + "px");
    s.style.animationDelay = rand(0, 4) + "s";
    $("#fx").appendChild(s);
  }
  for (let i = 0; i < (small ? 6 : 10); i++) {
    const g = document.createElement("span");
    const size = rand(70, 170);
    g.className = "glow";
    g.style.width = g.style.height = size + "px";
    g.style.left = rand(-5, 95) + "%";
    g.style.top = rand(-5, 95) + "%";
    g.style.setProperty("--gd", rand(9, 18) + "s");
    g.style.setProperty("--dx", rand(-60, 60) + "px");
    g.style.setProperty("--dy", rand(-60, 60) + "px");
    $("#fx").appendChild(g);
  }
}
function startAmbient() {
  const small = window.innerWidth < 600;
  createStarsAndGlow();
  setInterval(spawnHeart,   small ? 750  : 450);
  setInterval(spawnBubble,  small ? 1200 : 800);
  setInterval(spawnSparkle, 900);
}

/* A burst of hearts from a point on the screen */
function heartExplosion(x, y, count = 24) {
  const layer = $("#fxTop");
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "burst";
    el.textContent = pick(HEARTS);
    const angle = rand(0, Math.PI * 2);
    const dist = rand(80, 240);
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    el.style.setProperty("--dy", Math.sin(angle) * dist + "px");
    el.style.setProperty("--rot", rand(-60, 60) + "deg");
    el.style.fontSize = rand(16, 34) + "px";
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
}
function explodeAtCenterOf(el, count) {
  const r = el.getBoundingClientRect();
  heartExplosion(r.left + r.width / 2, r.top + r.height / 2, count);
}

/* Confetti raining from the top */
function confetti(count = 80) {
  const layer = $("#fxTop");
  const colors = ["#a8d5b0", "#8fc79a", "#fff4de", "#f1e4cf", "#c9a27e", "#f4b6c8", "#ffffff", "#ffe27a"];
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "confetti";
    const dur = rand(2.6, 5);
    el.style.left = rand(0, 100) + "%";
    el.style.width = rand(6, 11) + "px";
    el.style.height = rand(10, 18) + "px";
    el.style.background = pick(colors);
    el.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    el.style.setProperty("--dur", dur + "s");
    el.style.setProperty("--drift", rand(-120, 120) + "px");
    el.style.setProperty("--rot", rand(300, 1000) + "deg");
    el.style.animationDelay = rand(0, 0.8) + "s";
    layer.appendChild(el);
    setTimeout(() => el.remove(), (dur + 1) * 1000 + 200);
  }
}


/* =========================================================================
   5. BEAR + CAKE DRAWING
   The bears are original SVG drawings made with code, so there are no
   copyright problems. To use your own pictures, see CONFIG.bearImages.
   ========================================================================= */
function bow(x, y, s, c, d) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <polygon points="0,0 -20,-13 -20,13" fill="${c}"/>
    <polygon points="0,0 20,-13 20,13" fill="${c}"/>
    <circle r="5.5" fill="${d}"/></g>`;
}

function bearSVG(type, withSign) {
  const palette = {
    mom:      { body: "#e6cfae", ear: "#f8ecda" },   // creamy "milk" bear
    dad:      { body: "#a77d5c", ear: "#dcbd9f" },   // "mocha" bear
    daughter: { body: "#d9bb98", ear: "#f8ecda" }    // in-between little bear
  };
  const C = palette[type] || palette.mom;
  const GREEN = "#8fc79a", GREEN_D = "#5fa36f", INK = "#4a3326";

  // Things that sit on the body or on the head, depending on the bear
  let bodyExtra = "", headExtra = "";
  if (type === "mom") headExtra = bow(130, 40, 1, GREEN, GREEN_D);
  if (type === "dad") bodyExtra = bow(100, 158, 1.1, GREEN_D, "#4f8c5d");
  if (type === "daughter") {
    bodyExtra = `<path d="M100 196 C82 184 84 168 95 170 C99 171 100 175 100 175 C100 175 101 171 105 170 C116 168 118 184 100 196 Z" fill="${GREEN}"/>`;
    headExtra = `<polygon points="100,2 76,50 124,50" fill="${GREEN}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M86 32 L114 32 M81 42 L119 42" stroke="#fff" stroke-width="3" opacity=".8"/>
      <circle cx="100" cy="4" r="7" fill="#fff"/>`;
  }

  const w = withSign ? 270 : 200;
  const sign = withSign ? `
    <g class="sign-board">
      <rect x="217" y="70" width="10" height="140" rx="4" fill="#b88a64"/>
      <rect x="186" y="8" width="72" height="66" rx="12" fill="#fffbe6" stroke="${GREEN}" stroke-width="5"/>
      <polygon points="222,18 250,62 194,62" fill="#ffd966" stroke="#e3a900" stroke-width="3" stroke-linejoin="round"/>
      <text x="222" y="58" text-anchor="middle" font-size="30" font-weight="800" fill="#7a5a1a" font-family="Baloo 2, sans-serif">!</text>
    </g>` : "";
  const rightArm = withSign
    ? `<line x1="146" y1="148" x2="214" y2="122" stroke="${C.body}" stroke-width="26" stroke-linecap="round"/>`
    : `<g class="arm arm-r"><ellipse cx="150" cy="152" rx="13" ry="26" transform="rotate(-22 150 152)" fill="${C.body}"/></g>`;

  return `
  <svg class="bear-svg" viewBox="0 0 ${w} 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${type} bear">
    <ellipse cx="100" cy="213" rx="58" ry="7" fill="rgba(80,110,80,.18)"/>
    ${sign}
    <!-- feet -->
    <ellipse cx="66"  cy="202" rx="22" ry="14" fill="${C.body}"/>
    <ellipse cx="134" cy="202" rx="22" ry="14" fill="${C.body}"/>
    <ellipse cx="66"  cy="205" rx="11" ry="7" fill="${C.ear}"/>
    <ellipse cx="134" cy="205" rx="11" ry="7" fill="${C.ear}"/>
    <!-- body -->
    <ellipse cx="100" cy="160" rx="52" ry="50" fill="${C.body}"/>
    <ellipse cx="100" cy="170" rx="32" ry="34" fill="${C.ear}"/>
    ${bodyExtra}
    <!-- arms -->
    <g class="arm arm-l"><ellipse cx="50" cy="152" rx="13" ry="26" transform="rotate(22 50 152)" fill="${C.body}"/></g>
    ${rightArm}
    <!-- ears -->
    <circle cx="52"  cy="52" r="26" fill="${C.body}"/>
    <circle cx="148" cy="52" r="26" fill="${C.body}"/>
    <circle cx="52"  cy="52" r="14" fill="${C.ear}"/>
    <circle cx="148" cy="52" r="14" fill="${C.ear}"/>
    <!-- head -->
    <circle cx="100" cy="95" r="56" fill="${C.body}"/>
    <ellipse cx="100" cy="113" rx="25" ry="19" fill="#fbf1e1"/>
    <!-- cheeks -->
    <circle cx="62"  cy="108" r="8" fill="#ffb3b3" opacity=".55"/>
    <circle cx="138" cy="108" r="8" fill="#ffb3b3" opacity=".55"/>
    <!-- eyes -->
    <g class="eye"><ellipse cx="79"  cy="92" rx="5.5" ry="7" fill="${INK}"/><circle cx="81"  cy="89" r="2" fill="#fff"/></g>
    <g class="eye"><ellipse cx="121" cy="92" rx="5.5" ry="7" fill="${INK}"/><circle cx="123" cy="89" r="2" fill="#fff"/></g>
    <!-- sad eyebrows + tears (only visible when sad) -->
    <path class="brow" d="M66 80 L90 87" stroke="${INK}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path class="brow" d="M134 80 L110 87" stroke="${INK}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <ellipse class="tear t1" cx="76"  cy="102" rx="4.5" ry="7" fill="#8fd3ff"/>
    <ellipse class="tear t2" cx="124" cy="102" rx="4.5" ry="7" fill="#8fd3ff"/>
    <!-- nose + mouth -->
    <ellipse cx="100" cy="105" rx="7.5" ry="5.5" fill="${INK}"/>
    <path class="mouth-smile" d="M100 110 V114 M100 114 Q94 122 88 116 M100 114 Q106 122 112 116" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path class="mouth-sad"   d="M100 110 V115 M100 118 Q94 111 88 119 M100 118 Q106 111 112 119" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    ${headExtra}
  </svg>`;
}

/* Fill every <div class="bear"> with a bear. If you added your own image
   files, swap them in as soon as they are found. */
function mountBears() {
  $$(".bear").forEach((el) => {
    el.innerHTML = bearSVG(el.dataset.type, !!el.dataset.sign);
  });
  Object.keys(CONFIG.bearImages).forEach((type) => {
    const path = CONFIG.bearImages[type];
    if (!path) return;
    const test = new Image();
    test.onload = () => {
      $$(`.bear[data-type="${type}"]`).forEach((el) => {
        if (el.dataset.sign) return;
        el.innerHTML = `<img class="bear-img" src="${path}" alt="${type} bear">`;
      });
    };
    test.src = path;     // if the file doesn't exist, nothing happens (the drawn bear stays)
  });
}

/* Birthday bunting flags along the top of the cake picture */
function mountCakeFlags() {
  const colors = ["#a8d5b0", "#fff6e3", "#cfe8d3", "#e9d3b4"];
  let html = "";
  for (let i = 1; i <= 9; i++) {
    if (i === 5) continue;                                   // leave space for the candle flame
    const t = i / 10;
    const x = 300 * t;
    const y = 10 * (1 - t) ** 2 + 2 * (1 - t) * t * 40 + 10 * t * t;   // follows the curved string
    html += `<polygon points="${x - 9},${y} ${x + 9},${y} ${x},${y + 20}" fill="${colors[i % 4]}" stroke="#8fc79a" stroke-width="1"/>`;
  }
  $("#flags").innerHTML = html;
}


/* =========================================================================
   6. PAGE SWITCHING (no page reloads!)
   ========================================================================= */
let busy = false;                 // true while a transition is running
let typingTimer = null;           // timer for the letter typing animation

/* Each page has an "enter" function that resets it and starts its animations */
const ENTER = {};

function goPage(n, instant) {
  if (busy) return;
  busy = true;
  clearTimers();
  clearTimeout(typingTimer);

  const doSwitch = () => {
    $$(".page").forEach((p) => p.classList.remove("active"));
    const page = $("#page" + n);
    page.classList.add("active");
    page.scrollTop = 0;
    document.body.dataset.page = n;
    if (ENTER[n]) ENTER[n]();
  };

  if (instant) { doSwitch(); busy = false; return; }

  const wipe = $("#wipe");
  wipe.classList.add("go");
  setTimeout(doSwitch, 500);                                   // switch while the screen is covered
  setTimeout(() => { wipe.classList.remove("go"); busy = false; }, 1100);
}


/* =========================================================================
   7. PAGE LOGIC
   ========================================================================= */

/* ---------------- PAGE 1 — THE BIRTHDAY FAMILY ---------------- */
function setupPage1() {
  const family = $("#family1"), msg = $("#msg1");
  const yes = $("#yesBtn"), no = $("#noBtn");

  ENTER[1] = () => {                         // reset everything (also used by Replay)
    family.classList.remove("sad", "happy");
    msg.className = "message"; msg.textContent = "";
    yes.disabled = false; no.disabled = false;
    yes.classList.remove("pulse");
  };

  yes.addEventListener("click", () => {
    explodeAtCenterOf(yes, 30);              // heart explosion!
    family.classList.remove("sad");
    family.classList.add("happy");
    showMsg(msg, CONFIG.messages.yes, "happy");
    playSfx("happy");
    yes.disabled = true; no.disabled = true;
    later(() => goPage(2), CONFIG.autoAdvanceDelay);
  });

  no.addEventListener("click", () => {
    family.classList.remove("happy");
    family.classList.add("sad");             // bears droop and cry
    showMsg(msg, CONFIG.messages.no, "sad");
    playSfx("sad");
    yes.classList.add("pulse");              // gently remind her that YES is there
  });
}

/* ---------------- PAGE 2 — A LITTLE WARNING ---------------- */
function setupPage2() {
  const overlay = $("#warnOverlay");
  const ready = $("#readyBtn"), go = $("#goBtn");

  ENTER[2] = () => {
    overlay.classList.remove("show");
    ready.disabled = false; go.disabled = false;
    later(() => { overlay.classList.add("show"); playSfx("pop"); }, 600);
  };

  const close = () => {
    ready.disabled = true; go.disabled = true;
    overlay.classList.remove("show");
    later(() => goPage(3), 450);
  };
  ready.addEventListener("click", close);
  go.addEventListener("click", close);
}

/* ---------------- PAGE 3 — THE CAKE ---------------- */
function setupPage3() {
  const wrap = $("#cakeWrap"), svg = $("#cakeSvg");
  const countdown = $("#countdown"), wish = $("#wishOverlay");
  const msg = $("#msg3"), cutBtn = $("#cutBtn"), nextBtn = $("#next3Btn");

  ENTER[3] = () => {
    wrap.classList.remove("out", "smoking");
    svg.classList.remove("cutting", "cut");
    countdown.classList.remove("show", "pop"); countdown.textContent = "";
    wish.classList.remove("show");
    msg.className = "message banner"; msg.textContent = "";
    cutBtn.classList.add("hidden"); nextBtn.classList.add("hidden");
    later(startCountdown, 1500);             // little pause, then 10... 9... 8...
  };

  /* The countdown: 10 → 0, one number per second */
  function startCountdown() {
    let n = CONFIG.countdownFrom;
    countdown.classList.add("show");
    const step = () => {
      countdown.textContent = n;
      restartAnim(countdown, "pop");
      if (n > 0) playSfx("tick"); else playSfx("ding");
      if (n === 0) {
        later(() => { countdown.classList.remove("show"); openWish(); }, 1100);
        return;
      }
      n--;
      later(step, 1000);
    };
    step();
  }

  function openWish() {
    wish.classList.add("show");
    playSfx("pop");
    heartExplosion(window.innerWidth / 2, window.innerHeight / 2, 26);
  }

  /* BLOW THE CANDLE */
  $("#blowBtn").addEventListener("click", () => {
    wish.classList.remove("show");
    later(() => {
      playSfx("blow");
      later(() => {
        wrap.classList.add("out");           // flame disappears, candle goes dark
        wrap.classList.add("smoking");       // smoke puffs
        later(() => {
          confetti(110);
          explodeAtCenterOf(wrap, 28);
          playSfx("celebrate");
          showMsg(msg, CONFIG.messages.didIt, "happy");
          cutBtn.classList.remove("hidden");
        }, 900);
      }, 500);
    }, 400);
  });

  /* CUT THE CAKE */
  cutBtn.addEventListener("click", () => {
    cutBtn.classList.add("hidden");
    svg.classList.add("cutting");            // knife goes down
    later(() => playSfx("cut"), 500);
    later(() => {
      svg.classList.add("cut");              // slice slides out
      playSfx("celebrate");
      confetti(70);
      explodeAtCenterOf(wrap, 24);
      showMsg(msg, CONFIG.messages.cut, "happy");
    }, 1000);
    later(() => nextBtn.classList.remove("hidden"), 2200);
  });

  nextBtn.addEventListener("click", () => goPage(4));
}

/* ---------------- PAGE 4 — THE LETTER ---------------- */
function setupPage4() {
  const stage = $("#envStage"), env = $("#envelope");
  const openBtn = $("#openLetterBtn"), card = $("#letterCard");
  const text = $("#letterText"), nextBtn = $("#next4Btn");
  let typing = false;

  ENTER[4] = () => {
    typing = false;
    stage.classList.remove("away");
    env.classList.remove("open");
    openBtn.classList.remove("hidden"); openBtn.disabled = false;
    card.classList.add("hidden");
    card.style.minHeight = "";
    text.textContent = ""; text.contentEditable = "false";
    nextBtn.classList.add("hidden");
  };

  openBtn.addEventListener("click", () => {
    openBtn.disabled = true;
    playSfx("magic");
    env.classList.add("open");               // flap opens, paper slides up
    later(() => {
      openBtn.classList.add("hidden");
      stage.classList.add("away");           // envelope fades away
      later(showLetter, 500);
    }, 1700);
  });

  function showLetter() {
    const full = CONFIG.letter;
    card.classList.remove("hidden");
    // Measure the full letter first so the card doesn't jump while typing
    text.textContent = full;
    card.style.minHeight = card.offsetHeight + "px";
    text.textContent = "";
    playSfx("pop");
    card.scrollIntoView({ behavior: "smooth", block: "center" });

    typing = true;
    let i = 0;
    const type = () => {
      if (!typing) return;
      i++;
      text.textContent = full.slice(0, i);
      if (i < full.length) typingTimer = setTimeout(type, CONFIG.typingSpeed);
      else finish();
    };
    type();
    later(() => nextBtn.classList.remove("hidden"), 900);   // the continue button never gets stuck
  }

  /* Finish typing (also happens if she taps the letter to skip) */
  function finish() {
    typing = false;
    clearTimeout(typingTimer);
    text.textContent = CONFIG.letter;
    if (CONFIG.letterEditable) text.contentEditable = "true";   // click the letter to edit it
    nextBtn.classList.remove("hidden");
  }
  card.addEventListener("click", () => { if (typing) finish(); });

  nextBtn.addEventListener("click", () => goPage(5));
}

/* ---------------- PAGE 5 — ONE LAST THING ---------------- */
function setupPage5() {
  const gift = $("#gift"), overlay = $("#finalOverlay");

  ENTER[5] = () => {
    gift.classList.remove("open");
    overlay.classList.remove("show");
    const rain = () => { confetti(14); later(rain, 2600); };    // gentle confetti all the time
    later(rain, 500);
  };

  gift.addEventListener("click", () => {
    if (gift.classList.contains("open")) return;
    gift.classList.add("open");
    playSfx("magic");
    confetti(90);
    explodeAtCenterOf(gift, 30);
    later(() => { overlay.classList.add("show"); playSfx("celebrate"); }, 1500);
  });

  $("#replayBtn").addEventListener("click", () => goPage(1));      // back to the beginning!
}


/* =========================================================================
   8. START-UP
   ========================================================================= */
document.addEventListener("DOMContentLoaded", () => {
  mountBears();
  mountCakeFlags();
  startAmbient();

  setupPage1(); setupPage2(); setupPage3(); setupPage4(); setupPage5();

  // Click sound on every button
  document.addEventListener("click", (e) => {
    if (e.target.closest(".btn, .gift")) playSfx("click");
  });

  // Music toggle button
  $("#musicBtn").addEventListener("click", () => { musicOn ? stopMusic() : startMusic(); });

  // Music starts on the FIRST tap/click anywhere (browsers don't allow it before that)
  let touched = false;
  document.addEventListener("pointerdown", (e) => {
    if (touched) return;
    touched = true;
    if (e.target.closest("#musicBtn")) return;      // she pressed the toggle itself
    startMusic();
  }, true);

  updateMusicBtn();
  goPage(1, true);                                   // show page 1
});
