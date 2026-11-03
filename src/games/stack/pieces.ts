/**
 * Peças do Empilha: forma física (polígonos convexos e círculos, coordenadas com y para cima, em unidades do mundo)
 * e arte própria desenhada no canvas por cima da forma. Os enfeites (orelhas, olhos) são só desenho.
 */
export type Part = { type: 'poly'; pts: Array<[number, number]> } | { type: 'circle'; c: [number, number]; r: number };

export interface PieceDef {
  id: string;
  name: string;
  parts: Part[];
  /** Peso no sorteio (bola é rara). */
  weight: number;
  /** Desenho no sistema local da peça (y para cima). */
  draw: (ctx: CanvasRenderingContext2D) => void;
}

const TAU = Math.PI * 2;

/** Retângulo com cantos chanfrados (octógono), centrado na origem. */
function chamfer(w: number, h: number, c: number): Array<[number, number]> {
  const x = w / 2;
  const y = h / 2;
  return [
    [-x + c, -y],
    [x - c, -y],
    [x, -y + c],
    [x, y - c],
    [x - c, y],
    [-x + c, y],
    [-x, y - c],
    [-x, -y + c],
  ];
}

function ellipse8(w: number, h: number, cy = 0): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + TAU / 16;
    out.push([(Math.cos(a) * w) / 2, cy + (Math.sin(a) * h) / 2]);
  }
  return out;
}

function path(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function smooth(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>) {
  // contorno arredondado passando pelos pontos médios (fica "fofinho" sem mudar a física)
  const n = pts.length;
  ctx.beginPath();
  const mid = (i: number) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
  const m0 = mid(n - 1);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  ctx.closePath();
}

function fillStroke(ctx: CanvasRenderingContext2D, fill: string | CanvasGradient, stroke = 'rgba(0,0,0,0.35)') {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 0.045;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = c;
  ctx.fill();
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r = 0.075) {
  dot(ctx, x, y, r, '#1b1426');
  dot(ctx, x + r * 0.35, y + r * 0.35, r * 0.35, '#ffffff');
}

function smile(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.beginPath();
  ctx.arc(x, y + w * 0.6, w, -Math.PI * 0.75, -Math.PI * 0.25);
  ctx.strokeStyle = '#1b1426';
  ctx.lineWidth = 0.04;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function tri(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], c: [number, number], fill: string) {
  path(ctx, [a, b, c]);
  fillStroke(ctx, fill);
}


/** Corpo com luz de cima (referência bichinhos.png): degradê claro→escuro, contorno e brilho no alto. */
function shaded(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, light: string, dark: string) {
  let top = -Infinity;
  let bot = Infinity;
  for (const [, y] of pts) {
    top = Math.max(top, y);
    bot = Math.min(bot, y);
  }
  smooth(ctx, pts);
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  fillStroke(ctx, g, 'rgba(10,8,30,0.55)');
  ctx.save();
  smooth(ctx, pts);
  ctx.clip();
  ctx.beginPath();
  ctx.ellipse(-0.08, top - 0.02, 0.32, 0.12, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.restore();
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, c: string, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = c;
  ctx.fill();
}

/** Focinho simples: nariz + boca em "w". */
function snout(ctx: CanvasRenderingContext2D, x: number, y: number, s = 1) {
  oval(ctx, x, y, 0.05 * s, 0.035 * s, '#1b1426');
  ctx.beginPath();
  ctx.moveTo(x, y - 0.03 * s);
  ctx.quadraticCurveTo(x - 0.03 * s, y - 0.09 * s, x - 0.07 * s, y - 0.06 * s);
  ctx.moveTo(x, y - 0.03 * s);
  ctx.quadraticCurveTo(x + 0.03 * s, y - 0.09 * s, x + 0.07 * s, y - 0.06 * s);
  ctx.strokeStyle = '#1b1426';
  ctx.lineWidth = 0.025;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function paws(ctx: CanvasRenderingContext2D, y: number, dx: number, c: string) {
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(sx * dx - 0.11, y, 0.22, 0.16, 0.07);
    ctx.fillStyle = c;
    ctx.fill();
  }
}

const CAT = chamfer(1.3, 0.72, 0.2);
// bichinhos novos (01/11, referência docs/arte/referencias-gpt/bichinhos.png): blocos sentados, rosto e orelhas dentro
// (ou quase dentro) da forma física, para a peça de cima não "atravessar" enfeite
const BEAR = chamfer(0.92, 0.86, 0.16);
const PANDA = chamfer(0.94, 0.88, 0.16);
const FOX = chamfer(0.88, 0.9, 0.2);
const OWL = chamfer(0.84, 0.94, 0.22);
const BUNNY: Array<[number, number]> = [
  [-0.4, -0.42],
  [0.4, -0.42],
  [0.42, 0.14],
  [0.22, 0.62],
  [-0.22, 0.62],
  [-0.42, 0.14],
];
const BUNNY_BODY = chamfer(0.84, 0.72, 0.18).map(([x, y]) => [x, y - 0.06] as [number, number]);
const TURTLE: Array<[number, number]> = [
  [-0.68, -0.27],
  [0.68, -0.27],
  [0.46, 0.3],
  [-0.46, 0.3],
];
const FROG: Array<[number, number]> = [
  [-0.62, -0.3],
  [0.62, -0.3],
  [0.42, 0.3],
  [-0.42, 0.3],
];
const PENGUIN = chamfer(0.72, 1.12, 0.26);
const PIG = ellipse8(1.25, 0.82);
const GIFT = chamfer(0.9, 0.9, 0.04);
const MELON: Array<[number, number]> = [];
for (let i = 0; i <= 6; i++) {
  const a = Math.PI - (i / 6) * Math.PI;
  MELON.push([Math.cos(a) * 0.68, Math.sin(a) * 0.62 - 0.22]);
}
const CHEESE: Array<[number, number]> = [
  [-0.62, -0.3],
  [0.62, -0.3],
  [0.62, 0.38],
];
const CAKE = chamfer(1.1, 0.56, 0.05);
const DUCK_BODY = ellipse8(1.0, 0.56, -0.12);

export const PIECES: PieceDef[] = [
  {
    id: 'gato',
    name: 'Gato',
    weight: 3,
    parts: [{ type: 'poly', pts: CAT }],
    draw(ctx) {
      tri(ctx, [0.12, 0.3], [0.32, 0.3], [0.2, 0.52], '#f29a3a');
      tri(ctx, [0.42, 0.3], [0.6, 0.26], [0.56, 0.5], '#f29a3a');
      smooth(ctx, CAT);
      fillStroke(ctx, '#f6a443');
      ctx.strokeStyle = 'rgba(160,80,20,0.55)';
      ctx.lineWidth = 0.06;
      for (const x of [-0.45, -0.28, -0.11]) {
        ctx.beginPath();
        ctx.moveTo(x, 0.34);
        ctx.lineTo(x + 0.05, 0.12);
        ctx.stroke();
      }
      eye(ctx, 0.26, 0.06);
      eye(ctx, 0.5, 0.06);
      dot(ctx, 0.38, -0.06, 0.04, '#ff7b9c');
      ctx.strokeStyle = 'rgba(40,20,10,0.6)';
      ctx.lineWidth = 0.02;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0.38 + s * 0.08, -0.08);
        ctx.lineTo(0.38 + s * 0.3, -0.02);
        ctx.moveTo(0.38 + s * 0.08, -0.11);
        ctx.lineTo(0.38 + s * 0.3, -0.14);
        ctx.stroke();
      }
    },
  },
  {
    id: 'sapo',
    name: 'Sapo',
    weight: 3,
    parts: [{ type: 'poly', pts: FROG }],
    draw(ctx) {
      dot(ctx, -0.26, 0.3, 0.16, '#58c25a');
      dot(ctx, 0.26, 0.3, 0.16, '#58c25a');
      smooth(ctx, FROG);
      fillStroke(ctx, '#62cf63');
      dot(ctx, 0, -0.12, 0.22, '#b8ef9c');
      eye(ctx, -0.26, 0.32, 0.08);
      eye(ctx, 0.26, 0.32, 0.08);
      smile(ctx, 0, 0.0, 0.2);
    },
  },
  {
    id: 'pinguim',
    name: 'Pinguim',
    weight: 2,
    parts: [{ type: 'poly', pts: PENGUIN }],
    draw(ctx) {
      smooth(ctx, PENGUIN);
      fillStroke(ctx, '#2c3350');
      ctx.beginPath();
      ctx.ellipse(0, -0.1, 0.24, 0.36, 0, 0, TAU);
      ctx.fillStyle = '#f4f2ee';
      ctx.fill();
      eye(ctx, -0.12, 0.3, 0.06);
      eye(ctx, 0.12, 0.3, 0.06);
      tri(ctx, [-0.08, 0.2], [0.08, 0.2], [0, 0.08], '#ffb23c');
      dot(ctx, -0.16, -0.54, 0.09, '#ffb23c');
      dot(ctx, 0.16, -0.54, 0.09, '#ffb23c');
    },
  },
  {
    id: 'porco',
    name: 'Porquinho',
    weight: 3,
    parts: [{ type: 'poly', pts: PIG }],
    draw(ctx) {
      tri(ctx, [-0.36, 0.28], [-0.14, 0.36], [-0.3, 0.52], '#f59ab8');
      tri(ctx, [0.36, 0.28], [0.14, 0.36], [0.3, 0.52], '#f59ab8');
      smooth(ctx, PIG);
      fillStroke(ctx, '#ffb1c8');
      ctx.beginPath();
      ctx.ellipse(0, -0.06, 0.17, 0.12, 0, 0, TAU);
      ctx.fillStyle = '#ff8fb0';
      ctx.fill();
      dot(ctx, -0.06, -0.06, 0.03, '#a8456a');
      dot(ctx, 0.06, -0.06, 0.03, '#a8456a');
      eye(ctx, -0.22, 0.14, 0.06);
      eye(ctx, 0.22, 0.14, 0.06);
    },
  },
  {
    id: 'presente',
    name: 'Presente',
    weight: 3,
    parts: [{ type: 'poly', pts: GIFT }],
    draw(ctx) {
      path(ctx, GIFT);
      fillStroke(ctx, '#7c6cff');
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(-0.09, -0.45, 0.18, 0.9);
      ctx.fillRect(-0.45, -0.09, 0.9, 0.18);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-0.4, 0.2, 0.22, 0.2);
      ctx.beginPath();
      ctx.ellipse(-0.14, 0.5, 0.14, 0.08, 0.5, 0, TAU);
      ctx.ellipse(0.14, 0.5, 0.14, 0.08, -0.5, 0, TAU);
      ctx.fillStyle = '#ffd34d';
      ctx.fill();
    },
  },
  {
    id: 'melancia',
    name: 'Melancia',
    weight: 2,
    parts: [{ type: 'poly', pts: MELON }],
    draw(ctx) {
      path(ctx, MELON);
      fillStroke(ctx, '#3fa34d');
      ctx.save();
      ctx.scale(0.84, 0.82);
      ctx.translate(0, -0.03);
      path(ctx, MELON);
      ctx.fillStyle = '#ff5d6c';
      ctx.fill();
      ctx.restore();
      for (const [x, y] of [
        [-0.3, -0.05],
        [0, 0.12],
        [0.3, -0.05],
        [-0.12, 0.25],
        [0.14, 0.24],
      ])
        dot(ctx, x, y, 0.035, '#2a1a1a');
    },
  },
  {
    id: 'queijo',
    name: 'Queijo',
    weight: 2,
    parts: [{ type: 'poly', pts: CHEESE }],
    draw(ctx) {
      path(ctx, CHEESE);
      fillStroke(ctx, '#ffd54a');
      dot(ctx, 0.3, -0.1, 0.09, '#e8b52c');
      dot(ctx, 0.46, 0.14, 0.06, '#e8b52c');
      dot(ctx, 0.0, -0.18, 0.05, '#e8b52c');
    },
  },
  {
    id: 'bolo',
    name: 'Bolo',
    weight: 2,
    parts: [{ type: 'poly', pts: CAKE }],
    draw(ctx) {
      path(ctx, CAKE);
      fillStroke(ctx, '#a8693f');
      ctx.fillStyle = '#fff2f6';
      ctx.beginPath();
      ctx.moveTo(-0.55, 0.28);
      ctx.lineTo(0.55, 0.28);
      ctx.lineTo(0.55, 0.08);
      for (let i = 0; i <= 5; i++) ctx.quadraticCurveTo(0.55 - i * 0.22 + 0.11, -0.06, 0.55 - (i + 1) * 0.22 + 0.11, 0.08);
      ctx.closePath();
      ctx.fill();
      for (const [x, c] of [
        [-0.32, '#ff6b4a'],
        [0.05, '#ffd34d'],
        [0.36, '#3d8bff'],
      ] as Array<[number, string]>) {
        dot(ctx, x, -0.12, 0.035, c);
      }
    },
  },
  {
    id: 'pato',
    name: 'Patinho',
    weight: 2,
    parts: [
      { type: 'poly', pts: DUCK_BODY },
      { type: 'circle', c: [0.24, 0.3], r: 0.24 },
    ],
    draw(ctx) {
      smooth(ctx, DUCK_BODY);
      fillStroke(ctx, '#ffd23f');
      ctx.beginPath();
      ctx.arc(0.24, 0.3, 0.24, 0, TAU);
      fillStroke(ctx, '#ffd23f');
      tri(ctx, [0.44, 0.32], [0.64, 0.26], [0.44, 0.2], '#ff8c2a');
      eye(ctx, 0.3, 0.38, 0.05);
      ctx.beginPath();
      ctx.ellipse(-0.12, -0.08, 0.22, 0.1, -0.3, 0, TAU);
      ctx.fillStyle = '#f2bd1c';
      ctx.fill();
    },
  },
  {
    id: 'urso',
    name: 'Urso',
    weight: 2,
    parts: [{ type: 'poly', pts: BEAR }],
    draw(ctx) {
      for (const sx of [-1, 1]) {
        dot(ctx, sx * 0.29, 0.41, 0.12, '#9a5a2e');
        dot(ctx, sx * 0.29, 0.41, 0.06, '#e3a77a');
      }
      shaded(ctx, BEAR, '#d58e55', '#8e532c');
      oval(ctx, 0, -0.2, 0.26, 0.18, '#c07a46');
      paws(ctx, -0.43, 0.24, '#7c4524');
      oval(ctx, 0, 0.0, 0.17, 0.12, '#f0c79c');
      eye(ctx, -0.18, 0.13, 0.055);
      eye(ctx, 0.18, 0.13, 0.055);
      snout(ctx, 0, 0.04);
    },
  },
  {
    id: 'panda',
    name: 'Panda',
    weight: 2,
    parts: [{ type: 'poly', pts: PANDA }],
    draw(ctx) {
      dot(ctx, -0.3, 0.42, 0.12, '#1c2238');
      dot(ctx, 0.3, 0.42, 0.12, '#1c2238');
      shaded(ctx, PANDA, '#ffffff', '#c9cfe0');
      // braços e pés escuros
      ctx.save();
      smooth(ctx, PANDA);
      ctx.clip();
      ctx.fillStyle = '#1c2238';
      ctx.fillRect(-0.5, -0.46, 0.2, 0.42);
      ctx.fillRect(0.3, -0.46, 0.2, 0.42);
      ctx.restore();
      paws(ctx, -0.45, 0.17, '#1c2238');
      oval(ctx, -0.18, 0.11, 0.13, 0.09, '#1c2238', 0.5);
      oval(ctx, 0.18, 0.11, 0.13, 0.09, '#1c2238', -0.5);
      dot(ctx, -0.17, 0.13, 0.04, '#ffffff');
      dot(ctx, 0.17, 0.13, 0.04, '#ffffff');
      snout(ctx, 0, 0.0);
    },
  },
  {
    id: 'raposa',
    name: 'Raposa',
    weight: 2,
    parts: [{ type: 'poly', pts: FOX }],
    draw(ctx) {
      tri(ctx, [-0.42, 0.22], [-0.12, 0.44], [-0.4, 0.58], '#e8551f');
      tri(ctx, [0.42, 0.22], [0.12, 0.44], [0.4, 0.58], '#e8551f');
      tri(ctx, [-0.36, 0.32], [-0.2, 0.42], [-0.36, 0.5], '#2a1a22');
      tri(ctx, [0.36, 0.32], [0.2, 0.42], [0.36, 0.5], '#2a1a22');
      shaded(ctx, FOX, '#ff8a3d', '#d4471a');
      // bochechas e peito brancos
      ctx.beginPath();
      ctx.moveTo(-0.38, 0.08);
      ctx.quadraticCurveTo(-0.12, -0.02, 0, -0.12);
      ctx.quadraticCurveTo(0.12, -0.02, 0.38, 0.08);
      ctx.quadraticCurveTo(0.2, -0.24, 0, -0.26);
      ctx.quadraticCurveTo(-0.2, -0.24, -0.38, 0.08);
      ctx.fillStyle = '#fff3e6';
      ctx.fill();
      oval(ctx, 0, -0.34, 0.13, 0.09, '#fff3e6');
      paws(ctx, -0.46, 0.22, '#2a1a22');
      eye(ctx, -0.17, 0.14, 0.05);
      eye(ctx, 0.17, 0.14, 0.05);
      snout(ctx, 0, -0.06, 0.9);
    },
  },
  {
    id: 'coruja',
    name: 'Coruja',
    weight: 2,
    parts: [{ type: 'poly', pts: OWL }],
    draw(ctx) {
      tri(ctx, [-0.4, 0.26], [-0.16, 0.46], [-0.36, 0.56], '#2f3cc4');
      tri(ctx, [0.4, 0.26], [0.16, 0.46], [0.36, 0.56], '#2f3cc4');
      shaded(ctx, OWL, '#5a68ff', '#2b37b8');
      oval(ctx, 0, -0.18, 0.24, 0.22, '#7f8cff');
      // asas
      oval(ctx, -0.36, -0.1, 0.08, 0.2, '#2531a3', 0.15);
      oval(ctx, 0.36, -0.1, 0.08, 0.2, '#2531a3', -0.15);
      for (const sx of [-1, 1]) {
        dot(ctx, sx * 0.16, 0.14, 0.14, '#ffffff');
        dot(ctx, sx * 0.15, 0.13, 0.08, '#1b1426');
        dot(ctx, sx * 0.13 + 0.02, 0.16, 0.03, '#ffffff');
      }
      tri(ctx, [-0.06, 0.03], [0.06, 0.03], [0, -0.09], '#ffa82e');
      paws(ctx, -0.5, 0.12, '#ffa82e');
    },
  },
  {
    id: 'coelho',
    name: 'Coelho',
    weight: 2,
    parts: [{ type: 'poly', pts: BUNNY }],
    draw(ctx) {
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.roundRect(sx * 0.12 - 0.075, 0.12, 0.15, 0.5, 0.075);
        fillStroke(ctx, '#fbe6f2', 'rgba(10,8,30,0.45)');
        ctx.beginPath();
        ctx.roundRect(sx * 0.12 - 0.035, 0.2, 0.07, 0.36, 0.035);
        ctx.fillStyle = '#ffb3cf';
        ctx.fill();
      }
      shaded(ctx, BUNNY_BODY, '#ffffff', '#e7c7da');
      paws(ctx, -0.44, 0.16, '#ffffff');
      dot(ctx, -0.22, -0.02, 0.06, 'rgba(255,120,170,0.45)');
      dot(ctx, 0.22, -0.02, 0.06, 'rgba(255,120,170,0.45)');
      eye(ctx, -0.14, 0.06, 0.05);
      eye(ctx, 0.14, 0.06, 0.05);
      oval(ctx, 0, -0.03, 0.04, 0.03, '#ff6f9c');
      snout(ctx, 0, -0.03, 0.7);
    },
  },
  {
    id: 'tartaruga',
    name: 'Tartaruga',
    weight: 2,
    parts: [{ type: 'poly', pts: TURTLE }],
    draw(ctx) {
      // patas e cabeça (dentro da largura da forma)
      for (const x of [-0.42, 0.42]) {
        ctx.beginPath();
        ctx.roundRect(x - 0.11, -0.36, 0.22, 0.16, 0.07);
        fillStroke(ctx, '#6fd35a');
      }
      shaded(ctx, TURTLE, '#3fc24a', '#1d7a2c');
      // placas do casco
      ctx.strokeStyle = 'rgba(10,60,20,0.5)';
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.moveTo(-0.2, 0.28);
      ctx.lineTo(-0.28, -0.04);
      ctx.lineTo(0.28, -0.04);
      ctx.lineTo(0.2, 0.28);
      ctx.moveTo(-0.28, -0.04);
      ctx.lineTo(-0.36, -0.26);
      ctx.moveTo(0.28, -0.04);
      ctx.lineTo(0.36, -0.26);
      ctx.moveTo(0, -0.04);
      ctx.lineTo(0, -0.26);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-0.66, -0.3, 1.32, 0.1, 0.05);
      ctx.fillStyle = '#a6e86a';
      ctx.fill();
      dot(ctx, 0.52, -0.02, 0.15, '#7ddb62');
      eye(ctx, 0.56, 0.02, 0.035);
      smile(ctx, 0.56, -0.12, 0.06);
    },
  },
  {
    id: 'bola',
    name: 'Bola de praia',
    weight: 1,
    parts: [{ type: 'circle', c: [0, 0], r: 0.4 }],
    draw(ctx) {
      const cols = ['#ff6b4a', '#ffffff', '#3d8bff', '#ffffff', '#ffd34d', '#ffffff'];
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 0.4, (i / 6) * TAU, ((i + 1) / 6) * TAU);
        ctx.closePath();
        ctx.fillStyle = cols[i];
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 0.4, 0, TAU);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.045;
      ctx.stroke();
      dot(ctx, 0, 0, 0.08, '#ffffff');
    },
  },
];

export const pieceById = (id: string) => PIECES.find((p) => p.id === id)!;

/** Sorteio ponderado. */
export function randomPiece(rng: () => number): string {
  const total = PIECES.reduce((s, p) => s + p.weight, 0);
  let r = rng() * total;
  for (const p of PIECES) {
    r -= p.weight;
    if (r <= 0) return p.id;
  }
  return PIECES[0].id;
}
