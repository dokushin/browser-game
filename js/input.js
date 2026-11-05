// =====================================================
// input.js : 指やキーボードの操作を受け取るファイル
// 「画面をなぞった向き」と「ふわっ / ストン ボタンが押されているか」を記録します。
// =====================================================

const Input = {
  JOY_RADIUS: 60, // この距離（px）までなぞると「全力でずらす」になる

  // なぞり操作の情報
  pointerId: null,        // いまなぞっている指の番号（なぞっていないときは null）
  origin: { x: 0, y: 0 }, // 指を置いた場所
  current: { x: 0, y: 0 },// 指のいまの場所

  buttons: { float: false, drop: false }, // 画面のボタンが押されているか
  keys: {},                               // 押されているキーボードのキー

  // 「ふわっ」「ストン」が押されているか（ボタンとキーボードのどちらでもOK）
  get float() {
    return this.buttons.float || !!this.keys.KeyZ;
  },
  get drop() {
    return this.buttons.drop || !!this.keys.KeyX;
  },

  init(canvas, floatBtn, dropBtn) {
    // --- 画面をなぞる操作 ---
    canvas.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null) return; // 2本目の指は無視する
      this.pointerId = e.pointerId;
      this.origin = this.localPos(canvas, e);
      this.current = { ...this.origin };
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.current = this.localPos(canvas, e);
      e.preventDefault();
    });
    const endDrag = (e) => {
      if (e.pointerId === this.pointerId) this.pointerId = null;
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    // --- ふわっ / ストン ボタン（押している間だけ効く） ---
    this.bindHoldButton(floatBtn, 'float');
    this.bindHoldButton(dropBtn, 'drop');

    // --- キーボード（パソコン用） ---
    const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX'];
    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.includes(e.code)) {
        this.keys[e.code] = true;
        e.preventDefault(); // 矢印キーで画面がスクロールしないようにする
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    // ウィンドウから離れたら、押しっぱなし扱いにならないよう全部はなす
    window.addEventListener('blur', () => {
      this.keys = {};
      this.pointerId = null;
    });
  },

  // ボタンを「押している間だけ true」にする
  bindHoldButton(btn, name) {
    const press = (e) => {
      e.preventDefault();
      this.buttons[name] = true;
      btn.classList.add('pressed');
      if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
    };
    const release = () => {
      this.buttons[name] = false;
      btn.classList.remove('pressed');
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (e) => e.preventDefault()); // 長押しメニューを出さない
  },

  // 画面上の位置を、canvas の左上を (0, 0) とした位置に直す
  localPos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  },

  isDragging() {
    return this.pointerId !== null;
  },

  // ボールをずらしたい向きと強さを返す
  //   x, y : 向き（それぞれ -1 〜 1）  mag : 強さ（0 〜 1）
  getSteer() {
    let x = 0;
    let y = 0;
    if (this.isDragging()) {
      x = (this.current.x - this.origin.x) / this.JOY_RADIUS;
      y = (this.current.y - this.origin.y) / this.JOY_RADIUS;
    }
    const k = this.keys;
    if (k.ArrowLeft || k.KeyA) x -= 1;
    if (k.ArrowRight || k.KeyD) x += 1;
    if (k.ArrowUp || k.KeyW) y -= 1;
    if (k.ArrowDown || k.KeyS) y += 1;

    let mag = Math.hypot(x, y);
    if (mag > 1) {
      x /= mag;
      y /= mag;
      mag = 1;
    }
    // ほんの少しの指のブレは無視する
    if (mag < 0.12) return { x: 0, y: 0, mag: 0 };
    return { x, y, mag };
  },
};
