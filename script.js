/*
  Tic Tac Toe game logic
  - 9-cell board represented by an array of 9 elements
  - Supports 2-player and vs-AI modes
  - Easy AI: random moves
  - Hard AI: minimax
*/

const cells = Array.from(document.querySelectorAll('.cell'));
const statusEl = document.getElementById('status');
const restartBtn = document.getElementById('restartBtn');
const modeBtn = document.getElementById('modeBtn');
const difficultyBtn = document.getElementById('difficultyBtn');
const scoreXEl = document.getElementById('scoreX');
const scoreOEl = document.getElementById('scoreO');
const labelXEl = document.getElementById('labelX');
const labelOEl = document.getElementById('labelO');
const scoreXWrap = document.getElementById('scoreXWrap');
const scoreOWrap = document.getElementById('scoreOWrap');
const resetScoresBtn = document.getElementById('resetScoresBtn');
const boardEl = document.getElementById('board');
const winPopup = document.getElementById('winPopup');
const winText = document.getElementById('winText');
const playAgainBtn = document.getElementById('playAgainBtn');
const closePopupBtn = document.getElementById('closePopupBtn');
// Name inputs
const playerXInput = document.getElementById('playerXName');
const playerOInput = document.getElementById('playerOName');
const saveNamesBtn = document.getElementById('saveNamesBtn');

let board = Array(9).fill('');
let currentPlayer = 'X';
let isGameActive = true;
let vsAI = false; // false = 2-player, true = vs AI
let difficulty = 'easy'; // 'easy' or 'hard'
// Score manager (keeps score logic separate from game logic)
const SCORE_KEY = 'ttt_scores_v1';
const ScoreManager = {
  scores: { X: 0, O: 0 },
  load(){
    try{
      const raw = localStorage.getItem(SCORE_KEY);
      if(raw){ this.scores = JSON.parse(raw); }
    }catch(e){ this.scores = { X:0, O:0 }; }
    this.updateUI();
    this.updateLeading();
  },
  save(){
    try{ localStorage.setItem(SCORE_KEY, JSON.stringify(this.scores)); }catch(e){}
  },
  increment(player){
    if(!player) return;
    this.scores[player] = (this.scores[player] || 0) + 1;
    this.save();
    this.updateUI();
    this.pulse(player);
    this.updateLeading();
  },
  reset(){
    this.scores = { X:0, O:0 };
    this.save();
    this.updateUI();
    this.updateLeading();
  },
  updateUI(){
    if(scoreXEl) scoreXEl.textContent = this.scores.X || 0;
    if(scoreOEl) scoreOEl.textContent = this.scores.O || 0;
  },
  updateLabels(){
    if(labelXEl) labelXEl.textContent = NameManager.get('X');
    if(labelOEl) labelOEl.textContent = NameManager.get('O');
  },
  updateLeading(){
    if(!scoreXWrap || !scoreOWrap) return;
    const x = this.scores.X || 0; const o = this.scores.O || 0;
    scoreXWrap.classList.toggle('leading', x > o);
    scoreOWrap.classList.toggle('leading', o > x);
    // if equal, remove both
    if(x === o){ scoreXWrap.classList.remove('leading'); scoreOWrap.classList.remove('leading'); }
  },
  pulse(player){
    const el = player === 'X' ? scoreXEl : scoreOEl;
    if(!el) return;
    el.classList.add('value-pulse');
    setTimeout(()=> el.classList.remove('value-pulse'), 900);
  }
};

// --- Name management (kept separate) ---
const NAME_KEY = 'ttt_player_names_v1';
const NameManager = {
  defaults: { X: 'Player X', O: 'Player O' },
  names: { X: 'Player X', O: 'Player O' },
  load(){
    try{
      const raw = localStorage.getItem(NAME_KEY);
      if(raw){
        const obj = JSON.parse(raw);
        this.names.X = obj.X || this.defaults.X;
        this.names.O = obj.O || this.defaults.O;
      } else {
        this.names = { ...this.defaults };
      }
    }catch(e){ this.names = { ...this.defaults }; }
    this.applyToInputs();
    this.applyToUI();
  },
  save(){
    try{ localStorage.setItem(NAME_KEY, JSON.stringify(this.names)); }catch(e){}
    this.applyToUI();
  },
  sanitize(v){ return (v||'').toString().trim().replace(/\s+/g,' ').slice(0,24) || null; },
  setFromInputs(){
    const x = this.sanitize(playerXInput?.value) || this.defaults.X;
    const o = this.sanitize(playerOInput?.value) || this.defaults.O;
    this.names.X = x; this.names.O = o; this.save();
  },
  get(p){ return this.names[p] || this.defaults[p]; },
  applyToInputs(){ if(playerXInput) playerXInput.value = this.names.X; if(playerOInput) playerOInput.value = this.names.O; },
  applyToUI(){
    // update status and popup if visible
    renderTurnStatus();
    // update scoreboard labels
    if(typeof ScoreManager !== 'undefined') ScoreManager.updateLabels();
    if(winPopup && winPopup.classList.contains('show')){
      // keep winText consistent if it's a non-draw
      const wt = winText.textContent || '';
      // if current popup contains "Wins" replace the label with name
      const m = wt.match(/(.*) Wins!?/i);
      if(m){
        // attempt to determine which symbol won from lastWinningCombo? fallback to previous text
        // simply leave popup until new win occurs; when new win happens we set correct text.
      }
    }
  }
};

function renderTurnStatus(){
  if(!statusEl) return;
  if(vsAI && currentPlayer === 'O'){
    statusEl.textContent = `AI (${difficulty}) is thinking...`;
    return;
  }
  const name = NameManager.get(currentPlayer);
  statusEl.innerHTML = `<span class="player-avatar ${currentPlayer === 'X' ? 'x' : 'o'}" aria-hidden></span> ${escapeHtml(name)}'s turn`;
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; }); }

// wire save button
if(saveNamesBtn){ saveNamesBtn.addEventListener('click', ()=>{ NameManager.setFromInputs(); soundManager.playButton(); }); }

// initialize names from storage
NameManager.load();
// initialize scores from storage and ensure labels match names
ScoreManager.load();
ScoreManager.updateLabels();

// winning combinations
const WIN_COMBOS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

// Sound manager using WebAudio API for interactive UI tones
class SoundManager{
  constructor(){
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.6;
  }
  init(){
    if(this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }
  resume(){ if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v){ this.init(); this.volume = v; if(!this.muted) this.master.gain.value = v; }
  mute(v){ this.muted = v; if(!this.master) this.init(); this.master.gain.value = v ? 0 : this.volume; }
  playTone(freq=440,dur=0.08,type='sine',gain=0.06){
    if(this.muted) return;
    this.init(); if(!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    // slight variation
    o.frequency.value = freq * (1 + (Math.random()-0.5)*0.02);
    o.connect(g); g.connect(this.master);
    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.01);
    o.start(now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.stop(now + dur + 0.02);
  }
  playMove(player){ if(player === 'X') this.playTone(920,0.08,'sawtooth',0.07); else this.playTone(540,0.08,'triangle',0.07); }
  playWin(){ this.playTone(1200,0.14,'sine',0.09); setTimeout(()=>this.playTone(820,0.12,'sine',0.08),120); }
  playDraw(){ this.playTone(320,0.12,'sine',0.06); }
  playButton(){ this.playTone(720,0.06,'square',0.05); }
}

const soundManager = new SoundManager();

function render(){
  cells.forEach((cell, idx) => {
    cell.className = 'cell';
    cell.innerHTML = '';
    const val = board[idx];
    if(val){
      const span = document.createElement('div');
      span.className = `cellContent ${val === 'X' ? 'x' : 'o'}`;
      span.textContent = val;
      cell.appendChild(span);
    }
  });
}

function updateStatus(text){ if(statusEl) statusEl.textContent = text }

function checkWin(b){
  for(const combo of WIN_COMBOS){
    const [a,b1,c] = combo;
    if(b[a] && b[a] === b[b1] && b[a] === b[c]){
      return { winner: b[a], combo };
    }
  }
  return null;
}

function checkDraw(b){
  return b.every(cell => cell !== '');
}

function endGame(result){
  isGameActive = false;
  if(result.winner){
    const w = result.winner;
    updateStatus(`${NameManager.get(w)} wins!`);
    ScoreManager.increment(w);
    // highlight winning cells
    result.combo.forEach((i, idx) => {
      cells[i].style.setProperty('--i', idx);
      cells[i].classList.add('win','winWave');
    });
      // draw winning line overlay
      drawWinningLine(result.combo);
      // play win sound
      soundManager.playWin();
      // show popup and dim background (use player name)
      showWinPopup(`${NameManager.get(w)} Wins!`);
  } else {
    updateStatus('Draw!');
    soundManager.playDraw();
      showWinPopup(`It's a Draw!`);
  }
}

// Draw a responsive animated winning line across the board
const winLineEl = document.getElementById('winLine');
let lastWinningCombo = null;
function drawWinningLine(combo){
  if(!winLineEl) return;
  // pick start and end indices (first and last in combo)
  const startIdx = combo[0];
  const endIdx = combo[combo.length - 1];
  const startCell = cells[startIdx];
  const endCell = cells[endIdx];
  const boardRect = boardEl.getBoundingClientRect();
  const aRect = startCell.getBoundingClientRect();
  const bRect = endCell.getBoundingClientRect();

  // get center points relative to board
  const aX = aRect.left + aRect.width/2 - boardRect.left;
  const aY = aRect.top + aRect.height/2 - boardRect.top;
  const bX = bRect.left + bRect.width/2 - boardRect.left;
  const bY = bRect.top + bRect.height/2 - boardRect.top;

  const dx = bX - aX;
  const dy = bY - aY;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * (180/Math.PI);

  // position and size (use percentages for responsiveness)
  const boardW = boardRect.width;
  const boardH = boardRect.height;
  const leftPct = (aX / boardW) * 100;
  const topPct = (aY / boardH) * 100;
  const widthPct = (length / boardW) * 100;
  winLineEl.style.width = `${widthPct}%`;
  winLineEl.style.left = `${leftPct}%`;
  // top offset such that line is centered on the cell center
  // compute pixel top using board height and convert to percent
  const lineHeight = parseFloat(getComputedStyle(winLineEl).height) || 6;
  const topPx = aY - (lineHeight/2);
  const topPctFinal = (topPx / boardH) * 100;
  winLineEl.style.top = `${topPctFinal}%`;
  winLineEl.style.setProperty('--angle', `${angle}deg`);
  lastWinningCombo = combo.slice();
  // apply initial transform then animate to scaleX(1)
  winLineEl.classList.remove('show');
  // force reflow
  void winLineEl.offsetWidth;
  winLineEl.classList.add('show');
}

function removeWinningLine(){
  if(!winLineEl) return;
  winLineEl.classList.remove('show');
  // clear styles after animation completes
  setTimeout(()=>{
    winLineEl.style.width = '0px';
    winLineEl.style.left = '0px';
    winLineEl.style.top = '0px';
    winLineEl.style.removeProperty('--angle');
    lastWinningCombo = null;
  }, 700);
}

function showWinPopup(message){
  if(!winPopup) return;
  winText.textContent = message;
  document.querySelector('.app').classList.add('dimmed');
  if(boardEl) boardEl.classList.add('glow');
  winPopup.classList.add('show');
}

function hideWinPopup(){
  if(!winPopup) return;
  winPopup.classList.remove('show');
  document.querySelector('.app').classList.remove('dimmed');
  if(boardEl) boardEl.classList.remove('glow');
}

// Recalculate win line on window resize to keep it aligned
window.addEventListener('resize', () => {
  if(lastWinningCombo && lastWinningCombo.length === 3){
    // small debounce
    clearTimeout(window._winLineResizeTimer);
    window._winLineResizeTimer = setTimeout(()=> drawWinningLine(lastWinningCombo), 120);
  }
});

function makeMove(index){
  if(!isGameActive) return;
  if(board[index]) return; // prevent overwriting
  board[index] = currentPlayer;
  soundManager.playMove(currentPlayer);
  render();

  const win = checkWin(board);
  if(win){
    endGame(win);
    return;
  }

  if(checkDraw(board)){
    endGame({ winner: null });
    return;
  }

  // switch player
  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  renderTurnStatus();

  // if vs AI and it's AI turn, make AI move
  if(vsAI && currentPlayer === 'O' && isGameActive){
    setTimeout(() => {
      makeAIMove();
    }, 350);
  }
}

function handleCellClick(e){
  const idx = Number(e.currentTarget.dataset.index);
  if(!isGameActive) return;
  if(vsAI && currentPlayer === 'O') return; // block clicks when AI turn
  makeMove(idx);
}

function availableMoves(boardArr){
  const moves = [];
  boardArr.forEach((v,i) => { if(!v) moves.push(i) });
  return moves;
}

function makeAIMove(){
  if(difficulty === 'easy'){
    const moves = availableMoves(board);
    const pick = moves[Math.floor(Math.random()*moves.length)];
    if(pick !== undefined) makeMove(pick);
    return;
  }

  // Hard: minimax for best move (AI is 'O')
  const best = minimax(board.slice(), 'O');
  if(best.index !== undefined) makeMove(best.index);
}

function minimax(newBoard, player){
  const avail = availableMoves(newBoard);

  const winCheck = checkWin(newBoard);
  if(winCheck){
    if(winCheck.winner === 'O') return { score: 10 };
    else if(winCheck.winner === 'X') return { score: -10 };
  }
  if(avail.length === 0) return { score: 0 };

  const moves = [];

  for(let i=0;i<avail.length;i++){
    const idx = avail[i];
    const move = {};
    move.index = idx;
    newBoard[idx] = player;

    if(player === 'O'){
      const result = minimax(newBoard, 'X');
      move.score = result.score;
    } else {
      const result = minimax(newBoard, 'O');
      move.score = result.score;
    }

    newBoard[idx] = '';
    moves.push(move);
  }

  let bestMove;
  if(player === 'O'){
    let bestScore = -Infinity;
    for(const m of moves){ if(m.score > bestScore){ bestScore = m.score; bestMove = m } }
  } else {
    let bestScore = Infinity;
    for(const m of moves){ if(m.score < bestScore){ bestScore = m.score; bestMove = m } }
  }

  return bestMove;
}

function restartGame(){
  board = Array(9).fill('');
  currentPlayer = 'X';
  isGameActive = true;
  cells.forEach(c => { c.classList.remove('win','winWave'); c.style.removeProperty('--i'); });
  removeWinningLine();
  hideWinPopup();
  renderTurnStatus();
  render();
}

function resetScores(){
  ScoreManager.reset();
}

// UI wiring
cells.forEach(cell => cell.addEventListener('click', handleCellClick));
restartBtn.addEventListener('click', () => { restartGame(); soundManager.playButton(); });
resetScoresBtn.addEventListener('click', () => { resetScores(); soundManager.playButton(); });

modeBtn.addEventListener('click', () => {
  vsAI = !vsAI;
  modeBtn.textContent = `Mode: ${vsAI ? 'Play vs AI' : '2 Player'}`;
  // If turned on vsAI and it is O's turn, let AI move
  if(vsAI && currentPlayer === 'O' && isGameActive){ setTimeout(makeAIMove, 300); }
  soundManager.playButton();
});

difficultyBtn.addEventListener('click', () => {
  difficulty = difficulty === 'easy' ? 'hard' : 'easy';
  difficultyBtn.textContent = `Difficulty: ${difficulty === 'easy' ? 'Easy' : 'Hard'}`;
  soundManager.playButton();
});

// Sound and volume controls
const soundToggle = document.getElementById('soundToggle');
const volumeRange = document.getElementById('volumeRange');
const themeToggle = document.getElementById('themeToggle');
soundToggle.addEventListener('change', (e) => {
  const on = e.target.checked;
  soundManager.mute(!on);
  soundManager.playButton();
});
volumeRange.addEventListener('input', (e) => {
  const v = Number(e.target.value);
  soundManager.setVolume(v);
});
themeToggle.addEventListener('change', (e) => {
  document.documentElement.classList.toggle('light', e.target.checked);
  soundManager.playButton();
});

// initial render
render();
renderTurnStatus();
// ensure audio resumes on first gesture
document.addEventListener('click', function initAudio(){ soundManager.init(); soundManager.resume(); document.removeEventListener('click', initAudio); }, { once: true });

// popup buttons wiring
if(playAgainBtn) playAgainBtn.addEventListener('click', () => { restartGame(); soundManager.playButton(); });
if(closePopupBtn) closePopupBtn.addEventListener('click', () => { hideWinPopup(); soundManager.playButton(); });

// Rules were moved to a separate `rules.html` page; guide link navigates there.
