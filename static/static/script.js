// Frontend logic: draws the board and talks to the Python backend.

let gameId = null;   // which game we are playing (given by the backend)
let puzzle = [];     // the starting numbers (0 = empty)
let grid = [];       // what is on the board right now
let wrong = [];      // cells marked wrong by the last "Check"
let selected = -1;   // which cell is selected (0-80), -1 = none
let seconds = 0;
let timerId = null;

const boardEl = document.getElementById("board");
const padEl = document.getElementById("pad");
const messageEl = document.getElementById("message");
const timerEl = document.getElementById("timer");

// ----- Build the 81 cells and the number pad once -----
for (let i = 0; i < 81; i++) {
  const cell = document.createElement("button");
  const row = Math.floor(i / 9);
  const col = i % 9;
  cell.className = "cell";
  if (col % 3 === 2 && col < 8) cell.classList.add("box-right");
  if (row % 3 === 2 && row < 8) cell.classList.add("box-bottom");
  cell.addEventListener("click", () => { selected = i; render(); });
  boardEl.appendChild(cell);
}

for (let n = 1; n <= 9; n++) {
  const btn = document.createElement("button");
  btn.textContent = n;
  btn.addEventListener("click", () => enterNumber(n));
  padEl.appendChild(btn);
}

// ----- Helpers -----
function isPeer(a, b) {
  if (a === b) return false;
  const sameRow = Math.floor(a / 9) === Math.floor(b / 9);
  const sameCol = a % 9 === b % 9;
  const sameBox =
    Math.floor(a / 27) === Math.floor(b / 27) &&
    Math.floor((a % 9) / 3) === Math.floor((b % 9) / 3);
  return sameRow || sameCol || sameBox;
}

function formatTime(s) {
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ----- Drawing -----
function render() {
  [...boardEl.children].forEach((cell, i) => {
    cell.textContent = grid[i] || "";
    cell.classList.toggle("given", puzzle[i] !== 0);
    cell.classList.toggle("selected", i === selected);
    cell.classList.toggle("peer", selected >= 0 && isPeer(selected, i));
    cell.classList.toggle("wrong", wrong.includes(i));
  });
}

// ----- Actions -----
async function newGame() {
  messageEl.textContent = "Building a puzzle...";
  const blanks = document.getElementById("level").value;
  const res = await fetch("/api/new?blanks=" + blanks);
  const data = await res.json();

  gameId = data.id;
  puzzle = data.puzzle;
  grid = [...puzzle];
  wrong = [];
  selected = -1;
  messageEl.textContent = "";

  clearInterval(timerId);
  seconds = 0;
  timerEl.textContent = "0:00";
  timerId = setInterval(() => { seconds++; timerEl.textContent = formatTime(seconds); }, 1000);

  render();
}

function enterNumber(n) {
  if (selected < 0 || puzzle[selected] !== 0) return;  // can't change starting numbers
  grid[selected] = n;
  wrong = [];
  render();
}

function erase() {
  if (selected < 0 || puzzle[selected] !== 0) return;
  grid[selected] = 0;
  wrong = [];
  render();
}

async function checkBoard() {
  const data = await postJSON("/api/check", { id: gameId, grid });
  wrong = data.wrong;
  if (data.solved) {
    clearInterval(timerId);
    messageEl.textContent = "Solved in " + formatTime(seconds) + "!";
  } else if (wrong.length) {
    messageEl.textContent = wrong.length + " wrong cell(s) are marked in red.";
  } else {
    messageEl.textContent = "So far so good. Keep going!";
  }
  render();
}

async function getHint() {
  const data = await postJSON("/api/hint", { id: gameId, grid, index: selected });
  if (data.index >= 0) {
    grid[data.index] = data.value;
    selected = data.index;
    wrong = [];
    render();
  }
}

// ----- Buttons and keyboard -----
document.getElementById("new").addEventListener("click", newGame);
document.getElementById("erase").addEventListener("click", erase);
document.getElementById("check").addEventListener("click", checkBoard);
document.getElementById("hint").addEventListener("click", getHint);

document.addEventListener("keydown", (e) => {
  if (e.key >= "1" && e.key <= "9") enterNumber(Number(e.key));
  else if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") erase();
});

newGame();
