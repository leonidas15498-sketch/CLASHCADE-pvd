import { DEFAULT_PARAMS, TABLE, TableGeometry } from './table';

/**
 * Triângulo de 15 bolas: ápice no ponto do pé, bola 8 no centro (3ª fileira, meio),
 * cantos traseiros com uma lisa (2) e uma listrada (11) — conforme WPA.
 */
export const RACK_ORDER: number[][] = [
  [1],
  [10, 3],
  [4, 8, 14],
  [13, 7, 12, 5],
  [2, 15, 6, 9, 11],
];

export function rackPositions(table: TableGeometry = TABLE, R = DEFAULT_PARAMS.ballRadius) {
  const gap = 0.0002; // folga mínima para evitar sobreposição inicial
  const dxRow = (2 * R + gap) * Math.cos(Math.PI / 6);
  const out: Array<{ id: number; x: number; y: number }> = [];
  RACK_ORDER.forEach((row, r) => {
    row.forEach((id, i) => {
      out.push({
        id,
        x: table.footSpot.x + r * dxRow,
        y: table.footSpot.y + (i - r / 2) * (2 * R + gap),
      });
    });
  });
  return out;
}

export function initialPositions(table: TableGeometry = TABLE, R = DEFAULT_PARAMS.ballRadius) {
  return [{ id: 0, x: table.headSpot.x, y: table.headSpot.y }, ...rackPositions(table, R)];
}
