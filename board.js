// board.js - Board setup, coordinates mapping, and dynamic SVG rendering
export const BOARD_SIZE = 100;

export const LADDERS = {
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91
};

export const SNAKES = {
  17: 7,
  54: 34,
  62: 45,
  64: 60,
  87: 70,
  93: 73,
  95: 75,
  98: 79,
  99: 80
};

// Translates tile number (1-100) into 10x10 grid coordinates
// 0,0 is top-left, 9,9 is bottom-right in the layout
export function getTileCoordinates(tileNumber) {
  const index = tileNumber - 1;
  const row = Math.floor(index / 10); // 0 (bottom) to 9 (top)
  const col = index % 10;
  
  // Serpentine layout
  const x = (row % 2 === 0) ? col : (9 - col);
  const y = 9 - row;
  
  return { x, y };
}

// Translates tile number to board coordinates in a 1000x1000 unit system
export function getBoardCoordinates(tileNumber) {
  const { x, y } = getTileCoordinates(tileNumber);
  return {
    x: x * 100 + 50,
    y: y * 100 + 50
  };
}

// Draws the snakes and ladders SVGs onto the container
export function renderBoardSVGs(svgContainer) {
  let innerSVG = '';
  const paths = {};

  // 0. Draw serpentine path guide connecting tiles 1 to 100
  let guideD = '';
  for (let i = 1; i <= 100; i++) {
    const p = getBoardCoordinates(i);
    if (i === 1) {
      guideD += `M ${p.x} ${p.y}`;
    } else {
      guideD += ` L ${p.x} ${p.y}`;
    }
  }
  innerSVG += `<path d="${guideD}" class="board-path-guide" />`;

  // 1. Draw Ladders
  Object.entries(LADDERS).forEach(([start, end], index) => {
    const pStart = getBoardCoordinates(parseInt(start));
    const pEnd = getBoardCoordinates(parseInt(end));

    innerSVG += generateLadderSVG(pStart.x, pStart.y, pEnd.x, pEnd.y, index);
  });

  // 2. Draw Snakes
  Object.entries(SNAKES).forEach(([start, end]) => {
    const pHead = getBoardCoordinates(parseInt(start)); // snake head is higher
    const pTail = getBoardCoordinates(parseInt(end));

    const { svg, pathD } = generateSnakeSVG(pHead.x, pHead.y, pTail.x, pTail.y, start);
    innerSVG += svg;
    paths[start] = pathD;
  });

  svgContainer.innerHTML += innerSVG; // append guide, ladders, and snakes to defs
  return paths;
}

function generateLadderSVG(x1, y1, x2, y2, index) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / L;
  const uy = dy / L;
  const px = -uy;
  const py = ux;
  
  const width = 18; // half width of ladder
  
  // Left rail coordinates
  const lx1 = x1 - px * width;
  const ly1 = y1 - py * width;
  const lx2 = x2 - px * width;
  const ly2 = y2 - py * width;
  
  // Right rail coordinates
  const rx1 = x1 + px * width;
  const ry1 = y1 + py * width;
  const rx2 = x2 + px * width;
  const ry2 = y2 + py * width;
  
  let svg = `<g class="ladder-group" id="ladder-${index}">`;
  
  // Glow underlay
  svg += `<path d="M ${lx1} ${ly1} L ${lx2} ${ly2}" class="ladder-rail-glow" />`;
  svg += `<path d="M ${rx1} ${ry1} L ${rx2} ${ry2}" class="ladder-rail-glow" />`;
  
  // Core rails
  svg += `<path d="M ${lx1} ${ly1} L ${lx2} ${ly2}" class="ladder-rail" />`;
  svg += `<path d="M ${rx1} ${ry1} L ${rx2} ${ry2}" class="ladder-rail" />`;
  
  // Rungs
  const rungsCount = Math.floor(L / 38);
  for (let i = 1; i < rungsCount; i++) {
    const t = i / rungsCount;
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    
    const rLx = cx - px * width;
    const rLy = cy - py * width;
    const rRx = cx + px * width;
    const rRy = cy + py * width;
    
    svg += `<line x1="${rLx}" y1="${rLy}" x2="${rRx}" y2="${rRy}" class="ladder-rung" />`;
  }
  
  svg += `</g>`;
  return svg;
}

function generateSnakeSVG(xH, yH, xT, yT, id) {
  const dx = xT - xH;
  const dy = yT - yH;
  const L = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / L;
  const uy = dy / L;
  const px = -uy;
  const py = ux;
  
  // Generate wave amplitude based on snake length and position parity
  const sign = (xH + yH) % 2 === 0 ? 1 : -1;
  const waveAmplitude = Math.min(L * 0.22, 140) * sign;
  
  const cx1 = xH + dx * 0.33 + px * waveAmplitude;
  const cy1 = yH + dy * 0.33 + py * waveAmplitude;
  const cx2 = xH + dx * 0.66 - px * waveAmplitude;
  const cy2 = yH + dy * 0.66 - py * waveAmplitude;
  
  const pathD = `M ${xH} ${yH} C ${cx1} ${cy1} ${cx2} ${cy2} ${xT} ${yT}`;
  
  // Head rotation angle (tangent at t=0 points to first control point)
  const angle = Math.atan2(cy1 - yH, cx1 - xH) * (180 / Math.PI);
  
  // Draw glowing body and tongue/eyes
  const svg = `
    <g class="snake-group" id="snake-${id}">
      <path d="${pathD}" class="snake-glow" />
      <path d="${pathD}" class="snake-body" />
      <g transform="translate(${xH}, ${yH}) rotate(${angle})">
        <ellipse cx="0" cy="0" rx="22" ry="14" class="snake-head" />
        <circle cx="8" cy="-5" r="3.5" class="snake-eye" />
        <circle cx="8" cy="5" r="3.5" class="snake-eye" />
        <path d="M 22 0 Q 28 -3 32 -2 M 22 0 Q 28 3 32 2" class="snake-tongue" />
      </g>
    </g>
  `;
  
  return { svg, pathD };
}
