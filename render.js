/* render.js
 * Construye el DOM de la "tarjeta" de horario aplicando la configuración
 * visual elegida por el usuario, y la inserta en el contenedor de previsualización.
 */

const THEME_PRESETS = {
  oficina: {
    bg: '#f0f2f5',
    card: '#ffffff',
    text: '#1e2330',
    accent: '#3b4cca',
    headerBg: '#1e2330'
  },
  espresso: {
    bg: '#f2e8d9',
    card: '#fdf8f2',
    text: '#2c1d0e',
    accent: '#7a4520',
    headerBg: '#3d2210'
  },
  mono: {
    bg: '#e9e9e9',
    card: '#ffffff',
    text: '#1a1a1a',
    accent: '#1a1a1a',
    headerBg: '#1a1a1a'
  },
  hospital: {
    bg: '#e8f0ec',
    card: '#f7fbf8',
    text: '#1b2e24',
    accent: '#2d7a4f',
    headerBg: '#2d7a4f'
  },
  ink: {
    bg: '#15171c',
    card: '#1e2128',
    text: '#e8e6e1',
    accent: '#7aa2f7',
    headerBg: '#2a2e38'
  },
  terminal: {
    bg: '#0d0e0b',
    card: '#141510',
    text: '#e8c96a',
    accent: '#c8a83a',
    headerBg: '#1e1d14'
  },
  blueprint: {
    bg: '#1a2640',
    card: '#1f2e50',
    text: '#d4e4f7',
    accent: '#5ba3d9',
    headerBg: '#0f1a30'
  },
  shadow_clay: {
  bg: '#1a1a1a',
  card: '#272727',
  text: '#D4AA7D',
  accent: '#D4AA7D',
  headerBg: '#0e0e0e'
  },
  icy_gunmetal: {
  bg: '#2a2d30',
  card: '#35393C',
  text: '#A4D8FF',
  accent: '#A4D8FF',
  headerBg: '#1e2124'
  },
  raspberry_space: {
  bg: '#010e1c',
  card: '#012641',
  text: '#f0f4f8',
  accent: '#EE005A',
  headerBg: '#EE005A'
  },
};

/**
 * Convierte hex (#rrggbb) a "r, g, b"
 */
function hexToRgb(hex) {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

/**
 * Determina si un color es "claro" para decidir el color de texto del header.
 */
function isLightColor(hex) {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

/**
 * Renderiza la tarjeta de horario dentro del elemento contenedor dado.
 * config: {
 *   bg, card, text, accent, headerBg, fontData, fontTitle,
 *   fontSize, radius, padding, border, zebra, weekend, shadow, title
 * }
 */
function renderScheduleCard(container, scheduleRows, config) {
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'shift-card';
  card.style.background = config.bg;
  card.style.fontFamily = config.fontData;
  card.style.color = config.text;

  const inner = document.createElement('div');
  inner.className = 'card-inner';
  inner.style.setProperty('--card-bg', config.card);
  inner.style.setProperty('--card-radius', config.radius + 'px');
  inner.style.setProperty('--cell-font', config.fontSize + 'px');
  inner.style.setProperty('--cell-pad', config.padding + 'px');
  inner.style.setProperty('--cell-border', config.border + 'px');
  inner.style.setProperty('--line-color', shadeBorder(config.card, config.text));
  inner.style.setProperty('--header-bg', config.headerBg);
  inner.style.setProperty('--header-fg', isLightColor(config.headerBg) ? '#1a1a1a' : '#ffffff');
  inner.style.setProperty('--zebra-bg', `rgba(${hexToRgb(config.text)}, 0.045)`);
  inner.style.setProperty('--accent-color', config.accent);
  inner.style.color = config.text;
  if (config.shadow) {
    inner.style.setProperty('--card-shadow', '0 18px 40px -12px rgba(0,0,0,0.25)');
  } else {
    inner.style.setProperty('--card-shadow', 'none');
  }

  // Título
  const title = document.createElement('h3');
  title.textContent = config.title || 'Mis turnos';
  title.style.fontFamily = config.fontTitle;
  title.style.color = config.text;
  inner.appendChild(title);

  // Tabla
  const table = document.createElement('table');

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const headers = ['Día', 'Fecha', 'Entrada(s)', 'Salida(s)', 'Horas totales', 'Pausa entre turnos'];
  for (const h of headers) {
    const th = document.createElement('th');
    th.textContent = h;
    th.style.fontFamily = config.fontTitle;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  scheduleRows.forEach((row, idx) => {
    const tr = document.createElement('tr');

    if (config.zebra && idx % 2 === 1) {
      tr.classList.add('zebra');
    }
    if (config.weekend && (row.dia === 'S' || row.dia === 'D')) {
      tr.classList.add('weekend');
    }
    if (row.esLibre) {
      tr.classList.add('dayoff');
    }

    const cells = [row.dia, row.fecha, row.entradas, row.salidas, row.horasTotales, row.pausa];
    for (const c of cells) {
      const td = document.createElement('td');
      td.textContent = c;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  inner.appendChild(table);

  // Pie de tarjeta: info de generación + resumen (días trabajados / horas totales),
  // mismo estilo sutil, centrado.
  const summary = buildSummary(scheduleRows);

  const foot = document.createElement('div');
  foot.className = 'card-foot';
  foot.style.fontFamily = config.fontData;
  foot.style.textAlign = 'center';
  foot.textContent =
    `Generado · ${scheduleRows.length} día(s)` +
    `  ·  ${summary.diasTrabajados} día(s) trabajados` +
    `  ·  ${summary.horasLabel} totales`;
  inner.appendChild(foot);

  card.appendChild(inner);
  container.appendChild(card);

  return card;
}

/**
 * Calcula el resumen final: nº de días trabajados y suma total de horas.
 * Se basa en el campo `horasTotales` ("Xh Ym" o "Día Libre"/"—") y `esLibre`.
 */
function buildSummary(scheduleRows) {
  let diasTrabajados = 0;
  let totalMinutos = 0;

  for (const row of scheduleRows) {
    if (row.esLibre) continue;

    const match = String(row.horasTotales).match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
    const horas = match && match[1] ? parseInt(match[1], 10) : 0;
    const minutos = match && match[2] ? parseInt(match[2], 10) : 0;
    const mins = horas * 60 + minutos;

    if (mins > 0) {
      diasTrabajados += 1;
      totalMinutos += mins;
    }
  }

  return {
    diasTrabajados,
    horasLabel: minutesToLabel(totalMinutos)
  };
}

/**
 * Genera un color de borde sutil derivado del color de tarjeta y texto.
 */
function shadeBorder(cardHex, textHex) {
  // Mezcla simple: 88% tarjeta + 12% texto
  const c = hexToRgbObj(cardHex);
  const t = hexToRgbObj(textHex);
  const mix = (a, b) => Math.round(a * 0.88 + b * 0.12);
  const r = mix(c.r, t.r);
  const g = mix(c.g, t.g);
  const b = mix(c.b, t.b);
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgbObj(hex) {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.substring(0, 2), 16),
    g: parseInt(m.substring(2, 4), 16),
    b: parseInt(m.substring(4, 6), 16)
  };
}
