// =====================================================
// config.js : ゲームの「設定値」をまとめたファイル
// ここの数字や文章を変えるだけで、難しさや雰囲気を調整できます。
// =====================================================

// ---------- コートの大きさ（単位はメートル） ----------
// 本物のバレーボールのコートと同じ、横 9m × 縦 18m です。
// 画面の上側がチーム0（赤）、下側がチーム1（緑）のコートです。
const COURT_W = 9;
const COURT_L = 18;
const NET_Y = COURT_L / 2; // ネットの位置（コートのまんなか）
const NET_H = 2.3;         // ネットの高さ。これより低い位置でネットを越えようとすると引っかかる

// 画面に映す範囲（コートのまわりに少し余白をとる）
const VIEW = { left: -2.3, right: COURT_W + 2.3, top: -2.0, bottom: COURT_L + 2.0 };

// ---------- ボールの動き ----------
const GRAVITY = 9.8;        // 重力の強さ
const FLOAT_GRAVITY = 0.4;  // 「ふわっ」を押している間は重力がこの倍率になる（ゆっくり落ちる）
const DROP_GRAVITY = 2.0;   // 「ストン」を押している間の倍率（はやく落ちる）
const STEER_ACCEL = 6.0;    // 画面をなぞったとき、ボールがずれていく勢い
const STEER_MAX = 2.4;      // ずれる速さの上限（メートル/秒）
const BALL_MAX_HP = 100;

// ---------- 選手の動き ----------
const RUN_SPEED = 5.2;  // ボールを追いかけるときの速さ（メートル/秒）
const WALK_SPEED = 2.5; // 自分の定位置にもどるときの速さ
const REACH = 1.0;      // 手が届く距離（メートル）

// 何回目のタッチかで、ボールにさわる高さが変わります。
// [0]は使わない / [1]レシーブ（低い） / [2]トス（頭の上） / [3]スパイク（ジャンプ）
// [4]は本当は反則の4回目。選手はつい手を出してしまいます。
const TOUCH_HEIGHT = [0, 0.9, 2.0, 2.7, 0.9];

// ---------- 試合のレベル ----------
// 時間がたつと次のレベルに進みます。
//   spikeTime  : スパイクが相手コートに届くまでの時間（小さいほど速い）
//   power      : スパイクとサーブの痛さの倍率
//   suspicion  : 審判の疑いやすさ
//   awayTime   : 審判がよそ見する時間 [最短, 最長]（秒）
//   watchTime  : 審判がしっかり見ている時間 [最短, 最長]（秒）
//   senpai     : 各チームにいる「本気スパイクの先輩」の人数 [チーム0, チーム1]
const LEVEL_DURATION = 30; // 1レベルの長さ（秒）
const LEVELS = [
  { name: '練習試合',      spikeTime: 1.05, power: 1.0,  suspicion: 0.8, awayTime: [2.2, 3.0], watchTime: [3.0, 5.0], senpai: [1, 0] },
  { name: '地区大会',      spikeTime: 0.95, power: 1.1,  suspicion: 1.0, awayTime: [1.9, 2.6], watchTime: [3.5, 5.5], senpai: [1, 1] },
  { name: '県大会',        spikeTime: 0.85, power: 1.2,  suspicion: 1.2, awayTime: [1.6, 2.3], watchTime: [4.0, 6.0], senpai: [2, 1] },
  { name: '全国大会',      spikeTime: 0.75, power: 1.35, suspicion: 1.4, awayTime: [1.3, 2.0], watchTime: [4.5, 6.5], senpai: [2, 2] },
  { name: '全国大会 決勝', spikeTime: 0.65, power: 1.5,  suspicion: 1.7, awayTime: [1.0, 1.7], watchTime: [5.0, 7.0], senpai: [2, 2] },
];

// ---------- 選手のタイプ ----------
// damage : そのプレーでボールの HP がどれだけ減るか（マイナスなら回復）
//   serve=サーブ / receive=レシーブ / toss=トス / spike=スパイク / soft=やさしく返す
// lines  : そのプレーのときのセリフ（any はどのプレーでも使う）
const PLAYER_TYPES = {
  normal: {
    name: 'ふつうの部員', emoji: '🙂',
    damage: { serve: 7, receive: 3, toss: 1, spike: 8, soft: 2 },
    lines: { any: ['はいっ！', 'よいしょ！'] },
  },
  senpai: {
    name: '本気スパイクの先輩', emoji: '😤',
    damage: { serve: 12, receive: 8, toss: 5, spike: 18, soft: 6 },
    lines: { spike: ['うおりゃああ！', '本気でいくぞ！', 'くらえっ！'], any: ['ふんっ！', 'まだまだぁ！'] },
  },
  libero: {
    name: 'やさしいリベロ', emoji: '😇',
    damage: { serve: 0, receive: -10, toss: -5, spike: 0, soft: -3 },
    lines: { any: ['はい、ふわっと〜', 'まかせて〜', 'よしよし〜'] },
  },
  kouhai: {
    name: '話しかけてくる後輩', emoji: '🤗',
    damage: { serve: 7, receive: 3, toss: 1, spike: 8, soft: 2 },
    lines: {
      any: [
        'ボールさん、今日もよろしくっす！',
        'ボールさん痛くないっすか？',
        'いい回転っすね、ボールさん！',
        'ボールさん、なんか今日軽いっすね',
        'ボールさんって休みの日なにしてるんすか？',
      ],
    },
  },
  server: {
    name: 'サーブだけ強い人', emoji: '😎',
    damage: { serve: 18, receive: 3, toss: 1, spike: 7, soft: 2 },
    lines: { serve: ['いくぜ、必殺サーブ！', 'サーブだけは任せろ！'], any: ['（サーブ以外はふつう）'] },
  },
  kowamote: {
    // 顔はこわいけど、じつはボールにやさしい人。遊ぶ人にはわからないようにしてあります。
    name: '顔だけ怖い人', emoji: '😠',
    damage: { serve: 5, receive: -8, toss: -5, spike: 4, soft: -3 },
    lines: { any: ['……（そっ）', '……', '……大事にしないとな'] },
  },
};

// ---------- いろいろなセリフ ----------
// ボールのセリフ（気持ちごと）
const BALL_LINES = {
  pain:   ['ぐぇっ！', 'いったぁ！', '本気すぎ！', 'ひどい！'],
  ouch:   ['いてっ', 'うっ', 'あいたっ'],
  happy:  ['あったかい…', 'ふわぁ…', 'しあわせ…'],
  gentle: ['…え、やさしい', '顔こわいのに…！', '見た目で判断してごめん'],
  scared: ['ひぃっ！', 'こわい人きた！', 'そっちはイヤ！'],
  float:  ['ふわ〜', 'ふわふわ〜'],
  drop:   ['ストン！', 'えいっ'],
  tired:  ['もう…限界…', 'へとへと…'],
  net:    ['あたっ！ ネット！'],
};

// 審判が「怪しみ度」に合わせて言うセリフ（数字は怪しみ度）
const REFEREE_LINES = { 30: 'ん？', 60: '…今のボール、なんか変だな', 85: 'おい、そのボール…！' };

// 審判がよそ見しているときの様子
const REFEREE_AWAY = [
  { label: 'あくび中', emoji: '🥱' },
  { label: 'うとうと中', emoji: '😪' },
  { label: 'くしゃみ中', emoji: '🤧' },
];

// 審判にバレたときの「現実にはない反則」
const FAKE_RULES = ['ボール自走', 'ボール意思あり', 'ボールのわがまま', 'ボールの人見知り', 'ボールよけ'];

// 怪しみ度が高いとき、選手がつぶやくセリフ
const PLAYER_DOUBT_LINES = ['なんか今日のボール変じゃない？', '今、ボール曲がった…？', '風あるのかな…', 'ボール、生きてる…？'];

// ハイスコアを保存するときの名前
const BEST_KEY = 'ball-no-kimochi.best';
