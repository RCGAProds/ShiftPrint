/* parser.js
 * Convierte el texto plano de la tabla de origen en filas calculadas
 * con la estructura: { dia, fecha, entradas, salidas, horasTotales, pausa, esLibre }
 */

const DIAS_SEMANA = ['D', 'L', 'M', 'X', 'J', 'V', 'S']; // 0=Domingo ... 6=Sábado

/**
 * Parsea el bloque de texto en filas crudas.
 * Cada fila válida tiene 6 campos: Tipo, Estado, Fecha, Tiempo desde, Tiempo hasta, Estado(Accepted/etc)
 * Los campos vacíos (Día Libre sin horas) se conservan como cadenas vacías.
 */
function parseRawTable(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const rows = [];

  for (const line of lines) {
    // Separar por tabs o por 2+ espacios
    let fields = line.split(/\t/);
    if (fields.length < 3) {
      fields = line.split(/\s{2,}/);
    }
    fields = fields.map(f => f.trim());

    // Saltar línea de cabecera
    if (/^tipo$/i.test(fields[0]) && /^estado$/i.test(fields[1] || '')) {
      continue;
    }

    // Necesitamos al menos Tipo, Estado, Fecha
    if (fields.length < 3) continue;
    if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(fields[2] || '')) {
      // intentar reconstruir si la fecha está en otra posición no esperada
      continue;
    }

    rows.push({
      tipo: fields[0] || '',
      estado: fields[1] || '',
      fecha: fields[2] || '',
      desde: fields[3] || '',
      hasta: fields[4] || '',
      estadoFinal: fields[5] || ''
    });
  }

  return rows;
}

/**
 * Convierte "HH:MM" a minutos desde medianoche. Devuelve null si vacío/inválido.
 */
function timeToMinutes(t) {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Formatea minutos a "Xh Ym"
 */
function minutesToLabel(mins) {
  if (mins == null || isNaN(mins)) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h 00m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Obtiene la letra del día de la semana (L M X J V S D) para una fecha DD/MM/AAAA.
 */
function diaSemanaDeFecha(fechaStr) {
  const [d, m, y] = fechaStr.split('/').map(Number);
  const fullYear = y < 100 ? 2000 + y : y;
  const date = new Date(fullYear, m - 1, d);
  return DIAS_SEMANA[date.getDay()];
}

/**
 * Determina si una fila representa un día libre (sin turnos).
 */
function esFilaLibre(row) {
  const tipo = (row.tipo || '').toLowerCase();
  const estado = (row.estado || '').toLowerCase();
  const sinHoras = !row.desde && !row.hasta;
  return sinHoras && (tipo.includes('libre') || estado.includes('libre'));
}

/**
 * Agrupa filas por fecha y calcula las columnas de salida.
 * Devuelve un array ordenado cronológicamente.
 */
function buildScheduleRows(rawRows) {
  const byDate = new Map();

  for (const row of rawRows) {
    if (!byDate.has(row.fecha)) {
      byDate.set(row.fecha, []);
    }
    byDate.get(row.fecha).push(row);
  }

  const result = [];

  // Ordenar fechas cronológicamente
  const sortedDates = Array.from(byDate.keys()).sort((a, b) => {
    const [da, ma, ya] = a.split('/').map(Number);
    const [db, mb, yb] = b.split('/').map(Number);
    const yA = ya < 100 ? 2000 + ya : ya;
    const yB = yb < 100 ? 2000 + yb : yb;
    return new Date(yA, ma - 1, da) - new Date(yB, mb - 1, db);
  });

  for (const fecha of sortedDates) {
    const rowsForDate = byDate.get(fecha);
    const dia = diaSemanaDeFecha(fecha);
    const [d, m] = fecha.split('/');
    const fechaCorta = `${d.padStart(2, '0')}/${m.padStart(2, '0')}`;

    // ¿Es día libre? -> todas las filas de esa fecha son "libre" sin horas
    const todasLibres = rowsForDate.every(esFilaLibre);

    if (todasLibres) {
      result.push({
        dia,
        fecha: fechaCorta,
        entradas: '—',
        salidas: '—',
        horasTotales: 'Día Libre',
        pausa: '—',
        esLibre: true
      });
      continue;
    }

    // Recoger turnos con horas válidas, ordenados por hora de entrada
    const turnos = rowsForDate
      .filter(r => timeToMinutes(r.desde) != null && timeToMinutes(r.hasta) != null)
      .map(r => ({
        desde: timeToMinutes(r.desde),
        hasta: timeToMinutes(r.hasta),
        desdeStr: r.desde,
        hastaStr: r.hasta
      }))
      .sort((a, b) => a.desde - b.desde);

    if (turnos.length === 0) {
      // Fila sin horas y no marcada como libre -> tratar como libre/vacío
      result.push({
        dia,
        fecha: fechaCorta,
        entradas: '—',
        salidas: '—',
        horasTotales: '—',
        pausa: '—',
        esLibre: true
      });
      continue;
    }

    // Entradas / salidas
    const entradas = turnos.map(t => t.desdeStr).join(' / ');
    const salidas = turnos.map(t => t.hastaStr).join(' / ');

    // Horas totales = suma de duraciones de cada turno
    const totalMins = turnos.reduce((acc, t) => acc + (t.hasta - t.desde), 0);

    // Pausa entre turnos: gap entre el "hasta" de un turno y el "desde" del siguiente
    let pausaLabel = '—';
    if (turnos.length > 1) {
      let pausaTotal = 0;
      for (let i = 1; i < turnos.length; i++) {
        pausaTotal += Math.max(0, turnos[i].desde - turnos[i - 1].hasta);
      }
      pausaLabel = minutesToLabel(pausaTotal);
    }

    result.push({
      dia,
      fecha: fechaCorta,
      entradas,
      salidas,
      horasTotales: minutesToLabel(totalMins),
      pausa: pausaLabel,
      esLibre: false
    });
  }

  return result;
}

/**
 * Genera el texto Markdown de la tabla a partir de las filas calculadas.
 */
function buildMarkdown(scheduleRows) {
  const headers = ['Día', 'Fecha', 'Entrada(s)', 'Salida(s)', 'Horas totales', 'Pausa entre turnos'];

  // Calcular anchos mínimos para alinear visualmente (opcional, estilo "bonito")
  const colWidths = headers.map((h, i) => {
    let max = h.length;
    for (const row of scheduleRows) {
      const val = [row.dia, row.fecha, row.entradas, row.salidas, row.horasTotales, row.pausa][i];
      max = Math.max(max, String(val).length);
    }
    return max;
  });

  const pad = (val, width) => String(val) + ' '.repeat(Math.max(0, width - String(val).length));

  let md = '| ' + headers.map((h, i) => pad(h, colWidths[i])).join(' | ') + ' |\n';
  md += '| ' + colWidths.map(w => '-'.repeat(w)).join(' | ') + ' |\n';

  for (const row of scheduleRows) {
    const cells = [row.dia, row.fecha, row.entradas, row.salidas, row.horasTotales, row.pausa];
    md += '| ' + cells.map((c, i) => pad(c, colWidths[i])).join(' | ') + ' |\n';
  }

  return md.trimEnd();
}

/**
 * Detecta si el texto de entrada es Markdown o TSV.
 */
function detectInputFormat(text) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (/^\|?[- ]+\|[- ]+\|/.test(line.trim())) {
      return 'markdown';
    }
  }
  const pipeLines = lines.filter(l => l.trim().startsWith('|'));
  if (pipeLines.length >= 2) return 'markdown';
  return 'tsv';
}

/**
 * Parsea una tabla en formato Markdown.
 * Misma estructura de salida que parseRawTable().
 */
function parseMarkdownTable(text) {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const rows = [];

  for (const line of lines) {
    // Saltar línea separadora (|---|---|)
    if (/^\|?[- ]+\|[- ]+\|/.test(line)) continue;

    // Dividir por pipes y limpiar
    let fields = line.split('|').map(f => f.trim());
    // Eliminar primer y último si están vacíos (pipes externos)
    if (fields.length > 0 && fields[0] === '') fields.shift();
    if (fields.length > 0 && fields[fields.length - 1] === '') fields.pop();

    if (fields.length < 3) continue;

    // Saltar línea de cabecera
    if (/^tipo$/i.test(fields[0]) && /^estado$/i.test(fields[1] || '')) {
      continue;
    }

    // Validar fecha
    if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(fields[2] || '')) {
      continue;
    }

    rows.push({
      tipo: fields[0] || '',
      estado: fields[1] || '',
      fecha: fields[2] || '',
      desde: fields[3] || '',
      hasta: fields[4] || '',
      estadoFinal: fields[5] || ''
    });
  }

  return rows;
}

/**
 * Punto de entrada: texto crudo -> { rows, markdown }
 */
function processInput(text) {
  const format = detectInputFormat(text);
  const rawRows = format === 'markdown' ? parseMarkdownTable(text) : parseRawTable(text);
  if (rawRows.length === 0) {
    throw new Error('No se encontraron filas válidas. Comprueba el formato de la tabla.');
  }
  const rows = buildScheduleRows(rawRows);
  const markdown = buildMarkdown(rows);
  return { rows, markdown };
}
