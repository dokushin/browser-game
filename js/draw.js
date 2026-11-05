// =====================================================
// draw.js : 画面に絵を描くファイル
// game.js で計算した「いまの状態」を、canvas に描きます。
// メートル単位の座標を、画面のピクセルに変換して描いています。
// =====================================================

const TEAM_COLORS = ['#e74c3c', '#27ae60']; // チーム0（上）は赤、チーム1（下）は緑
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const TEXT_FONT = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic UI",Meiryo,sans-serif';

const Draw = {
  canvas: null,
  ctx: null,
  w: 0,      // canvas の幅（CSS ピクセル）
  h: 0,      // canvas の高さ
  scale: 1,  // 1メートルが何ピクセルか
  ox: 0,     // x = 0 の場所が画面の何ピクセル目か
  oy: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    // 画面の大きさが変わったら描き直す大きさも変える
    if (window.ResizeObserver) {
      new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    } else {
      window.addEventListener('resize', () => this.resize());
    }
  },

  // 画面の大きさに合わせて、コート全体が入るように拡大率を決める
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1; // スマホの高解像度画面でもくっきり描くため
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const vw = VIEW.right - VIEW.left;
    const vh = VIEW.bottom - VIEW.top;
    this.scale = Math.min(this.w / vw, this.h / vh);
    this.ox = (this.w - vw * this.scale) / 2 - VIEW.left * this.scale;
    this.oy = (this.h - vh * this.scale) / 2 - VIEW.top * this.scale;
  },

  // メートル → 画面のピクセル
  sx(x) {
    return this.ox + x * this.scale;
  },
  sy(y) {
    return this.oy + y * this.scale;
  },

  // ボールは高さがあるぶん、画面では少し上にずらして描く（影との距離で高さがわかる）
  ballScreenPos() {
    const b = game.ball;
    return { x: this.sx(b.x), y: this.sy(b.y) - b.h * this.scale * 0.45 };
  },

  // =====================================================
  // 1フレーム分を描く
  // =====================================================
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    this.drawCourt();
    this.drawNet();
    this.drawReferee();

    if (game.ball && game.state !== 'title') {
      this.drawTargetMark();
      this.drawBallShadow();
      // 奥（画面の上）にいる人から順に描くと、重なりが自然になる
      const players = [...game.players].sort((a, b) => a.y - b.y);
      for (const p of players) this.drawPlayer(p);
      this.drawBall();

      // セリフは一番上に重ねる
      for (const p of game.players) {
        if (p.speech) this.drawBubble(p.speech.text, this.sx(p.x), this.sy(p.y) - this.scale * 0.6, '#ffffff', '#222');
      }
      if (game.ball.speech) {
        const bp = this.ballScreenPos();
        this.drawBubble(game.ball.speech.text, bp.x, bp.y - this.scale * 0.6, '#fff3b0', '#5a3b00');
      }
      this.drawEffects();
    }

    // 審判のセリフ
    const ref = game.referee;
    if (ref && ref.speech) {
      this.drawBubble(ref.speech.text, this.sx(-1.4), this.sy(NET_Y) - this.scale * 1.1, '#222', '#fff');
    }

    if (game.state === 'serving') this.drawCenterText('サーブ！', '');
    if (game.state === 'levelup' && game.banner) this.drawCenterText(game.banner.title, game.banner.sub);

    this.drawJoystick();
  },

  // ---------- コート ----------
  drawCourt() {
    const ctx = this.ctx;
    const s = this.scale;
    // まわり（フリーゾーン）
    ctx.fillStyle = '#2f6db5';
    ctx.fillRect(0, 0, this.w, this.h);
    // コートの中
    ctx.fillStyle = '#e8893f';
    ctx.fillRect(this.sx(0), this.sy(0), COURT_W * s, COURT_L * s);
    // 白線
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.strokeRect(this.sx(0), this.sy(0), COURT_W * s, COURT_L * s);
    // アタックライン（ネットから3mの線）
    for (const y of [NET_Y - 3, NET_Y + 3]) {
      ctx.beginPath();
      ctx.moveTo(this.sx(0), this.sy(y));
      ctx.lineTo(this.sx(COURT_W), this.sy(y));
      ctx.stroke();
    }
  },

  // ---------- ネット ----------
  drawNet() {
    const ctx = this.ctx;
    const s = this.scale;
    const y = this.sy(NET_Y);
    // ネットの影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(this.sx(-0.6), y, (COURT_W + 1.2) * s, s * 0.25);
    // ネット本体
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(this.sx(-0.6), y - s * 0.09, (COURT_W + 1.2) * s, s * 0.18);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.sx(-0.6), y - s * 0.09, (COURT_W + 1.2) * s, s * 0.05);
    // 支柱
    ctx.fillStyle = '#cfd6df';
    for (const x of [-0.6, COURT_W + 0.6]) {
      ctx.beginPath();
      ctx.arc(this.sx(x), y, s * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // ---------- 審判 ----------
  drawReferee() {
    const ref = game.referee;
    const ctx = this.ctx;
    const s = this.scale;
    const x = this.sx(-1.4);
    const y = this.sy(NET_Y);
    // 審判台
    ctx.fillStyle = '#5b4636';
    ctx.fillRect(x - s * 0.45, y - s * 0.45, s * 0.9, s * 0.9);

    // 顔：よそ見中か、怪しみ度で表情が変わる
    let face = '😐';
    if (ref && ref.mode === 'away' && game.state === 'play') face = ref.away.emoji;
    else if (game.state === 'gameover' && game.result && game.result.reason === 'caught') face = '😤';
    else if (game.suspicion >= 85) face = '😠';
    else if (game.suspicion >= 30) face = '🤨';
    this.drawEmoji(face, x, y, s * 0.85);

    // 見ているかどうかの表示
    if (ref && game.state === 'play') {
      const away = ref.mode === 'away';
      const label = away ? `${ref.away.label}` : '見てる';
      ctx.font = `bold ${Math.max(10, s * 0.32)}px ${TEXT_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width + 8;
      const lx = Math.max(tw / 2 + 2, x);
      const ly = y + s * 0.75;
      ctx.fillStyle = away ? '#2ecc71' : '#c0392b';
      this.roundRect(lx - tw / 2, ly - s * 0.22, tw, s * 0.44, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, lx, ly + 1);
    }
  },

  // ---------- 選手 ----------
  drawPlayer(p) {
    const ctx = this.ctx;
    const s = this.scale;
    const x = this.sx(p.x);
    const y = this.sy(p.y);
    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.3, s * 0.42, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    // ユニフォームの色の丸
    ctx.fillStyle = TEAM_COLORS[p.team];
    ctx.beginPath();
    ctx.arc(x, y, s * 0.46, 0, Math.PI * 2);
    ctx.fill();
    // リベロは色ちがいのユニフォーム
    if (p.type === 'libero') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.stroke();
    }
    // 顔
    this.drawEmoji(PLAYER_TYPES[p.type].emoji, x, y, s * 0.72);
  },

  // ボールを追いかける人が向かっている場所に、うすく印をつける
  drawTargetMark() {
    if (!game.target || !game.chaser) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(this.sx(game.target.x), this.sy(game.target.y), this.scale * REACH * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  // ---------- ボール ----------
  drawBallShadow() {
    const b = game.ball;
    const ctx = this.ctx;
    const s = this.scale;
    const alpha = clamp(0.4 - b.h * 0.04, 0.12, 0.4);
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(this.sx(b.x), this.sy(b.y), s * 0.32, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // 影とボールを点線で結んで、高さをわかりやすくする
    const bp = this.ballScreenPos();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([2, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.sx(b.x), this.sy(b.y));
    ctx.lineTo(bp.x, bp.y);
    ctx.stroke();
    ctx.restore();
  },

  drawBall() {
    const b = game.ball;
    const ctx = this.ctx;
    const bp = this.ballScreenPos();
    const r = this.scale * 0.42 * (1 + b.h * 0.09); // 高いところにあるほど大きく見える

    // ボール本体（黄色と青のしま模様）
    ctx.save();
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(bp.x - r, bp.y - r, r * 2, r * 2);
    ctx.lineWidth = r * 0.42;
    ctx.strokeStyle = '#2b6cd4';
    ctx.beginPath();
    ctx.arc(bp.x - r * 1.35, bp.y + r * 0.2, r * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bp.x + r * 1.35, bp.y + r * 0.2, r * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // ふちどり
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = Math.max(1.2, r * 0.08);
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
    ctx.stroke();

    this.drawBallFace(bp.x, bp.y, r, b.expr);
  },

  // ボールの顔。expr（表情の名前）ごとに目と口の形を変える
  drawBallFace(cx, cy, r, expr) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#3a2a1a';
    ctx.fillStyle = '#3a2a1a';
    ctx.lineWidth = Math.max(1.2, r * 0.11);
    ctx.lineCap = 'round';
    const ex = r * 0.34;  // 目の横の位置
    const ey = -r * 0.12; // 目の縦の位置

    // 小さな描画用の関数
    const dot = (x, y, rad) => {
      ctx.beginPath();
      ctx.arc(cx + x, cy + y, rad, 0, Math.PI * 2);
      ctx.fill();
    };
    const line = (x1, y1, x2, y2) => {
      ctx.beginPath();
      ctx.moveTo(cx + x1, cy + y1);
      ctx.lineTo(cx + x2, cy + y2);
      ctx.stroke();
    };
    const arc = (x, y, rad, a1, a2) => {
      ctx.beginPath();
      ctx.arc(cx + x, cy + y, rad, a1, a2);
      ctx.stroke();
    };
    const smile = () => arc(0, r * 0.1, r * 0.28, Math.PI * 0.2, Math.PI * 0.8);
    const blush = () => {
      ctx.fillStyle = 'rgba(255,105,140,0.55)';
      dot(-r * 0.55, r * 0.15, r * 0.14);
      dot(r * 0.55, r * 0.15, r * 0.14);
      ctx.fillStyle = '#3a2a1a';
    };
    const sweat = () => {
      ctx.fillStyle = '#7fd3ff';
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.78, cy - r * 0.75);
      ctx.quadraticCurveTo(cx + r * 0.6, cy - r * 0.35, cx + r * 0.78, cy - r * 0.3);
      ctx.quadraticCurveTo(cx + r * 0.96, cy - r * 0.35, cx + r * 0.78, cy - r * 0.75);
      ctx.fill();
      ctx.fillStyle = '#3a2a1a';
    };
    const wavyMouth = (w) => {
      ctx.beginPath();
      const steps = 4;
      for (let i = 0; i <= steps; i++) {
        const x = cx - w + (2 * w * i) / steps;
        const y = cy + r * 0.38 + (i % 2 === 0 ? 0 : r * 0.1);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    switch (expr) {
      case 'pain': // 「> <」の目と、ぐにゃっとした口
        line(-ex - r * 0.12, ey - r * 0.12, -ex + r * 0.1, ey);
        line(-ex + r * 0.1, ey, -ex - r * 0.12, ey + r * 0.12);
        line(ex + r * 0.12, ey - r * 0.12, ex - r * 0.1, ey);
        line(ex - r * 0.1, ey, ex + r * 0.12, ey + r * 0.12);
        wavyMouth(r * 0.28);
        break;
      case 'ouch': // 片目をつぶる
        line(-ex - r * 0.12, ey, -ex + r * 0.12, ey);
        dot(ex, ey, r * 0.09);
        line(-r * 0.16, r * 0.38, r * 0.16, r * 0.38);
        break;
      case 'happy': // 「^ ^」の目とほっぺ
        arc(-ex, ey + r * 0.06, r * 0.13, Math.PI * 1.15, Math.PI * 1.85);
        arc(ex, ey + r * 0.06, r * 0.13, Math.PI * 1.15, Math.PI * 1.85);
        smile();
        blush();
        break;
      case 'gentle': // キラキラした目と、「…え？」という小さい口
        dot(-ex, ey, r * 0.13);
        dot(ex, ey, r * 0.13);
        ctx.fillStyle = '#ffffff';
        dot(-ex + r * 0.04, ey - r * 0.05, r * 0.05);
        dot(ex + r * 0.04, ey - r * 0.05, r * 0.05);
        ctx.fillStyle = '#3a2a1a';
        arc(0, r * 0.36, r * 0.08, 0, Math.PI * 2);
        blush();
        break;
      case 'scared': // 大きく見開いた目と「O」の口、冷や汗
        ctx.fillStyle = '#ffffff';
        dot(-ex, ey, r * 0.16);
        dot(ex, ey, r * 0.16);
        ctx.fillStyle = '#3a2a1a';
        arc(-ex, ey, r * 0.16, 0, Math.PI * 2);
        arc(ex, ey, r * 0.16, 0, Math.PI * 2);
        dot(-ex, ey, r * 0.06);
        dot(ex, ey, r * 0.06);
        arc(0, r * 0.38, r * 0.12, 0, Math.PI * 2);
        sweat();
        break;
      case 'nervous': // そわそわ（冷や汗と、ふにゃっとした口）
        dot(-ex, ey, r * 0.09);
        dot(ex, ey, r * 0.09);
        wavyMouth(r * 0.18);
        sweat();
        break;
      case 'float': // 目を閉じて気持ちよさそう
        arc(-ex, ey - r * 0.04, r * 0.12, Math.PI * 0.15, Math.PI * 0.85);
        arc(ex, ey - r * 0.04, r * 0.12, Math.PI * 0.15, Math.PI * 0.85);
        smile();
        break;
      case 'drop': // きりっとした顔
        line(-ex - r * 0.14, ey - r * 0.22, -ex + r * 0.12, ey - r * 0.12);
        line(ex + r * 0.14, ey - r * 0.22, ex - r * 0.12, ey - r * 0.12);
        dot(-ex, ey + r * 0.02, r * 0.08);
        dot(ex, ey + r * 0.02, r * 0.08);
        line(-r * 0.18, r * 0.38, r * 0.18, r * 0.38);
        break;
      case 'tired': // 半目でへとへと
        line(-ex - r * 0.12, ey, -ex + r * 0.12, ey);
        line(ex - r * 0.12, ey, ex + r * 0.12, ey);
        dot(-ex, ey + r * 0.05, r * 0.06);
        dot(ex, ey + r * 0.05, r * 0.06);
        arc(0, r * 0.4, r * 0.09, Math.PI, Math.PI * 2);
        break;
      default: // ふつうの顔
        dot(-ex, ey, r * 0.09);
        dot(ex, ey, r * 0.09);
        smile();
    }
    ctx.restore();
  },

  // ---------- 浮かぶ数字（-22 や +8） ----------
  drawEffects() {
    const ctx = this.ctx;
    for (const e of game.effects) {
      ctx.globalAlpha = clamp(e.timer / 0.5, 0, 1);
      ctx.font = `bold ${Math.max(14, this.scale * 0.6)}px ${TEXT_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      // 吹き出し（ボールの上）とかぶらないよう、ボールの右横に出す
      const x = this.sx(e.x) + this.scale * 1.1;
      const y = this.sy(e.y) - this.scale * 0.3;
      ctx.strokeText(e.text, x, y);
      ctx.fillStyle = e.color;
      ctx.fillText(e.text, x, y);
      ctx.globalAlpha = 1;
    }
  },

  // ---------- 吹き出し ----------
  drawBubble(text, x, y, bg, fg) {
    const ctx = this.ctx;
    const fs = clamp(this.scale * 0.42, 11, 16);
    ctx.font = `bold ${fs}px ${TEXT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(text).width;
    const bw = tw + fs * 1.0;
    const bh = fs * 1.7;
    // 画面からはみ出さないように位置を調整
    const bx = clamp(x, bw / 2 + 4, this.w - bw / 2 - 4);
    const by = clamp(y - bh / 2, bh / 2 + 4, this.h - bh / 2 - 4);
    ctx.fillStyle = bg;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    this.roundRect(bx - bw / 2, by - bh / 2, bw, bh, bh / 2);
    ctx.fill();
    ctx.stroke();
    // しっぽ
    ctx.beginPath();
    ctx.moveTo(clamp(x, bx - bw / 2 + 8, bx + bw / 2 - 8) - 5, by + bh / 2 - 1);
    ctx.lineTo(clamp(x, bx - bw / 2 + 8, bx + bw / 2 - 8), by + bh / 2 + 6);
    ctx.lineTo(clamp(x, bx - bw / 2 + 8, bx + bw / 2 - 8) + 5, by + bh / 2 - 1);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.fillText(text, bx, by + 1);
  },

  // ---------- 画面のまんなかの大きな文字 ----------
  drawCenterText(title, sub) {
    const ctx = this.ctx;
    const cy = this.h * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, cy - 48, this.w, sub ? 96 : 70);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${clamp(this.w * 0.08, 22, 36)}px ${TEXT_FONT}`;
    ctx.fillText(title, this.w / 2, cy - (sub ? 14 : 13));
    if (sub) {
      ctx.font = `bold ${clamp(this.w * 0.04, 13, 18)}px ${TEXT_FONT}`;
      ctx.fillStyle = '#ffe066';
      ctx.fillText(sub, this.w / 2, cy + 26);
    }
  },

  // ---------- なぞっている場所の目印（バーチャルスティック） ----------
  drawJoystick() {
    if (!Input.isDragging() || game.state !== 'play') return;
    const ctx = this.ctx;
    const o = Input.origin;
    const steer = Input.getSteer();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(o.x, o.y, Input.JOY_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(o.x + steer.x * Input.JOY_RADIUS, o.y + steer.y * Input.JOY_RADIUS, 16, 0, Math.PI * 2);
    ctx.fill();
  },

  // ---------- 小さな道具 ----------
  drawEmoji(emoji, x, y, size) {
    const ctx = this.ctx;
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, x, y + size * 0.06);
  },

  // 角の丸い四角形の形を作る（塗るのは呼び出した側）
  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
};
