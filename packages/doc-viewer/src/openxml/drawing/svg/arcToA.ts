/**
 */

function floatEqual(a: number, b: number) {
  if (a === b) {
    return true;
  }

  const diff = Math.abs(a - b);

  if (diff < Number.EPSILON) {
    return true;
  }

  return diff <= Number.EPSILON * Math.min(Math.abs(a), Math.abs(b));
}

/**
 */
const radians = (deg: number) => Math.PI * (deg / 60000 / 180);

/**
 */
export default function arcToPathA(
  wR: number,
  hR: number,
  stAng: number,
  swAng: number,
  preX: number,
  preY: number
) {
  let startR = radians(stAng);
  let swAngR = radians(swAng);
  let endR = radians(stAng + swAng);

  if (floatEqual(swAng, 60000 * 360)) {
    // [comment removed]
    endR = endR - 0.0001;
  }

  const end = getEndPoint(wR, hR, startR, endR, 0, preX, preY);

  // [comment removed]
  const largeArcFlag = Math.abs(swAngR) > Math.PI ? 1 : 0;
  // [comment removed]
  const sweepFlag = swAng > 0 ? 1 : 0;

  const path = `A ${wR} ${hR} 0 ${largeArcFlag} ${sweepFlag} ${end.x},${end.y}`;

  return {
    path,
    end
  };
}

/**
 */
function matrixMul(first: number[][], second: number[]) {
  return [
    first[0][0] * second[0] + first[0][1] * second[1],
    first[1][0] * second[0] + first[1][1] * second[1]
  ];
}

/**
 * https://www.cnblogs.com/ryzen/p/15191386.html
 * https://wiki.documentfoundation.org/Development/Improve_handles_of_DrawingML_shapes
 *
 */
function getEndPoint(
  rx: number,
  ry: number,
  stAng: number,
  swAng: number,
  rotate: number,
  x: number,
  y: number
) {
  let startR = stAng;
  let endR = swAng;

  // [comment removed]
  const matrixX1Y1 = [x, y];
  const matrix1 = [
    [Math.cos(rotate), -Math.sin(rotate)],
    [Math.sin(rotate), Math.cos(rotate)]
  ];

  const matrix2 = [rx * Math.cos(startR), ry * Math.sin(startR)];

  // [comment removed]
  const secondPart = matrixMul(matrix1, matrix2);

  const matrixCxCy = [
    matrixX1Y1[0] - secondPart[0],
    matrixX1Y1[1] - secondPart[1]
  ];

  const matrix3 = [rx * Math.cos(endR), ry * Math.sin(endR)];

  const firstPart = matrixMul(matrix1, matrix3);

  const result = [matrixCxCy[0] + firstPart[0], matrixCxCy[1] + firstPart[1]];

  return {
    x: result[0],
    y: result[1]
  };
}
