// =====================================================
// main.js : すべてをつなぐファイル
// ボタンの設定、画面上部の表示（HP・スコアなど）、そして
// 「計算する → 描く」を1秒に約60回くりかえす処理（ゲームループ）を担当します。
// =====================================================

// HTML の部品をまとめて取り出しておく
const ui = {
  canvas: document.getElementById('game'),
  titleScreen: document.getElementById('title-screen'),
  gameOverScreen: document.getElementById('gameover-screen'),
  startBtn: document.getElementById('btn-start'),
  retryBtn: document.getElementById('btn-retry'),
  toTitleBtn: document.getElementById('btn-title'),
  muteBtn: document.getElementById('btn-mute'),
  floatBtn: document.getElementById('btn-float'),
  dropBtn: document.getElementById('btn-drop'),
  hpFill: document.getElementById('hp-fill'),
  hpText: document.getElementById('hp-text'),
  score: document.getElementById('score'),
  levelName: document.getElementById('level-name'),
  time: document.getElementById('time'),
  susFill: document.getElementById('sus-fill'),
  susBox: document.getElementById('sus-box'),
  titleBest: document.getElementById('title-best'),
  goTitle: document.getElementById('go-title'),
  goSub: document.getElementById('go-sub'),
  goScore: document.getElementById('go-score'),
  goBest: document.getElementById('go-best'),
  goLevel: document.getElementById('go-level'),
};

// ---------- ボタンの動き ----------
function startGame() {
  Sound.init(); // 音はユーザーがボタンを押したあとでないと鳴らせない
  ui.titleScreen.classList.add('hidden');
  ui.gameOverScreen.classList.add('hidden');
  newGame();
}

ui.startBtn.addEventListener('click', startGame);
ui.retryBtn.addEventListener('click', startGame);
ui.toTitleBtn.addEventListener('click', () => {
  ui.gameOverScreen.classList.add('hidden');
  ui.titleBest.textContent = game.best;
  ui.titleScreen.classList.remove('hidden');
  game.state = 'title';
});
ui.muteBtn.addEventListener('click', () => {
  Sound.muted = !Sound.muted;
  ui.muteBtn.textContent = Sound.muted ? '🔇' : '🔊';
  ui.muteBtn.setAttribute('aria-label', Sound.muted ? '音を出す' : '音を消す');
});
// パソコンでは Enter キーでもスタートできる
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Enter') return;
  if (game.state === 'title' || (game.state === 'gameover' && !ui.gameOverScreen.classList.contains('hidden'))) {
    startGame();
  }
});

// ---------- 画面上部の表示を更新する ----------
function updateHud() {
  const hpRate = game.hp / BALL_MAX_HP;
  ui.hpFill.style.width = `${hpRate * 100}%`;
  ui.hpFill.style.background = hpRate > 0.6 ? '#3ddc84' : hpRate > 0.3 ? '#ffc93c' : '#ff4d4d';
  ui.hpText.textContent = Math.ceil(game.hp);
  ui.score.textContent = game.touches;
  ui.levelName.textContent = LEVELS[game.levelIndex].name;
  const sec = Math.floor(game.elapsed);
  ui.time.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  ui.susFill.style.width = `${game.suspicion}%`;
  ui.susFill.style.background = game.suspicion > 85 ? '#ff4d4d' : game.suspicion > 60 ? '#ff9f43' : '#ffd23f';
  // 審判がよそ見しているときは、メーターを緑色に光らせて「チャンス！」と知らせる
  const away = game.state === 'play' && game.referee && game.referee.mode === 'away';
  ui.susBox.classList.toggle('away', away);
}

// ---------- ゲームオーバー画面 ----------
function showGameOver() {
  const r = game.result;
  ui.goTitle.textContent = r.title;
  ui.goSub.textContent = r.sub;
  ui.goScore.textContent = r.score;
  ui.goBest.textContent = r.isBest ? '🎉 自己ベスト更新！' : `自己ベスト：${game.best} タッチ`;
  ui.goLevel.textContent = `到達：${r.levelName}（${Math.floor(game.elapsed)}秒）`;
  ui.gameOverScreen.classList.remove('hidden');
}

// ---------- ゲームループ ----------
let lastTime = performance.now();
let prevState = game.state;

function loop(now) {
  // 前のフレームから何秒たったか（タブを切りかえたときに大きくなりすぎないよう上限をつける）
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  update(dt);
  Draw.render();
  updateHud();

  // ゲームオーバーになった瞬間：少し待ってから結果画面を出す（落ちたところを見せるため）
  if (game.state !== prevState) {
    if (game.state === 'gameover') {
      setTimeout(() => {
        if (game.state === 'gameover') showGameOver();
      }, 1100);
    }
    prevState = game.state;
  }

  requestAnimationFrame(loop);
}

// ---------- はじめに一度だけ行う準備 ----------
game.best = loadBest();
ui.titleBest.textContent = game.best;
resetReferee();
Draw.init(ui.canvas);
Input.init(ui.canvas, ui.floatBtn, ui.dropBtn);
requestAnimationFrame(loop);
