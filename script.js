const pads = Array.from(document.querySelectorAll(".pad"));
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const strictToggle = document.getElementById("strictToggle");
const roundCount = document.getElementById("roundCount");
const bestScore = document.getElementById("bestScore");
const statusMessage = document.getElementById("statusMessage");

const COLORS = ["green", "red", "yellow", "blue"];
const PAD_TONES = {
  green: 523.25,
  red: 659.25,
  yellow: 783.99,
  blue: 880.0,
};

let sequence = [];
let playerIndex = 0;
let isAnimating = false;
let isActive = false;
let best = Number(localStorage.getItem("simon_best") || 0);

bestScore.textContent = best;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let osc = null;
let gain = null;

function setStatus(text, accent = true) {
  statusMessage.textContent = text;
  statusMessage.style.color = accent ? "var(--accent)" : "var(--muted)";
}

function updateRound(count) {
  roundCount.textContent = count.toString();
}

function updateBest(score) {
  best = Math.max(best, score);
  bestScore.textContent = best;
  localStorage.setItem("simon_best", best);
}

function startTone(color) {
  stopTone();
  osc = audioCtx.createOscillator();
  gain = audioCtx.createGain();
  osc.frequency.value = PAD_TONES[color];
  gain.gain.value = 0.001;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  const now = audioCtx.currentTime;
  gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
}

function stopTone() {
  if (osc && gain) {
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.stop(audioCtx.currentTime + 0.1);
    osc.disconnect();
    gain.disconnect();
  }
  osc = null;
  gain = null;
}

function lightPad(color, duration = 500) {
  return new Promise((resolve) => {
    const pad = pads.find((p) => p.dataset.color === color);
    if (!pad) return resolve();

    pad.classList.add("pad-glow");
    startTone(color);

    setTimeout(() => {
      pad.classList.remove("pad-glow");
      stopTone();
      resolve();
    }, duration);
  });
}

async function playSequence() {
  isAnimating = true;
  isActive = false;
  updateRound(sequence.length);
  setStatus("Memorize the pattern…");

  await new Promise((r) => setTimeout(r, 600));

  for (const color of sequence) {
    await lightPad(color, Math.max(300, 700 - sequence.length * 25));
    await new Promise((r) => setTimeout(r, 130));
  }

  isAnimating = false;
  isActive = true;
  playerIndex = 0;
  setStatus("Your turn!");
}

function resetGame() {
  sequence = [];
  playerIndex = 0;
  isAnimating = false;
  isActive = false;
  updateRound(0);
  setStatus("Tap start to begin", false);
}

function nextRound() {
  sequence.push(COLORS[Math.floor(Math.random() * COLORS.length)]);
  playSequence();
}

function handlePadPress(color) {
  if (!isActive || isAnimating || sequence.length === 0) {
    return;
  }

  lightPad(color, 220);

  const expected = sequence[playerIndex];
  if (color !== expected) {
    setStatus("Missed it! Try again.", false);
    navigator.vibrate?.(180);
    if (strictToggle.checked) {
      updateRound(0);
      setTimeout(() => {
        resetGame();
        setStatus("Strict mode reset. Tap start!", false);
      }, 400);
    } else {
      playerIndex = 0;
      isActive = false;
      setTimeout(() => {
        setStatus("Watch closely…", false);
        playSequence();
      }, 700);
    }
    return;
  }

  playerIndex += 1;

  if (playerIndex === sequence.length) {
    updateBest(sequence.length);
    isActive = false;
    setStatus("Nice! Next round…");
    setTimeout(() => {
      nextRound();
    }, 750);
  }
}

startButton.addEventListener("click", () => {
  if (isAnimating) {
    return;
  }

  if (sequence.length === 0 || !isActive) {
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    setStatus("Here comes the pattern…");
    nextRound();
  }
});

restartButton.addEventListener("click", () => {
  resetGame();
});

strictToggle.addEventListener("change", () => {
  if (strictToggle.checked) {
    setStatus("Strict mode on. No mistakes!", true);
  } else if (sequence.length === 0) {
    setStatus("Tap start to begin", false);
  }
});

pads.forEach((pad) => {
  pad.addEventListener("pointerdown", () => handlePadPress(pad.dataset.color));
});

resetGame();
