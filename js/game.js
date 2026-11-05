// =====================================================
// game.js : ゲームのルールと動きを計算するファイル
// 画面に描く処理は draw.js、操作の受け取りは input.js にあります。
//
// 座標の決まり（単位はメートル）
//   x : コートの横方向（0 〜 9）
//   y : コートの縦方向（0 〜 18）。y = 9 がネット
//   h : ボールの高さ（0 が床）
// =====================================================

// ゲームの状態をまとめて入れておく入れ物
const game = {
  state: 'title',   // 'title'（タイトル） / 'serving'（サーブ前） / 'play'（ラリー中） / 'levelup' / 'gameover'
  stateTimer: 0,    // いまの状態が終わるまでの残り時間
  hp: BALL_MAX_HP,  // ボールの体力
  touches: 0,       // ボールがさわられた回数（これがスコア）
  elapsed: 0,       // ラリーが続いている時間（秒）
  levelIndex: 0,    // いまのレベル（LEVELS の何番目か）
  suspicion: 0,     // 審判の怪しみ度（0 〜 100）
  best: 0,          // 自己ベスト

  ball: null,
  players: [],
  referee: null,

  // ラリーのルールを管理するための情報
  touchTeam: -1,     // 最後にさわったチーム
  touchCount: 0,     // そのチームが続けて何回さわったか（3回まで）
  lastToucher: null, // 最後にさわった選手（同じ人が2回続けてさわるのは反則）
  next: null,        // 次にさわる予定 { side: チーム, count: 何回目のタッチか }
  chaser: null,      // いまボールを追いかけている選手
  target: null,      // 追いかけている選手が向かっている場所
  watchingOut: false,// 「アウトだ」と思って見送っているか

  servingTeam: 1,
  server: null,
  whistled: false,
  banner: null,      // 画面のまんなかに出す大きな文字
  result: null,      // ゲームオーバーの理由
  effects: [],       // 「-22」のように浮かび上がる数字
  doubtCooldown: 0,  // 選手が「ボール変じゃない？」と言う間隔
  tiredSaid: false,
};

// ---------- 便利な小さい関数 ----------
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
// 配列の順番をランダムに並べかえる
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
// 「ネットから d メートルはなれた場所」の y 座標（チーム0は上側、チーム1は下側）
function yFromNet(team, d) {
  return team === 0 ? NET_Y - d : NET_Y + d;
}
// コートの外か？（ラインの上はイン）
function isOut(x, y) {
  const m = 0.15;
  return x < -m || x > COURT_W + m || y < -m || y > COURT_L + m;
}
// 選手・ボール・審判にセリフをしゃべらせる
function say(who, text, time = 1.6) {
  who.speech = { text, timer: time };
}

// ---------- ハイスコアの保存 ----------
// ブラウザの localStorage に保存します。プライベートモードなどでは使えないことがあるので try で囲みます。
function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch (e) {
    return 0;
  }
}
function saveBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch (e) {
    // 保存できなくてもゲームは続けられるので、何もしない
  }
}

// =====================================================
// ゲームの準備
// =====================================================

// 新しいゲームを始める
function newGame() {
  game.hp = BALL_MAX_HP;
  game.touches = 0;
  game.elapsed = 0;
  game.levelIndex = 0;
  game.suspicion = 0;
  game.effects = [];
  game.result = null;
  game.tiredSaid = false;
  game.doubtCooldown = 0;
  game.ball = {
    x: 0, y: 0, h: 0,     // 位置と高さ
    vx: 0, vy: 0, vz: 0,  // 速さ（vz は上下方向）
    dx: 0, dy: 0,         // 「ボールの気持ち」で自分からずれている速さ
    gFactor: 1,           // 重力の倍率（ふわっ / ストン）
    expr: 'normal',       // 表情
    exprTimer: 0,
    speech: null,
    lineCooldown: 0,      // ボールがしゃべりすぎないための待ち時間
    prevFloat: false,
    prevDrop: false,
  };
  resetReferee();
  setupTeams(0);
  startServe();
}

function resetReferee() {
  const level = LEVELS[game.levelIndex];
  game.referee = {
    mode: 'watch', // 'watch'（見ている） / 'away'（よそ見中）
    timer: rand(level.watchTime[0], level.watchTime[1]),
    away: null,
    said: {},      // どのセリフをもう言ったか
    speech: null,
  };
}

// レベルに合わせて、両チームのメンバーを決める
function setupTeams(levelIndex) {
  const level = LEVELS[levelIndex];
  game.players = [];
  // リベロ以外の5人の定位置（前衛3人・後衛2人）。d はネットからの距離
  const spots = [
    { x: 1.6, d: 2.2, row: 'front' },
    { x: 4.5, d: 2.2, row: 'front' },
    { x: 7.4, d: 2.2, row: 'front' },
    { x: 1.6, d: 6.6, row: 'back' },
    { x: 7.4, d: 6.6, row: 'back' },
  ];
  for (let team = 0; team < 2; team++) {
    // メンバー表：決まった3人 ＋ 残り2人（レベルが上がると先輩が増える）
    const members = ['kowamote', 'kouhai', 'server'];
    for (let i = 0; i < 2; i++) members.push(i < level.senpai[team] ? 'senpai' : 'normal');
    shuffle(members);
    members.forEach((type, i) => addPlayer(team, type, spots[i]));
    // リベロはいつも後衛のまんなか
    addPlayer(team, 'libero', { x: 4.5, d: 6.6, row: 'back' });
  }
}

function addPlayer(team, type, spot) {
  const homeY = yFromNet(team, spot.d);
  game.players.push({
    team, type, row: spot.row,
    homeX: spot.x, homeY,  // 定位置
    x: spot.x, y: homeY,   // いまの位置
    speech: null,
  });
}

// サーブの準備をする
function startServe() {
  game.servingTeam = game.levelIndex % 2 === 0 ? 1 : 0; // レベルごとにサーブするチームを交代
  const server = game.players.find((p) => p.team === game.servingTeam && p.type === 'server');
  game.server = server;
  // サーブする人はエンドラインの外に立つ
  server.x = clamp(server.homeX, 1.5, 7.5);
  server.y = game.servingTeam === 1 ? COURT_L + 1.0 : -1.0;

  game.touchTeam = -1;
  game.touchCount = 0;
  game.lastToucher = null;
  game.next = null;
  game.chaser = null;
  game.target = null;
  game.watchingOut = false;
  game.whistled = false;

  const b = game.ball;
  b.x = server.x + 0.3;
  b.y = server.y;
  b.h = 1.2;
  b.vx = b.vy = b.vz = b.dx = b.dy = 0;
  b.gFactor = 1;
  b.expr = 'normal';

  game.state = 'serving';
  game.stateTimer = 1.8;
}

// =====================================================
// 毎フレーム（1秒に約60回）呼ばれる処理
// =====================================================
function update(dt) {
  updateTimers(dt);

  if (game.state === 'serving') {
    updateServing(dt);
  } else if (game.state === 'play') {
    game.elapsed += dt;
    // 一定時間たったら次のレベルへ
    const lv = Math.min(Math.floor(game.elapsed / LEVEL_DURATION), LEVELS.length - 1);
    if (lv > game.levelIndex) {
      startLevelUp(lv);
      return;
    }
    updateBall(dt);
    if (game.state !== 'play') return; // ボールが落ちてゲームオーバーになったら、ここで終わり
    updatePlayers(dt);
    checkTouch();
    if (game.state !== 'play') return;
    updateReferee(dt);
    updateBallExpression();
  } else if (game.state === 'levelup') {
    game.stateTimer -= dt;
    if (game.stateTimer <= 0) {
      game.banner = null;
      setupTeams(game.levelIndex);
      resetReferee();
      startServe();
    }
  }
}

// セリフや浮かぶ数字の残り時間を減らす
function updateTimers(dt) {
  const talkers = [...game.players];
  if (game.ball) talkers.push(game.ball);
  if (game.referee) talkers.push(game.referee);
  for (const t of talkers) {
    if (t.speech) {
      t.speech.timer -= dt;
      if (t.speech.timer <= 0) t.speech = null;
    }
  }
  if (game.ball) {
    game.ball.exprTimer -= dt;
    game.ball.lineCooldown -= dt;
  }
  for (const e of game.effects) {
    e.timer -= dt;
    e.y -= dt * 0.8; // 上へふわっと動く
  }
  game.effects = game.effects.filter((e) => e.timer > 0);
}

// サーブ前：選手は定位置へ、サーブする人はボールを持って待つ
function updateServing(dt) {
  game.stateTimer -= dt;
  const s = game.server;
  for (const p of game.players) {
    if (p !== s) moveToward(p, p.homeX, p.homeY, WALK_SPEED * 2 * dt);
  }
  // ボールを手の上でポンポンさせる
  const b = game.ball;
  b.x = s.x + 0.3;
  b.y = s.y;
  b.h = 1.2 + Math.abs(Math.sin(game.stateTimer * 5)) * 0.5;

  if (!game.whistled && game.stateTimer < 0.9) {
    game.whistled = true;
    Sound.whistle(false);
    say(game.referee, 'ピッ！', 0.8);
  }
  if (game.stateTimer <= 0) doServe();
}

// サーブを打つ
function doServe() {
  const s = game.server;
  const b = game.ball;
  game.state = 'play';
  // サーブも「そのチームの最後のタッチ」とみなす。
  // もし自分のコートにもどってきたら、4回目の反則になる
  game.touchTeam = s.team;
  game.touchCount = 3;
  game.lastToucher = s;
  b.h = 2.6;
  const other = 1 - s.team;
  launch(rand(1.0, 8.0), yFromNet(other, rand(3.0, 8.0)), TOUCH_HEIGHT[1], rand(1.4, 1.6));
  onTouched(s, 'serve');
}

// 次のレベルへ進む
function startLevelUp(lv) {
  game.levelIndex = lv;
  game.state = 'levelup';
  game.stateTimer = 2.6;
  game.hp = Math.min(BALL_MAX_HP, game.hp + 25);
  game.suspicion = 0;
  game.chaser = null;
  game.target = null;
  game.banner = { title: `${LEVELS[lv].name}へ進出！`, sub: 'ベンチで少し休めた（HP +25）' };
  Sound.levelUp();
}

// =====================================================
// ボールの動き
// =====================================================
function updateBall(dt) {
  const b = game.ball;

  // --- 落ちる速さを変える（ふわっ / ストン） ---
  const floating = Input.float && !Input.drop;
  const dropping = Input.drop && !Input.float;
  b.gFactor = floating ? FLOAT_GRAVITY : dropping ? DROP_GRAVITY : 1;
  if (floating && !b.prevFloat) ballSay(pick(BALL_LINES.float), 0.5);
  if (dropping && !b.prevDrop) ballSay(pick(BALL_LINES.drop), 0.5);
  b.prevFloat = floating;
  b.prevDrop = dropping;

  // --- なぞった方向に、少しずつずらす ---
  const s = Input.getSteer();
  b.dx += s.x * STEER_ACCEL * dt;
  b.dy += s.y * STEER_ACCEL * dt;
  const driftSpeed = Math.hypot(b.dx, b.dy);
  if (driftSpeed > STEER_MAX) {
    b.dx *= STEER_MAX / driftSpeed;
    b.dy *= STEER_MAX / driftSpeed;
  }
  // 指をはなすと、ずれる勢いは少しずつおさまる
  if (s.mag === 0) {
    const keep = Math.max(0, 1 - 1.5 * dt);
    b.dx *= keep;
    b.dy *= keep;
  }

  // --- 位置を進める ---
  const prevY = b.y;
  b.x += (b.vx + b.dx) * dt;
  b.y += (b.vy + b.dy) * dt;
  b.vz -= GRAVITY * b.gFactor * dt; // 重力で下向きに加速
  b.h += b.vz * dt;

  // --- ネットに引っかかったか？ ---
  const crossedNet = (prevY - NET_Y) * (b.y - NET_Y) < 0;
  if (crossedNet && b.h < NET_H && b.x > -0.5 && b.x < COURT_W + 0.5) {
    b.y = prevY; // もとのコートにはね返る
    b.vy *= -0.25;
    b.dy *= -0.25;
    b.vx *= 0.4;
    b.dx *= 0.4;
    ballSay(pick(BALL_LINES.net), 0);
    Sound.net();
  }

  // --- 床に落ちたらゲームオーバー ---
  if (b.h <= 0) {
    b.h = 0;
    endGame(isOut(b.x, b.y) ? 'out' : 'floor');
  }
}

// ボールが「高さ targetH」まで落ちてきたときの場所を予想する
// 放物線の式  h + vz*t - (1/2)*g*t^2 = targetH  を t について解いています。
function predictPoint(targetH) {
  const b = game.ball;
  const g = GRAVITY * b.gFactor;
  const disc = b.vz * b.vz + 2 * g * (b.h - targetH);
  let t = disc >= 0 ? (b.vz + Math.sqrt(disc)) / g : 0;
  if (t < 0) t = 0;
  return { x: b.x + (b.vx + b.dx) * t, y: b.y + (b.vy + b.dy) * t };
}

// ボールを (toX, toY) に向けて打ち出す。T 秒後に高さ hEnd でそこに届く
function launch(toX, toY, hEnd, T) {
  const b = game.ball;
  b.vx = (toX - b.x) / T;
  b.vy = (toY - b.y) / T;
  b.vz = (hEnd - b.h + 0.5 * GRAVITY * T * T) / T;
  b.dx = 0;
  b.dy = 0;
}

// =====================================================
// 選手の動き
// =====================================================
function updatePlayers(dt) {
  // ボールがどちらのコートに落ちそうかで、さわるチームが決まる
  const land = predictPoint(0);
  const side = land.y < NET_Y ? 0 : 1;
  const count = side === game.touchTeam ? game.touchCount + 1 : 1;
  game.next = { side, count };

  // 相手から来たボールがアウトになりそうなら、さわらずに見送る
  const goingOut = count === 1 && isOut(land.x, land.y);
  if (goingOut) {
    if (!game.watchingOut) {
      game.watchingOut = true;
      const p = nearestPlayer(side, land.x, land.y);
      if (p) say(p, 'アウト！', 1.2);
    }
    game.chaser = null;
    game.target = null;
  } else {
    game.watchingOut = false;
    // そのタッチをする高さに、ボールが来る場所を予想して走る
    const target = predictPoint(TOUCH_HEIGHT[Math.min(count, 4)]);
    // ネットをこえて相手のコートには入れない
    target.y = side === 0 ? Math.min(target.y, NET_Y - 0.25) : Math.max(target.y, NET_Y + 0.25);
    game.target = target;
    chooseChaser(side, count, target);
  }

  for (const p of game.players) {
    if (p === game.chaser) {
      moveToward(p, game.target.x, game.target.y, RUN_SPEED * dt);
    } else {
      moveToward(p, p.homeX, p.homeY, WALK_SPEED * dt);
    }
  }
}

// ボールを追いかける人を決める
function chooseChaser(side, count, target) {
  // この人はボールを追いかけてもいいか？
  const canChase = (p) =>
    p.team === side &&
    p !== game.lastToucher &&                // 同じ人が2回続けてさわるのは反則（ドリブル）
    !(count === 3 && p.type === 'libero');   // リベロはスパイクを打てない

  let best = null;
  let bestD = Infinity;
  for (const p of game.players) {
    if (!canChase(p)) continue;
    const d = dist(p.x, p.y, target.x, target.y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  // さっきまで追いかけていた人がまだ近いなら、その人にまかせる（追いかける人がコロコロ変わらないように）
  const cur = game.chaser;
  if (cur && cur !== best && canChase(cur) && dist(cur.x, cur.y, target.x, target.y) < bestD + 0.8) {
    best = cur;
  }

  if (best !== game.chaser) {
    game.chaser = best;
    if (best && count === 1) say(best, 'オーライ！', 1.0);
    // 見た目がこわい人が来たら、ボールがおびえる（本当にこわいかはわからないけど…）
    if (best && looksScary(best)) ballSay(pick(BALL_LINES.scared), 0.7);
  }
}

function looksScary(p) {
  return p.type === 'senpai' || p.type === 'kowamote';
}

function nearestPlayer(side, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const p of game.players) {
    if (p.team !== side) continue;
    const d = dist(p.x, p.y, x, y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

// 選手を (tx, ty) に向かって最大 step メートル動かす
function moveToward(p, tx, ty, step) {
  const d = dist(p.x, p.y, tx, ty);
  if (d <= step) {
    p.x = tx;
    p.y = ty;
  } else {
    p.x += ((tx - p.x) / d) * step;
    p.y += ((ty - p.y) / d) * step;
  }
  // 動ける範囲を決める（ネットはこえられない）
  p.x = clamp(p.x, -1.8, COURT_W + 1.8);
  p.y = p.team === 0 ? clamp(p.y, -1.8, NET_Y - 0.25) : clamp(p.y, NET_Y + 0.25, COURT_L + 1.8);
}

// =====================================================
// ボールにさわる
// =====================================================

// 追いかけている人の手が届いたら、ボールにさわる
function checkTouch() {
  const p = game.chaser;
  const b = game.ball;
  if (!p || !game.next) return;
  const touchH = TOUCH_HEIGHT[Math.min(game.next.count, 4)];
  const falling = b.vz < 0;
  if (falling && b.h <= touchH && dist(p.x, p.y, b.x, b.y) <= REACH) {
    doTouch(p, game.next.count);
  }
}

function doTouch(p, count) {
  // 同じチームが4回さわるのは反則（フォアヒット）
  if (count > 3) {
    say(game.referee, 'フォアヒット！', 2);
    endGame('foul4');
    return;
  }
  const b = game.ball;
  const level = LEVELS[game.levelIndex];
  const other = 1 - p.team;
  game.touchTeam = p.team;
  game.touchCount = count;
  game.lastToucher = p;
  game.chaser = null;
  game.target = null;

  // 何回目のタッチかで、プレーの種類が決まる
  let action;
  if (count === 1) action = 'receive';
  else if (count === 2) action = 'toss';
  else action = b.h >= 1.8 && p.type !== 'libero' ? 'spike' : 'soft'; // 低すぎるとスパイクは打てない

  if (action === 'receive') {
    // レシーブ：ネット近くのセッターの場所へ上げる
    launch(rand(4.6, 5.8), yFromNet(p.team, rand(1.3, 1.9)), TOUCH_HEIGHT[2], rand(1.3, 1.5));
  } else if (action === 'toss') {
    // トス：前衛のだれかに上げる
    let attackers = game.players.filter((q) => q.team === p.team && q.row === 'front' && q !== p);
    if (attackers.length === 0) attackers = game.players.filter((q) => q.team === p.team && q !== p && q.type !== 'libero');
    const a = pick(attackers);
    launch(a.homeX, yFromNet(p.team, 1.0), TOUCH_HEIGHT[3], rand(1.05, 1.25));
  } else if (action === 'spike') {
    // スパイク：相手コートのどこかへ速く打ちこむ
    launch(rand(0.8, 8.2), yFromNet(other, rand(1.5, 8.2)), TOUCH_HEIGHT[1], level.spikeTime * rand(0.9, 1.1));
  } else {
    // やさしく返す：ふんわりと相手コートへ
    launch(rand(1.2, 7.8), yFromNet(other, rand(2.5, 7.5)), TOUCH_HEIGHT[1], rand(1.4, 1.7));
  }
  onTouched(p, action);
}

// さわられたときの HP の変化・セリフ・音
function onTouched(p, action) {
  const type = PLAYER_TYPES[p.type];
  const level = LEVELS[game.levelIndex];
  let dmg = type.damage[action];
  if (action === 'spike' || action === 'serve') dmg = Math.round(dmg * level.power);

  game.touches++;
  game.hp = clamp(game.hp - dmg, 0, BALL_MAX_HP);

  // 「-22」「+8」のような数字を浮かべる
  const b = game.ball;
  if (dmg !== 0) {
    game.effects.push({
      x: b.x, y: b.y,
      text: dmg > 0 ? `-${dmg}` : `+${-dmg}`,
      color: dmg > 0 ? '#ff4d4d' : '#3ddc84',
      timer: 0.9,
    });
  }

  // ボールの気持ち（表情とセリフ）
  if (dmg >= 18) {
    setBallFeeling('pain', BALL_LINES.pain, 0.8);
    Sound.hit(1);
  } else if (dmg >= 8) {
    setBallFeeling('ouch', BALL_LINES.ouch, 0.4);
    Sound.hit(0.55);
  } else if (dmg > 0) {
    Sound.hit(0.2);
  } else if (p.type === 'kowamote') {
    setBallFeeling('gentle', BALL_LINES.gentle, 1);
    Sound.soft();
    Sound.heal();
  } else {
    setBallFeeling('happy', BALL_LINES.happy, 0.7);
    Sound.soft();
    if (dmg < 0) Sound.heal();
  }

  // 選手のセリフ（後輩はかならず話しかけてくる）
  const lines = type.lines[action] || type.lines.any;
  const chance = p.type === 'kouhai' ? 1 : 0.45;
  if (lines && Math.random() < chance) say(p, pick(lines), 1.6);

  if (game.hp <= 0) {
    endGame('hp');
  } else if (game.hp < 30 && !game.tiredSaid) {
    game.tiredSaid = true;
    ballSay(pick(BALL_LINES.tired), 0);
  }
}

// ボールの表情を少しの間だけ変え、chance の確率でセリフも言う
function setBallFeeling(expr, lines, chance) {
  const b = game.ball;
  b.expr = expr;
  b.exprTimer = 0.9;
  if (Math.random() < chance) say(b, pick(lines), 1.3);
}

// ボールにしゃべらせる（cooldown 秒のあいだは次のセリフを言わない）
function ballSay(text, cooldown) {
  const b = game.ball;
  if (b.lineCooldown > 0) return;
  say(b, text, 1.2);
  b.lineCooldown = cooldown;
}

// ふだんのボールの表情を決める
function updateBallExpression() {
  const b = game.ball;
  if (b.exprTimer > 0) return; // さわられた直後の表情を表示中
  const c = game.chaser;
  if (c && looksScary(c) && dist(c.x, c.y, b.x, b.y) < 4) b.expr = 'scared';
  else if (b.gFactor < 1) b.expr = 'float';
  else if (b.gFactor > 1) b.expr = 'drop';
  else if (game.suspicion > 60) b.expr = 'nervous';
  else if (game.hp < 30) b.expr = 'tired';
  else b.expr = 'normal';
}

// =====================================================
// 審判と怪しみ度
// =====================================================
function updateReferee(dt) {
  const level = LEVELS[game.levelIndex];
  const ref = game.referee;

  // --- 見ている ⇔ よそ見 を交互にくりかえす ---
  ref.timer -= dt;
  if (ref.timer <= 0) {
    if (ref.mode === 'watch') {
      ref.mode = 'away';
      ref.away = pick(REFEREE_AWAY);
      ref.timer = rand(level.awayTime[0], level.awayTime[1]);
    } else {
      ref.mode = 'watch';
      ref.away = null;
      ref.timer = rand(level.watchTime[0], level.watchTime[1]);
      say(ref, '（チラッ）', 0.8);
    }
  }

  // --- ボールがどれだけ「不自然な動き」をしているか ---
  const steer = Input.getSteer();
  const fallControl = game.ball.gFactor !== 1 ? 1 : 0;
  const unnatural = steer.mag * 14 + fallControl * 10;
  if (unnatural > 0) {
    // よそ見中は、ほとんど気づかれない
    const watchRate = ref.mode === 'away' ? 0.15 : 1;
    game.suspicion += unnatural * level.suspicion * watchRate * dt;
  } else {
    game.suspicion -= 10 * dt; // 何もしなければ、少しずつ疑いが晴れる
  }
  game.suspicion = clamp(game.suspicion, 0, 100);

  // --- 怪しみ度に合わせて審判がつぶやく ---
  for (const th of [30, 60, 85]) {
    if (game.suspicion >= th && !ref.said[th] && ref.mode === 'watch') {
      ref.said[th] = true;
      say(ref, REFEREE_LINES[th], 1.6);
      Sound.suspicious(th);
    }
    if (game.suspicion < th - 12) ref.said[th] = false;
  }

  // --- 選手もときどき怪しむ ---
  game.doubtCooldown -= dt;
  if (game.suspicion > 50 && game.doubtCooldown <= 0) {
    const others = game.players.filter((p) => p !== game.chaser && !p.speech);
    if (others.length > 0) say(pick(others), pick(PLAYER_DOUBT_LINES), 1.8);
    game.doubtCooldown = rand(4, 7);
  }

  // --- 怪しみ度が満タンになったらバレる ---
  if (game.suspicion >= 100) endGame('caught');
}

// =====================================================
// ゲームオーバー
// =====================================================
function endGame(reason) {
  const rule = pick(FAKE_RULES); // 審判にバレたときの、ありえない反則名
  const texts = {
    floor:  { title: 'ボールが床に落ちた…', sub: '床、つめたい…' },
    out:    { title: 'アウト！', sub: 'だれもさわってくれなかった…' },
    foul4:  { title: 'フォアヒット！', sub: '同じチームが4回さわってしまった（反則）' },
    hp:     { title: 'HPがなくなった…', sub: 'もう弾めない…' },
    caught: { title: 'ピーーッ！', sub: `「${rule}」の反則！ 審判にバレてしまった…` },
  };
  const isBest = game.touches > game.best;
  if (isBest) {
    game.best = game.touches;
    saveBest(game.best);
  }
  game.result = { reason, ...texts[reason], score: game.touches, isBest, levelName: LEVELS[game.levelIndex].name };
  game.state = 'gameover';
  game.chaser = null;
  game.target = null;

  const b = game.ball;
  b.expr = reason === 'caught' ? 'scared' : 'pain';
  b.exprTimer = 99;
  if (reason === 'caught') {
    say(game.referee, `ピーーッ！「${rule}」の反則！`, 99);
    game.referee.mode = 'watch';
    Sound.whistle(true);
  } else {
    Sound.whistle(false);
    Sound.gameOver();
  }
}
