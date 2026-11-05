// =====================================================
// sound.js : 効果音を鳴らすファイル
// 音声ファイルは使わず、ブラウザの「Web Audio API」で音をその場で作ります。
// =====================================================

const Sound = {
  ctx: null,     // 音を作るための「音の工場」（AudioContext）
  muted: false,  // true のとき音を鳴らさない

  // ブラウザは「ユーザーが画面をさわったあと」でないと音を出せないので、
  // スタートボタンを押したときにこれを呼びます。
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  canPlay() {
    return this.ctx && !this.muted;
  },

  // 「ピッ」のような単純な音を鳴らす
  //   freq: 音の高さ(Hz)  dur: 長さ(秒)  type: 音色  vol: 音量  slideTo: 最後にこの高さへ変化  delay: 鳴らすまでの待ち時間
  tone(freq, dur, { type = 'sine', vol = 0.2, slideTo = null, delay = 0 } = {}) {
    if (!this.canPlay()) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    // 音量を「すっと大きく → だんだん小さく」変化させると、プツッという雑音が出ない
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  // 「バシッ」「ザッ」のような雑音を鳴らす
  noise(dur, { vol = 0.3, freq = 1000, delay = 0 } = {}) {
    if (!this.canPlay()) return;
    const t0 = this.ctx.currentTime + delay;
    // ランダムな波（ホワイトノイズ）を作る
    const length = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    // フィルターで音のこもり具合を変える
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(t0);
  },

  // ボールがたたかれた音。power は 0（弱い）〜 1（強い）
  hit(power) {
    this.noise(0.08 + power * 0.08, { vol: 0.25 + power * 0.35, freq: 2200 - power * 1200 });
    this.tone(200 - power * 90, 0.14, { type: 'triangle', vol: 0.2 + power * 0.2, slideTo: 60 });
  },

  // やさしくさわられた音
  soft() {
    this.tone(520, 0.12, { vol: 0.16, slideTo: 760 });
  },

  // 回復したときのキラキラ音
  heal() {
    [660, 880, 1175].forEach((f, i) => this.tone(f, 0.2, { vol: 0.1, delay: 0.05 + i * 0.07 }));
  },

  // 審判の笛。long が true なら「ピーーッ」と長く鳴らす
  whistle(long) {
    if (!this.canPlay()) return;
    const t0 = this.ctx.currentTime;
    const dur = long ? 0.9 : 0.22;
    const osc = this.ctx.createOscillator();
    osc.frequency.value = 2900;
    // 音の高さを細かくゆらして、笛っぽい「ビリビリ」感を出す
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 28;
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(osc.frequency);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.09, t0 + 0.02);
    gain.gain.setValueAtTime(0.09, t0 + dur - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + dur + 0.02);
    lfo.stop(t0 + dur + 0.02);
  },

  // 審判に怪しまれたときの「ん？」という音
  suspicious(level) {
    this.tone(260 + level * 3, 0.16, { type: 'square', vol: 0.06, slideTo: 380 + level * 4 });
  },

  // ネットに引っかかった音
  net() {
    this.noise(0.18, { vol: 0.22, freq: 500 });
  },

  // レベルアップのファンファーレ
  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.14, delay: i * 0.12 }));
  },

  // ゲームオーバーの音
  gameOver() {
    this.tone(440, 0.7, { type: 'triangle', vol: 0.16, slideTo: 110, delay: 0.25 });
  },
};
