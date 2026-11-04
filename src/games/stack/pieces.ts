/**
 * Peças da Torre de Bichos (redesenho de 04/11, pedido do Leon: "formatos de animais e não formas com cara de animal").
 * Referência: docs/arte/referencias-gpt/torre-catalogo.png (12 bichos, lógica Base / Bloco / Assimétrico / Desafio).
 *
 * Cada bicho tem forma física de VÁRIAS partes convexas (corpo, cabeça, pernas, cauda), então a silhueta física é a do
 * animal: pernas deixam vão, cauda do canguru e do castor apoia no chão, o caracol tem casco redondo. O desenho segue
 * a mesma silhueta; só enfeites finos (orelhas, chifres de olho, crina) passam um pouco da forma física.
 * Coordenadas em unidades do mundo, y para cima, bicho olhando para a direita (+x).
 */
export type Part = { type: 'poly'; pts: Array<[number, number]> } | { type: 'circle'; c: [number, number]; r: number };

export type PieceGroup = 'base' | 'bloco' | 'assimetrico' | 'desafio';

export interface PieceDef {
  id: string;
  name: string;
  nameEn: string;
  group: PieceGroup;
  parts: Part[];
  /** Peso no sorteio. */
  weight: number;
  /** Desenho no sistema local da peça (y para cima). */
  draw: (ctx: CanvasRenderingContext2D) => void;
}

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
const TAU = Math.PI * 2;
const INK = '#1b1426';
const OUTLINE = 'rgba(14,10,32,0.75)';

// ---------- formas físicas ----------
const poly = (...pts: Pt[]): Part => ({ type: 'poly', pts });
/** Caixa com cantos chanfrados (x0..x1, y0..y1). */
function box(x0: number, y0: number, x1: number, y1: number, c = 0.05): Part {
  return poly([x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]);
}

// ---------- desenho ----------
/** Um "pedaço" do desenho: monta o caminho (beginPath incluso). */
type Sh = (c: Ctx) => void;
const E = (x: number, y: number, rx: number, ry: number, rot = 0): Sh => (c) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
};
const RR = (x0: number, y0: number, x1: number, y1: number, r: number): Sh => (c) => {
  c.beginPath();
  c.roundRect(x0, y0, x1 - x0, y1 - y0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2));
};
/** Contorno arredondado passando pelos pontos médios (fica "fofinho"). */
const SM = (...pts: Pt[]): Sh => (c) => {
  const n = pts.length;
  const mid = (i: number): Pt => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2];
  c.beginPath();
  const m0 = mid(n - 1);
  c.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(i);
    c.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  c.closePath();
};

/**
 * Pinta várias formas como UMA silhueta: primeiro o contorno grosso de todas, depois o preenchimento de todas
 * (o contorno interno some e sobra só o de fora). Degradê com luz de cima, como na referência.
 */
function blob(c: Ctx, shapes: Sh[], light: string, dark: string, top = 0.6, bottom = -0.5) {
  c.lineJoin = 'round';
  for (const s of shapes) {
    s(c);
    c.lineWidth = 0.075;
    c.strokeStyle = OUTLINE;
    c.stroke();
  }
  const g = c.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  c.fillStyle = g;
  for (const s of shapes) {
    s(c);
    c.fill();
  }
}
function fill(c: Ctx, s: Sh, color: string | CanvasGradient, stroke = false) {
  s(c);
  c.fillStyle = color;
  c.fill();
  if (stroke) {
    c.lineWidth = 0.035;
    c.strokeStyle = OUTLINE;
    c.stroke();
  }
}
function eye(c: Ctx, x: number, y: number, r = 0.06) {
  fill(c, E(x, y, r, r * 1.12), INK);
  fill(c, E(x + r * 0.35, y + r * 0.4, r * 0.38, r * 0.38), '#ffffff');
}
function happyEye(c: Ctx, x: number, y: number, w = 0.06) {
  c.beginPath();
  c.arc(x, y - w * 0.5, w, Math.PI * 0.15, Math.PI * 0.85);
  line(c, 0.032);
}
function line(c: Ctx, w = 0.03, color = INK) {
  c.lineWidth = w;
  c.lineCap = 'round';
  c.strokeStyle = color;
  c.stroke();
}
function smile(c: Ctx, x: number, y: number, w: number) {
  c.beginPath();
  c.arc(x, y + w * 0.8, w, Math.PI * 1.2, Math.PI * 1.8);
  line(c, 0.03);
}
function blush(c: Ctx, x: number, y: number) {
  fill(c, E(x, y, 0.06, 0.035), 'rgba(255,110,130,0.45)');
}
function shine(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  fill(c, E(x, y, rx, ry, rot), 'rgba(255,255,255,0.22)');
}

// ---------- os 12 bichos ----------
export const PIECES: PieceDef[] = [
  {
    id: 'tartaruga',
    name: 'Tartaruga',
    nameEn: 'Turtle',
    group: 'base',
    weight: 3,
    parts: [
      poly([-0.6, -0.2], [0.6, -0.2], [0.6, 0.0], [0.34, 0.28], [-0.34, 0.28], [-0.6, 0.0]),
      box(-0.46, -0.36, -0.22, -0.16),
      box(0.22, -0.36, 0.46, -0.16),
      poly([0.56, -0.14], [0.82, -0.12], [0.9, 0.02], [0.82, 0.15], [0.62, 0.12]),
    ],
    draw(c) {
      const G = '#7fd64f';
      const GD = '#3f9a2a';
      blob(c, [RR(-0.46, -0.36, -0.22, -0.1, 0.07), RR(0.22, -0.36, 0.46, -0.1, 0.07), E(0.74, 0.01, 0.17, 0.14), SM([-0.74, -0.18], [-0.56, -0.14], [-0.6, -0.08])], G, GD, 0.2, -0.36);
      // casco
      blob(c, [SM([-0.64, -0.21], [0.64, -0.21], [0.62, 0.02], [0.36, 0.32], [-0.36, 0.32], [-0.62, 0.02])], '#c98a4b', '#7d4a1f', 0.32, -0.2);
      c.save();
      SM([-0.64, -0.21], [0.64, -0.21], [0.62, 0.02], [0.36, 0.32], [-0.36, 0.32], [-0.62, 0.02])(c);
      c.clip();
      c.strokeStyle = 'rgba(80,40,10,0.55)';
      c.lineWidth = 0.03;
      for (const [x, y] of [[0, 0.06], [-0.34, 0.0], [0.34, 0.0]] as Pt[]) {
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + TAU / 12;
          const px = x + Math.cos(a) * 0.17;
          const py = y + Math.sin(a) * 0.15;
          if (i) c.lineTo(px, py);
          else c.moveTo(px, py);
        }
        c.closePath();
        c.stroke();
      }
      c.restore();
      fill(c, RR(-0.62, -0.24, 0.62, -0.14, 0.05), '#e8b36e', true);
      shine(c, -0.18, 0.2, 0.2, 0.06, -0.1);
      eye(c, 0.78, 0.05, 0.045);
      smile(c, 0.8, -0.06, 0.06);
      blush(c, 0.68, -0.04);
    },
  },
  {
    id: 'hipopotamo',
    name: 'Hipopótamo',
    nameEn: 'Hippo',
    group: 'base',
    weight: 3,
    parts: [
      box(-0.7, -0.26, 0.46, 0.36, 0.18),
      poly([0.38, -0.22], [0.78, -0.22], [0.86, -0.04], [0.8, 0.22], [0.56, 0.32], [0.38, 0.24]),
      box(-0.6, -0.46, -0.32, -0.2),
      box(0.06, -0.46, 0.34, -0.2),
    ],
    draw(c) {
      const L = '#b49ae6';
      const D = '#7457b8';
      blob(c, [RR(-0.6, -0.46, -0.32, -0.1, 0.08), RR(0.06, -0.46, 0.34, -0.1, 0.08), RR(-0.72, -0.27, 0.5, 0.38, 0.26), SM([0.36, -0.24], [0.84, -0.24], [0.9, -0.04], [0.82, 0.24], [0.56, 0.34], [0.36, 0.26]), E(0.5, 0.36, 0.06, 0.05), E(-0.74, 0.08, 0.05, 0.04)], L, D, 0.38, -0.46);
      fill(c, E(0.66, -0.06, 0.22, 0.15), '#c9b4f2');
      fill(c, E(0.8, 0.04, 0.025, 0.018), '#4b2f86');
      fill(c, E(0.7, 0.06, 0.025, 0.018), '#4b2f86');
      c.beginPath();
      c.moveTo(0.52, -0.12);
      c.quadraticCurveTo(0.68, -0.18, 0.84, -0.1);
      line(c, 0.025);
      fill(c, RR(0.62, -0.17, 0.67, -0.11, 0.01), '#ffffff');
      fill(c, RR(0.74, -0.16, 0.79, -0.1, 0.01), '#ffffff');
      eye(c, 0.5, 0.17, 0.05);
      shine(c, -0.2, 0.28, 0.32, 0.06);
      blush(c, 0.48, 0.02);
    },
  },
  {
    id: 'elefante',
    name: 'Elefante',
    nameEn: 'Elephant',
    group: 'base',
    weight: 2,
    parts: [
      box(-0.68, -0.27, 0.44, 0.45, 0.2),
      poly([0.34, -0.06], [0.7, -0.02], [0.76, 0.32], [0.58, 0.5], [0.34, 0.46]),
      poly([0.66, -0.42], [0.82, -0.42], [0.8, 0.04], [0.64, 0.04]),
      box(-0.58, -0.5, -0.32, -0.2),
      box(0.04, -0.5, 0.3, -0.2),
    ],
    draw(c) {
      const L = '#b8c1d6';
      const D = '#7a849e';
      blob(c, [RR(-0.58, -0.5, -0.32, -0.1, 0.08), RR(0.04, -0.5, 0.3, -0.1, 0.08), RR(-0.7, -0.28, 0.46, 0.46, 0.28), SM([0.32, -0.08], [0.72, -0.04], [0.78, 0.34], [0.58, 0.52], [0.32, 0.48]), RR(0.64, -0.44, 0.82, 0.06, 0.08), SM([-0.82, 0.1], [-0.68, 0.18], [-0.7, 0.08])], L, D, 0.5, -0.5);
      // orelha
      blob(c, [SM([0.18, 0.02], [0.46, -0.04], [0.5, 0.36], [0.3, 0.5], [0.12, 0.34])], '#a9b2c9', '#6f7a94', 0.5, 0);
      fill(c, SM([0.22, 0.08], [0.42, 0.04], [0.44, 0.32], [0.3, 0.42], [0.18, 0.3]), '#f2a7bd');
      // anéis da tromba
      c.strokeStyle = 'rgba(60,70,95,0.45)';
      for (const y of [-0.3, -0.18, -0.06]) {
        c.beginPath();
        c.moveTo(0.66, y);
        c.lineTo(0.8, y + 0.02);
        line(c, 0.02, 'rgba(60,70,95,0.45)');
      }
      eye(c, 0.6, 0.26, 0.045);
      fill(c, SM([0.56, 0.02], [0.66, 0.0], [0.62, 0.08]), '#ffffff', true);
      shine(c, -0.22, 0.38, 0.3, 0.06);
    },
  },
  {
    id: 'capivara',
    name: 'Capivara',
    nameEn: 'Capybara',
    group: 'bloco',
    weight: 3,
    parts: [
      box(-0.68, -0.24, 0.5, 0.32, 0.2),
      poly([0.42, -0.16], [0.8, -0.14], [0.84, 0.12], [0.68, 0.34], [0.42, 0.32]),
      box(-0.56, -0.38, -0.34, -0.18),
      box(0.12, -0.38, 0.34, -0.18),
    ],
    draw(c) {
      const L = '#d49660';
      const D = '#93582b';
      blob(c, [RR(-0.56, -0.38, -0.34, -0.1, 0.07), RR(0.12, -0.38, 0.34, -0.1, 0.07), RR(-0.7, -0.25, 0.54, 0.34, 0.26), SM([0.4, -0.18], [0.84, -0.16], [0.88, 0.12], [0.7, 0.36], [0.4, 0.34]), E(0.5, 0.36, 0.06, 0.05)], L, D, 0.36, -0.38);
      fill(c, E(0.5, 0.36, 0.035, 0.03), '#7a4520');
      fill(c, E(0.82, 0.02, 0.03, 0.02), '#4a2a12');
      c.beginPath();
      c.moveTo(0.82, -0.02);
      c.quadraticCurveTo(0.78, -0.1, 0.7, -0.08);
      line(c, 0.025);
      eye(c, 0.62, 0.18, 0.04);
      shine(c, -0.2, 0.25, 0.32, 0.06);
    },
  },
  {
    id: 'gorila',
    name: 'Gorila',
    nameEn: 'Gorilla',
    group: 'bloco',
    weight: 2,
    parts: [
      box(-0.34, -0.3, 0.34, 0.42, 0.16),
      box(-0.58, -0.46, -0.3, 0.26, 0.1),
      box(0.3, -0.46, 0.58, 0.26, 0.1),
      box(-0.22, 0.34, 0.22, 0.7, 0.12),
      box(-0.3, -0.46, 0.3, -0.26, 0.06),
    ],
    draw(c) {
      const L = '#6b6487';
      const D = '#2f2a45';
      blob(c, [RR(-0.36, -0.46, 0.36, 0.44, 0.2), RR(-0.6, -0.47, -0.28, 0.28, 0.14), RR(0.28, -0.47, 0.6, 0.28, 0.14), SM([-0.24, 0.32], [0.24, 0.32], [0.24, 0.62], [0.12, 0.74], [-0.12, 0.74], [-0.24, 0.62])], L, D, 0.74, -0.47);
      fill(c, E(0, 0.02, 0.22, 0.26), '#9a8fb8');
      fill(c, E(0, 0.46, 0.17, 0.11), '#a69bc4');
      eye(c, -0.08, 0.58, 0.035);
      eye(c, 0.08, 0.58, 0.035);
      c.beginPath();
      c.moveTo(-0.14, 0.64);
      c.lineTo(0.14, 0.64);
      line(c, 0.03, '#2a2540');
      fill(c, E(-0.04, 0.48, 0.02, 0.015), INK);
      fill(c, E(0.04, 0.48, 0.02, 0.015), INK);
      smile(c, 0, 0.38, 0.06);
      fill(c, RR(-0.58, -0.47, -0.3, -0.38, 0.04), '#9a8fb8');
      fill(c, RR(0.3, -0.47, 0.58, -0.38, 0.04), '#9a8fb8');
    },
  },
  {
    id: 'castor',
    name: 'Castor',
    nameEn: 'Beaver',
    group: 'bloco',
    weight: 2,
    parts: [
      poly([-0.26, -0.4], [0.26, -0.4], [0.32, 0.04], [0.16, 0.3], [-0.18, 0.28], [-0.32, 0.0]),
      poly([0.0, 0.2], [0.36, 0.18], [0.46, 0.36], [0.32, 0.56], [0.02, 0.52]),
      poly([-0.76, -0.4], [-0.24, -0.4], [-0.24, -0.22], [-0.7, -0.24]),
    ],
    draw(c) {
      // cauda achatada com xadrez
      blob(c, [SM([-0.8, -0.42], [-0.22, -0.42], [-0.22, -0.2], [-0.74, -0.22])], '#6e4a33', '#3e2616', -0.2, -0.42);
      c.save();
      SM([-0.8, -0.42], [-0.22, -0.42], [-0.22, -0.2], [-0.74, -0.22])(c);
      c.clip();
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.lineWidth = 0.02;
      for (let x = -0.8; x < -0.2; x += 0.08) {
        c.beginPath();
        c.moveTo(x, -0.42);
        c.lineTo(x + 0.12, -0.2);
        c.moveTo(x + 0.12, -0.42);
        c.lineTo(x, -0.2);
        c.stroke();
      }
      c.restore();
      blob(c, [SM([-0.28, -0.42], [0.28, -0.42], [0.34, 0.04], [0.16, 0.32], [-0.2, 0.3], [-0.34, 0.0]), SM([-0.02, 0.18], [0.38, 0.16], [0.48, 0.36], [0.32, 0.58], [0.0, 0.54]), E(0.06, 0.54, 0.06, 0.05)], '#c98450', '#7d4a22', 0.58, -0.42);
      fill(c, E(0.04, -0.08, 0.18, 0.24), '#e0b07a');
      fill(c, E(0.36, 0.34, 0.12, 0.08), '#e0b07a');
      fill(c, E(0.44, 0.38, 0.035, 0.025), INK);
      fill(c, RR(0.34, 0.2, 0.42, 0.29, 0.015), '#ffffff', true);
      eye(c, 0.22, 0.44, 0.04);
      fill(c, RR(0.06, -0.42, 0.24, -0.34, 0.04), '#7d4a22');
      fill(c, E(0.2, 0.0, 0.07, 0.05, 0.3), '#7d4a22');
    },
  },
  {
    id: 'jacare',
    name: 'Jacaré',
    nameEn: 'Alligator',
    group: 'assimetrico',
    weight: 2,
    parts: [
      poly([-0.52, -0.12], [0.42, -0.12], [0.46, 0.06], [0.3, 0.17], [-0.4, 0.17], [-0.56, 0.05]),
      poly([0.38, -0.12], [0.96, -0.1], [0.99, 0.0], [0.9, 0.07], [0.44, 0.17]),
      poly([-1.02, -0.06], [-0.5, -0.12], [-0.5, 0.12]),
      box(-0.4, -0.25, -0.2, -0.1, 0.03),
      box(0.1, -0.25, 0.3, -0.1, 0.03),
    ],
    draw(c) {
      const L = '#7fd06a';
      const D = '#2f8a3a';
      blob(c, [RR(-0.4, -0.25, -0.2, -0.04, 0.05), RR(0.1, -0.25, 0.3, -0.04, 0.05), SM([-0.54, -0.13], [0.44, -0.13], [0.48, 0.07], [0.3, 0.19], [-0.4, 0.19], [-0.58, 0.05]), SM([0.36, -0.13], [0.98, -0.11], [1.01, 0.0], [0.92, 0.08], [0.44, 0.19]), SM([-1.04, -0.06], [-0.48, -0.13], [-0.48, 0.13]), E(0.5, 0.18, 0.07, 0.06)], L, D, 0.2, -0.25);
      fill(c, SM([-0.5, -0.12], [0.94, -0.1], [0.9, -0.05], [-0.4, -0.04]), '#e8e08a');
      for (let x = -0.85; x < 0.35; x += 0.13) fill(c, E(x, 0.15 - Math.max(0, -x - 0.5) * 0.15, 0.04, 0.035), '#3f9a3e', true);
      for (let x = 0.55; x < 0.92; x += 0.09) {
        c.beginPath();
        c.moveTo(x, -0.05);
        c.lineTo(x + 0.03, -0.11);
        c.lineTo(x + 0.06, -0.05);
        c.fillStyle = '#ffffff';
        c.fill();
      }
      c.beginPath();
      c.moveTo(0.5, -0.04);
      c.lineTo(0.96, -0.04);
      line(c, 0.022);
      eye(c, 0.52, 0.2, 0.04);
      fill(c, E(0.94, 0.05, 0.02, 0.014), INK);
    },
  },
  {
    id: 'canguru',
    name: 'Canguru',
    nameEn: 'Kangaroo',
    group: 'assimetrico',
    weight: 2,
    parts: [
      poly([-0.26, -0.28], [0.16, -0.28], [0.26, 0.14], [0.1, 0.44], [-0.14, 0.4], [-0.3, 0.04]),
      poly([0.04, 0.4], [0.36, 0.48], [0.4, 0.6], [0.2, 0.7], [0.02, 0.6]),
      poly([-0.26, -0.46], [0.34, -0.46], [0.34, -0.34], [-0.2, -0.26]),
      poly([-0.78, -0.46], [-0.26, -0.46], [-0.24, -0.22]),
    ],
    draw(c) {
      const L = '#f0b46a';
      const D = '#b8702e';
      blob(c, [SM([-0.8, -0.47], [-0.22, -0.47], [-0.2, -0.2]), SM([-0.28, -0.48], [0.36, -0.48], [0.36, -0.32], [-0.2, -0.24]), SM([-0.28, -0.3], [0.18, -0.3], [0.28, 0.14], [0.1, 0.46], [-0.16, 0.42], [-0.32, 0.04]), SM([0.02, 0.38], [0.38, 0.47], [0.42, 0.61], [0.2, 0.72], [0.0, 0.62]), E(0.0, 0.76, 0.05, 0.13, -0.2), E(0.1, 0.76, 0.05, 0.13, -0.5)], L, D, 0.85, -0.48);
      fill(c, E(0.02, 0.74, 0.025, 0.08, -0.2), '#f6a3b4');
      fill(c, E(0.04, -0.02, 0.12, 0.2), '#fbd9a6');
      fill(c, E(0.38, 0.55, 0.03, 0.024), INK);
      happyEye(c, 0.2, 0.6, 0.04);
      fill(c, RR(0.14, 0.04, 0.3, 0.12, 0.04), '#e39b52', true);
      blush(c, 0.26, 0.52);
    },
  },
  {
    id: 'cavalo',
    name: 'Cavalo',
    nameEn: 'Horse',
    group: 'desafio',
    weight: 2,
    parts: [
      box(-0.5, -0.19, 0.4, 0.19, 0.12),
      box(-0.44, -0.62, -0.26, -0.14, 0.04),
      box(0.18, -0.62, 0.36, -0.14, 0.04),
      poly([0.16, 0.0], [0.42, 0.0], [0.54, 0.48], [0.34, 0.58]),
      poly([0.38, 0.42], [0.74, 0.36], [0.78, 0.5], [0.6, 0.66], [0.4, 0.66]),
    ],
    draw(c) {
      const L = '#d98c4c';
      const D = '#954f1f';
      // crina e cauda (marrom escuro, atrás)
      blob(c, [SM([-0.5, 0.14], [-0.74, -0.06], [-0.7, -0.36], [-0.56, -0.1]), SM([0.3, 0.1], [0.34, 0.62], [0.46, 0.7], [0.2, 0.4])], '#7a3d16', '#4a220a', 0.7, -0.36);
      blob(c, [RR(-0.44, -0.62, -0.26, -0.1, 0.06), RR(0.18, -0.62, 0.36, -0.1, 0.06), RR(-0.52, -0.2, 0.42, 0.2, 0.17), SM([0.14, -0.02], [0.44, -0.02], [0.56, 0.48], [0.34, 0.6]), SM([0.36, 0.4], [0.76, 0.34], [0.8, 0.5], [0.6, 0.68], [0.38, 0.68]), E(0.44, 0.7, 0.05, 0.08, 0.3)], L, D, 0.7, -0.62);
      fill(c, RR(-0.45, -0.62, -0.25, -0.52, 0.03), '#f4e1c8', true);
      fill(c, RR(0.17, -0.62, 0.37, -0.52, 0.03), '#f4e1c8', true);
      fill(c, E(0.7, 0.44, 0.1, 0.08), '#f2c9a0');
      fill(c, E(0.74, 0.46, 0.022, 0.016), INK);
      eye(c, 0.52, 0.56, 0.04);
      shine(c, -0.1, 0.12, 0.26, 0.05);
    },
  },
  {
    id: 'raposa',
    name: 'Raposa',
    nameEn: 'Fox',
    group: 'desafio',
    weight: 2,
    parts: [
      poly([-0.16, -0.42], [0.26, -0.42], [0.3, 0.0], [0.12, 0.2], [-0.12, 0.15]),
      poly([0.0, 0.12], [0.3, 0.08], [0.52, 0.26], [0.32, 0.5], [0.04, 0.46]),
      poly([-0.7, -0.42], [-0.14, -0.42], [-0.18, -0.02], [-0.58, 0.18], [-0.8, -0.08]),
    ],
    draw(c) {
      const O = '#ff8a3c';
      const OD = '#c8501a';
      blob(c, [SM([-0.72, -0.43], [-0.1, -0.43], [-0.16, 0.0], [-0.6, 0.22], [-0.84, -0.08])], O, OD, 0.2, -0.43);
      c.save();
      SM([-0.72, -0.43], [-0.1, -0.43], [-0.16, 0.0], [-0.6, 0.22], [-0.84, -0.08])(c);
      c.clip();
      fill(c, E(-0.72, 0.08, 0.2, 0.16, -0.6), '#fff4e8');
      c.restore();
      blob(c, [SM([-0.18, -0.43], [0.28, -0.43], [0.32, 0.0], [0.12, 0.22], [-0.14, 0.17]), SM([-0.02, 0.1], [0.3, 0.06], [0.54, 0.26], [0.32, 0.52], [0.02, 0.48]), SM([0.06, 0.42], [0.14, 0.64], [0.2, 0.44]), SM([0.18, 0.46], [0.3, 0.64], [0.32, 0.44])], O, OD, 0.64, -0.43);
      fill(c, SM([0.0, -0.4], [0.24, -0.4], [0.26, -0.02], [0.08, 0.1]), '#fff4e8');
      fill(c, SM([0.26, 0.12], [0.54, 0.26], [0.36, 0.32]), '#fff4e8');
      fill(c, E(0.52, 0.26, 0.03, 0.025), INK);
      happyEye(c, 0.26, 0.34, 0.04);
      fill(c, RR(-0.02, -0.43, 0.12, -0.36, 0.03), '#4a2a12');
      fill(c, RR(0.14, -0.43, 0.28, -0.36, 0.03), '#4a2a12');
    },
  },
  {
    id: 'coruja',
    name: 'Coruja',
    nameEn: 'Owl',
    group: 'desafio',
    weight: 3,
    parts: [poly([-0.32, -0.42], [0.32, -0.42], [0.38, 0.0], [0.3, 0.38], [-0.3, 0.38], [-0.38, 0.0])],
    draw(c) {
      const L = '#a8714a';
      const D = '#6a3f22';
      blob(c, [SM([-0.34, -0.43], [0.34, -0.43], [0.4, 0.0], [0.32, 0.4], [-0.32, 0.4], [-0.4, 0.0]), SM([-0.32, 0.3], [-0.26, 0.5], [-0.12, 0.36]), SM([0.32, 0.3], [0.26, 0.5], [0.12, 0.36])], L, D, 0.5, -0.43);
      // asas
      fill(c, SM([-0.38, 0.06], [-0.24, -0.04], [-0.26, -0.34], [-0.4, -0.2]), '#8a5532', true);
      fill(c, SM([0.38, 0.06], [0.24, -0.04], [0.26, -0.34], [0.4, -0.2]), '#8a5532', true);
      fill(c, E(0, -0.14, 0.2, 0.22), '#f4dcb6');
      c.strokeStyle = 'rgba(140,90,50,0.6)';
      for (const [x, y] of [[-0.08, -0.06], [0.08, -0.06], [0, -0.16], [-0.1, -0.24], [0.1, -0.24]] as Pt[]) {
        c.beginPath();
        c.arc(x, y + 0.05, 0.05, Math.PI * 1.15, Math.PI * 1.85);
        line(c, 0.02, 'rgba(140,90,50,0.6)');
      }
      for (const s of [-1, 1]) {
        fill(c, E(s * 0.14, 0.18, 0.13, 0.13), '#fff7e6', true);
        fill(c, E(s * 0.14, 0.18, 0.085, 0.085), '#ffbf2e');
        eye(c, s * 0.14, 0.18, 0.05);
      }
      fill(c, SM([-0.04, 0.08], [0.04, 0.08], [0, -0.02]), '#ff9f2e');
      fill(c, RR(-0.18, -0.46, -0.04, -0.4, 0.03), '#ffb23c');
      fill(c, RR(0.04, -0.46, 0.18, -0.4, 0.03), '#ffb23c');
    },
  },
  {
    id: 'caracol',
    name: 'Caracol',
    nameEn: 'Snail',
    group: 'assimetrico',
    weight: 2,
    parts: [
      { type: 'circle', c: [-0.12, 0.14], r: 0.36 },
      poly([-0.58, -0.34], [0.56, -0.34], [0.62, -0.2], [0.32, -0.12], [-0.52, -0.12]),
      poly([0.3, -0.16], [0.52, -0.16], [0.56, 0.22], [0.4, 0.28]),
    ],
    draw(c) {
      const L = '#fbe2a6';
      const D = '#d9a85a';
      blob(c, [SM([-0.6, -0.35], [0.58, -0.35], [0.64, -0.2], [0.32, -0.1], [-0.54, -0.1]), SM([0.28, -0.18], [0.54, -0.18], [0.58, 0.22], [0.48, 0.3], [0.38, 0.28])], L, D, 0.3, -0.35);
      // chifres com olhos
      for (const [x, y] of [[0.42, 0.52], [0.6, 0.48]] as Pt[]) {
        c.beginPath();
        c.moveTo(0.48, 0.24);
        c.quadraticCurveTo(x - 0.04, y - 0.1, x, y);
        line(c, 0.035, '#d9a85a');
        fill(c, E(x, y, 0.06, 0.06), '#fbe2a6', true);
        eye(c, x + 0.01, y, 0.032);
      }
      smile(c, 0.5, 0.04, 0.06);
      // casco em espiral
      const sg = c.createRadialGradient(-0.2, 0.26, 0.05, -0.12, 0.14, 0.38);
      sg.addColorStop(0, '#e25b6a');
      sg.addColorStop(1, '#8e2436');
      fill(c, E(-0.12, 0.14, 0.37, 0.37), sg, true);
      c.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const a = t * TAU * 2.4;
        const r = 0.31 * (1 - t);
        const x = -0.12 + Math.cos(a) * r;
        const y = 0.14 + Math.sin(a) * r;
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      }
      line(c, 0.035, 'rgba(90,20,35,0.75)');
      shine(c, -0.24, 0.32, 0.12, 0.06, -0.5);
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
