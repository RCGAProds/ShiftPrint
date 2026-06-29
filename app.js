/* app.js
 * Orquesta el flujo: input -> parser -> estado -> render -> export.
 * v3: codificación compacta para QR pequeño y legible.
 *
 * FORMATO DE URL COMPACTO (#v=...):
 *   Cada grupo de turnos de un mismo día se codifica como:
 *     DDMMYY<tipo><turno1>[,<turno2>...]
 *   Donde:
 *     DDMMYY  = fecha (ej. 130626)
 *     <tipo>  = T (turno), L (libre), P (permiso), X (otro)
 *     <turno> = HHMM+HHMM  (entrada+salida sin separadores, ej. 054507450)
 *   Grupos separados por punto y coma.
 *   Ejemplo: 130626T054507459000110014062T094514001506L;1606L
 *
 * Ventaja: ~14 chars/día → 1 semana ≈ 100 chars, 4 semanas ≈ 450 chars.
 * El QR anterior codificaba JSON comprimido: ~960 chars → versión 40 (ilegible).
 * Ahora: versión 8–22 según días → fácilmente escaneable.
 */
document.addEventListener('DOMContentLoaded', () => {

const SAMPLE_INPUT = `Tipo\tEstado\tFecha\tTiempo desde\tTiempo hasta\tEstado\nTurnos\tTurno Publicado\t13/06/2026\t05:45\t07:45\tAccepted\nPermiso (CU)\tApprobado\t13/06/2026\t09:00\t11:00\tAccepted\nTurnos\tTurno Publicado\t14/06/2026\t09:45\t14:00\tAccepted\nDía Libre\tDía Libre\t15/06/2026\t\t\tAccepted\nDía Libre\tDía Libre\t16/06/2026\t\t\tAccepted`;

const SAMPLE_MD_INPUT = `| Tipo | Estado | Fecha | Tiempo desde | Tiempo hasta | Estado |\n|------|--------|-------|-------------|--------------|--------|\n| Turnos | Turno Publicado | 13/06/2026 | 05:45 | 07:45 | Accepted |\n| Permiso (CU) | Approbado | 13/06/2026 | 09:00 | 11:00 | Accepted |\n| Turnos | Turno Publicado | 14/06/2026 | 09:45 | 14:00 | Accepted |\n| Día Libre | Día Libre | 15/06/2026 | | | Accepted |\n| Día Libre | Día Libre | 16/06/2026 | | | Accepted |`;

let currentRows = [];

// Guardamos también los raw rows por fecha para poder codificar el QR
// con tiempos exactos (currentRows ya tiene entradas/salidas agregadas como string)
let rawRowsByDate = {}; // { 'DD/MM/YYYY': [{desde, hasta, tipo}, ...] }

const els = {
  rawInput: document.getElementById('rawInput'),
  btnProcess: document.getElementById('btnProcess'),
  btnSample: document.getElementById('btnSample'),
  btnSampleMd: document.getElementById('btnSampleMd'),
  btnClear: document.getElementById('btnClear'),
  parseStatus: document.getElementById('parseStatus'),

  cfgTheme: document.getElementById('cfgTheme'),
  cfgCard: document.getElementById('cfgCard'),
  cfgText: document.getElementById('cfgText'),
  cfgAccent: document.getElementById('cfgAccent'),
  cfgHeaderBg: document.getElementById('cfgHeaderBg'),
  cfgFontData: document.getElementById('cfgFontData'),
  cfgFontTitle: document.getElementById('cfgFontTitle'),
  cfgFontSize: document.getElementById('cfgFontSize'),
  cfgRadius: document.getElementById('cfgRadius'),
  cfgPadding: document.getElementById('cfgPadding'),
  cfgBorder: document.getElementById('cfgBorder'),
  cfgZebra: document.getElementById('cfgZebra'),
  cfgWeekend: document.getElementById('cfgWeekend'),
  cfgShadow: document.getElementById('cfgShadow'),
  cfgTitle: document.getElementById('cfgTitle'),
  cfgTitleAlign: document.getElementById('cfgTitleAlign'),

  outFontSize: document.getElementById('outFontSize'),
  outRadius: document.getElementById('outRadius'),
  outPadding: document.getElementById('outPadding'),
  outBorder: document.getElementById('outBorder'),

  previewStage: document.getElementById('previewStage'),
  emptyState: document.getElementById('emptyState'),
  dimHint: document.getElementById('dimHint'),

  markdownOutput: document.getElementById('markdownOutput'),
  btnCopyMd: document.getElementById('btnCopyMd'),
  btnDownloadPng: document.getElementById('btnDownloadPng'),
  btnShareQr: document.getElementById('btnShareQr'),

  // QR modal
  qrModal: document.getElementById('qrModal'),
  qrModalBackdrop: document.getElementById('qrModalBackdrop'),
  qrModalClose: document.getElementById('qrModalClose'),
  qrCanvas: document.getElementById('qrCanvas'),
  qrUrlLabel: document.getElementById('qrUrlLabel'),
  qrComplexityBadge: document.getElementById('qrComplexityBadge'),
  btnCopyQrLink: document.getElementById('btnCopyQrLink'),

  // Mobile banner
  mobileDownloadBanner: document.getElementById('mobileDownloadBanner'),
  btnMobileDownload: document.getElementById('btnMobileDownload')
};

/* =========================================================
   CONFIG
   ========================================================= */

function readConfig() {
  return {
    card: els.cfgCard.value,
    text: els.cfgText.value,
    accent: els.cfgAccent.value,
    headerBg: els.cfgHeaderBg.value,
    fontData: els.cfgFontData.value,
    fontTitle: els.cfgFontTitle.value,
    fontSize: parseInt(els.cfgFontSize.value, 10),
    radius: parseInt(els.cfgRadius.value, 10),
    padding: parseInt(els.cfgPadding.value, 10),
    border: parseInt(els.cfgBorder.value, 10),
    zebra: els.cfgZebra.checked,
    weekend: els.cfgWeekend.checked,
    shadow: els.cfgShadow.checked,
    title: els.cfgTitle.value || 'Mis turnos',
    titleAlign: els.cfgTitleAlign.value
  };
}

function applyThemePreset(name) {
  if (name === 'custom') return;
  const preset = THEME_PRESETS[name];
  if (!preset) return;
  els.cfgCard.value = preset.card;
  els.cfgText.value = preset.text;
  els.cfgAccent.value = preset.accent;
  els.cfgHeaderBg.value = preset.headerBg;
}

/* =========================================================
   PREVIEW
   ========================================================= */

function refreshPreview() {
  if (currentRows.length === 0) {
    els.previewStage.innerHTML = '';
    els.previewStage.appendChild(els.emptyState);
    els.dimHint.textContent = '—';
    els.btnDownloadPng.disabled = true;
    els.btnShareQr.disabled = true;
    return;
  }

  const config = readConfig();
  const card = renderScheduleCard(els.previewStage, currentRows, config);
  els.btnDownloadPng.disabled = false;
  els.btnShareQr.disabled = false;

  requestAnimationFrame(() => {
    const rect = card.getBoundingClientRect();
    els.dimHint.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px (aprox.)`;
  });
}

function syncOutputLabels() {
  els.outFontSize.textContent = els.cfgFontSize.value + 'px';
  els.outRadius.textContent = els.cfgRadius.value + 'px';
  els.outPadding.textContent = els.cfgPadding.value + 'px';
  els.outBorder.textContent = els.cfgBorder.value + 'px';
}

/* =========================================================
   PROCESS
   ========================================================= */

function processInputText() {
  const text = els.rawInput.value.trim();
  if (!text) {
    els.parseStatus.textContent = 'Pega una tabla antes de procesar.';
    els.parseStatus.className = 'status error';
    return;
  }

  try {
    const { rows, markdown, rawByDate } = processInput(text);
    currentRows = rows;
    rawRowsByDate = rawByDate || {};
    els.markdownOutput.value = markdown;
    els.btnCopyMd.disabled = false;

    els.parseStatus.textContent = `Procesado correctamente: ${rows.length} día(s) detectados.`;
    els.parseStatus.className = 'status ok';

    refreshPreview();
  } catch (err) {
    els.parseStatus.textContent = err.message || 'Error al procesar la tabla.';
    els.parseStatus.className = 'status error';
    currentRows = [];
    rawRowsByDate = {};
    els.markdownOutput.value = '';
    els.btnCopyMd.disabled = true;
    refreshPreview();
  }
}

/* =========================================================
   EXPORT PNG
   ========================================================= */

async function downloadPng() {
  const card = els.previewStage.querySelector('.shift-card');
  if (!card) return;

  els.btnDownloadPng.disabled = true;
  els.btnDownloadPng.textContent = 'Generando...';

  try {
    const dataUrl = await htmlToImage.toPng(card, {
      pixelRatio: 2,
      backgroundColor: null
    });
    const link = document.createElement('a');
    link.download = 'turnos.png';
    link.href = dataUrl;
    link.click();
  } catch (err) {
    console.error(err);
    els.parseStatus.textContent = 'No se pudo generar la imagen. Revisa la consola.';
    els.parseStatus.className = 'status error';
  } finally {
    els.btnDownloadPng.disabled = false;
    els.btnDownloadPng.textContent = 'Descargar PNG';
  }
}

/* =========================================================
   COPY MARKDOWN
   ========================================================= */

async function copyMarkdown() {
  try {
    await navigator.clipboard.writeText(els.markdownOutput.value);
    const original = els.btnCopyMd.textContent;
    els.btnCopyMd.textContent = 'Copiado ✓';
    setTimeout(() => { els.btnCopyMd.textContent = original; }, 1400);
  } catch (err) {
    els.markdownOutput.select();
  }
}

/* =========================================================
   CODIFICACIÓN COMPACTA PARA QR
   =========================================================
   Formato: grupos separados por ";"
   Cada grupo: DDMMYY<tipo>[<hhmm><hhmm>[,<hhmm><hhmm>...]]
     - DDMMYY : fecha en 6 dígitos (sin separadores)
     - tipo   : T=turno, L=libre, P=permiso, X=otro
     - hhmm   : hora sin ":" (4 dígitos), pairs de entrada+salida
     - múltiples turnos en el mismo día separados por ","
   Ejemplo 1 turno: 130626T05450745
   Ejemplo 2 turnos: 130626T05450745,09001100
   Ejemplo libre:    150626L
   ========================================================= */

/**
 * Clasifica el tipo de fila en un código de 1 char.
 */
function tipoCode(tipo) {
  const t = (tipo || '').toLowerCase();
  if (t.includes('libre')) return 'L';
  if (t.includes('permiso')) return 'P';
  return 'T';
}

/**
 * Codifica el estado actual (rawRowsByDate) en la cadena compacta.
 * Si rawRowsByDate está vacío, intenta reconstruir desde currentRows.
 */
function encodeCompact() {
  const parts = [];

  // Ordenar fechas cronológicamente
  const fechas = Object.keys(rawRowsByDate).sort((a, b) => {
    const [da, ma, ya] = a.split('/').map(Number);
    const [db, mb, yb] = b.split('/').map(Number);
    return new Date(ya < 100 ? 2000+ya : ya, ma-1, da)
         - new Date(yb < 100 ? 2000+yb : yb, mb-1, db);
  });

  for (const fecha of fechas) {
    const [d, m, y] = fecha.split('/');
    const yy = String(y || new Date().getFullYear()).slice(-2);
    const dd = d.padStart(2, '0');
    const mm = m.padStart(2, '0');
    const dateKey = dd + mm + yy;

    const rows = rawRowsByDate[fecha];
    const libre = rows.every(r => !r.desde && !r.hasta);

    if (libre) {
      // Determinar tipo predominante
      const tc = tipoCode(rows[0]?.tipo || '');
      parts.push(dateKey + (tc === 'T' ? 'L' : tc));
    } else {
      const turnos = rows
        .filter(r => r.desde && r.hasta)
        .sort((a, b) => a.desde.localeCompare(b.desde));

      if (turnos.length === 0) {
        parts.push(dateKey + 'L');
        continue;
      }

      const tc = tipoCode(turnos[0]?.tipo || '');
      // Primer turno va pegado al tipo; los siguientes separados por ","
      const firstShift = turnos[0].desde.replace(':', '') + turnos[0].hasta.replace(':', '');
      const extraShifts = turnos.slice(1).map(t =>
        t.desde.replace(':', '') + t.hasta.replace(':', '')
      );

      const shiftsStr = extraShifts.length > 0
        ? firstShift + ',' + extraShifts.join(',')
        : firstShift;

      parts.push(dateKey + tc + shiftsStr);
    }
  }

  return parts.join(';');
}

/**
 * Decodifica la cadena compacta y devuelve un array de filas TSV
 * que processInput() puede consumir.
 */
function decodeCompact(encoded) {
  const groups = encoded.split(';').filter(Boolean);
  const tsvLines = ['Tipo\tEstado\tFecha\tTiempo desde\tTiempo hasta\tEstado'];

  for (const group of groups) {
    // DDMMYY = primeros 6 chars
    const dd = group.slice(0, 2);
    const mm = group.slice(2, 4);
    const yy = group.slice(4, 6);
    const year = '20' + yy;
    const fecha = `${dd}/${mm}/${year}`;

    const rest = group.slice(6); // tipo + turnos
    if (!rest) continue;

    const tipo = rest[0]; // T, L, P, X
    const shiftsStr = rest.slice(1); // '' si libre, '05450745,...' si hay turnos

    if (tipo === 'L' || !shiftsStr) {
      // Día libre
      const tipoLabel = tipo === 'P' ? 'Permiso (CU)' : 'Día Libre';
      tsvLines.push(`${tipoLabel}\t${tipoLabel}\t${fecha}\t\t\tAccepted`);
    } else {
      // Uno o más turnos
      const shiftPairs = shiftsStr.split(',');
      for (const shift of shiftPairs) {
        if (shift.length < 8) continue;
        const desde = shift.slice(0, 2) + ':' + shift.slice(2, 4);
        const hasta = shift.slice(4, 6) + ':' + shift.slice(6, 8);
        const tipoLabel = tipo === 'P' ? 'Permiso (CU)' : 'Turnos';
        const estadoLabel = tipo === 'P' ? 'Approbado' : 'Turno Publicado';
        tsvLines.push(`${tipoLabel}\t${estadoLabel}\t${fecha}\t${desde}\t${hasta}\tAccepted`);
      }
    }
  }

  return tsvLines.join('\n');
}

/* =========================================================
   QR — COMPARTIR POR ENLACE COMPACTO
   ========================================================= */

/**
 * Construye la URL con codificación compacta.
 * Formato: <base>#v=<encoded>
 * "v" de "version 2" del formato (distingue del antiguo #data=)
 */
function buildShareUrl() {
  const encoded = encodeCompact();
  const base = window.location.href.split('#')[0];
  return `${base}#v=${encoded}`;
}

/**
 * Estima la versión QR a partir de la longitud de la URL.
 * Basado en capacidad alfanumérica con corrección de error L.
 */
function estimateQrComplexity(urlLength) {
  if (urlLength <= 114) return { version: 7,  label: 'Muy sencillo', color: '#3a7a4e' };
  if (urlLength <= 163) return { version: 9,  label: 'Sencillo',     color: '#3a7a4e' };
  if (urlLength <= 256) return { version: 12, label: 'Normal',       color: '#5a6a3a' };
  if (urlLength <= 395) return { version: 16, label: 'Normal',       color: '#5a6a3a' };
  if (urlLength <= 511) return { version: 20, label: 'Aceptable',    color: '#8a6a1a' };
  if (urlLength <= 745) return { version: 25, label: 'Complejo',     color: '#b8493d' };
  return                       { version: 30, label: 'Muy complejo', color: '#b8493d' };
}

/**
 * Abre el modal QR con la URL compacta.
 */
function openQrModal() {
  if (currentRows.length === 0) return;

  const url = buildShareUrl();
  const complexity = estimateQrComplexity(url.length);

  // Generar QR: canvas de 300px, corrección L (menos módulos = más legible)
  new QRious({
    element: els.qrCanvas,
    value: url,
    size: 300,
    level: 'L',
    background: '#fbf8f2',
    foreground: '#262220',
    padding: 16
  });

  // Mostrar indicador de complejidad
  if (els.qrComplexityBadge) {
    els.qrComplexityBadge.textContent = complexity.label;
    els.qrComplexityBadge.style.color = complexity.color;
  }

  // Mostrar longitud de URL como referencia
  els.qrUrlLabel.textContent = `${url.length} caracteres · versión QR ~${complexity.version}`;

  // Guardar URL para el botón de copiar
  els.btnCopyQrLink.dataset.url = url;

  els.qrModal.hidden = false;
  els.qrModalBackdrop.hidden = false;
  document.body.classList.add('modal-open');
}

function closeQrModal() {
  els.qrModal.hidden = true;
  els.qrModalBackdrop.hidden = true;
  document.body.classList.remove('modal-open');
}

async function copyQrLink() {
  const url = els.btnCopyQrLink.dataset.url || '';
  try {
    await navigator.clipboard.writeText(url);
    const orig = els.btnCopyQrLink.textContent;
    els.btnCopyQrLink.textContent = 'Copiado ✓';
    setTimeout(() => { els.btnCopyQrLink.textContent = orig; }, 1400);
  } catch {
    prompt('Copia este enlace:', url);
  }
}

/* =========================================================
   MODO MÓVIL: restaurar desde URL con hash
   =========================================================
   Soporta dos formatos:
     #v=<compact>   → nuevo formato compacto (v3)
     #data=<lz>     → formato antiguo LZString (v2, compatibilidad)
   ========================================================= */

function tryRestoreFromHash() {
  const hash = window.location.hash;
  let rawText = null;

  if (hash.startsWith('#v=')) {
    // — Nuevo formato compacto —
    const encoded = hash.slice(3);
    if (!encoded) return;
    try {
      rawText = decodeCompact(encoded);
    } catch (err) {
      console.warn('Error decodificando formato compacto:', err);
      return;
    }

  } else if (hash.startsWith('#data=')) {
    // — Formato antiguo LZString (compatibilidad con QRs ya generados) —
    const compressed = hash.slice(6);
    if (!compressed || typeof LZString === 'undefined') return;
    try {
      const json = LZString.decompressFromEncodedURIComponent(compressed);
      if (!json) throw new Error('Descompresión fallida');
      const payload = JSON.parse(json);
      rawText = payload.rawInput || null;

      // Restaurar config si viene en el payload
      if (payload.config) {
        applyConfigFromObject(payload.config);
      }
      // Si no hay rawInput pero hay rows precalculadas, usarlas directamente
      if (!rawText && Array.isArray(payload.rows) && payload.rows.length > 0) {
        currentRows = payload.rows;
        finishMobileRestore();
        return;
      }
    } catch (err) {
      console.warn('Error decodificando formato antiguo:', err);
      return;
    }
  } else {
    return; // No hay hash que procesar
  }

  if (!rawText) return;

  try {
    const { rows, markdown, rawByDate } = processInput(rawText);
    currentRows = rows;
    rawRowsByDate = rawByDate || {};

    els.rawInput.value = rawText;
    els.markdownOutput.value = markdown;
    els.btnCopyMd.disabled = false;

    syncOutputLabels();
    finishMobileRestore();
  } catch (err) {
    console.warn('Error procesando datos restaurados:', err);
  }
}

/**
 * Aplica un objeto config a los controles del formulario.
 */
function applyConfigFromObject(c) {
  if (c.card)      els.cfgCard.value = c.card;
  if (c.text)      els.cfgText.value = c.text;
  if (c.accent)    els.cfgAccent.value = c.accent;
  if (c.headerBg)  els.cfgHeaderBg.value = c.headerBg;
  if (c.fontData)  els.cfgFontData.value = c.fontData;
  if (c.fontTitle) els.cfgFontTitle.value = c.fontTitle;
  if (c.fontSize)  els.cfgFontSize.value = c.fontSize;
  if (c.radius !== undefined) els.cfgRadius.value = c.radius;
  if (c.padding !== undefined) els.cfgPadding.value = c.padding;
  if (c.border !== undefined)  els.cfgBorder.value = c.border;
  if (c.zebra !== undefined)   els.cfgZebra.checked = c.zebra;
  if (c.weekend !== undefined) els.cfgWeekend.checked = c.weekend;
  if (c.shadow !== undefined)  els.cfgShadow.checked = c.shadow;
  if (c.title)       els.cfgTitle.value = c.title;
  if (c.titleAlign)  els.cfgTitleAlign.value = c.titleAlign;
  els.cfgTheme.value = 'custom';
}

/**
 * Renderiza la previsualización y muestra el banner en móvil.
 */
function finishMobileRestore() {
  refreshPreview();

  els.parseStatus.textContent = 'Tabla restaurada desde enlace compartido.';
  els.parseStatus.className = 'status ok';

  els.mobileDownloadBanner.hidden = false;
  document.body.classList.add('has-download-banner');
  setTimeout(() => els.mobileDownloadBanner.scrollIntoView({ behavior: 'smooth' }), 300);
}

/* =========================================================
   DESCARGA MÓVIL desde banner
   ========================================================= */

async function mobileDownloadPng() {
  const card = els.previewStage.querySelector('.shift-card');
  if (!card) return;

  const btn = els.btnMobileDownload;
  btn.disabled = true;
  btn.textContent = 'Generando…';

  try {
    const dataUrl = await htmlToImage.toPng(card, {
      pixelRatio: 2,
      backgroundColor: null
    });

    // Abrir imagen en pestaña nueva para que el usuario la guarde
    // ("Mantener pulsado > Guardar imagen") — máxima compatibilidad iOS/Android
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Mis turnos</title>
        <style>
          body{margin:0;background:#1a1a1a;display:flex;flex-direction:column;
               align-items:center;min-height:100vh;padding:16px;box-sizing:border-box;}
          img{max-width:100%;height:auto;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.5);}
          p{color:#fff;font-family:-apple-system,sans-serif;font-size:14px;
            text-align:center;margin-top:18px;opacity:.7;line-height:1.5;}
        </style>
        </head><body>
        <img src="${dataUrl}" alt="Tabla de turnos">
        <p>Mantén pulsada la imagen para guardarla en tu galería</p>
        </body></html>
      `);
      win.document.close();
    } else {
      // Fallback: descarga directa
      const link = document.createElement('a');
      link.download = 'turnos.png';
      link.href = dataUrl;
      link.click();
    }
  } catch (err) {
    console.error(err);
    btn.textContent = 'Error al generar';
    setTimeout(() => { btn.disabled = false; btn.textContent = 'Descargar PNG'; }, 2000);
    return;
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = 'Descargar PNG';
  }, 1500);
}

/* =========================================================
   LISTENERS
   ========================================================= */

els.btnProcess.addEventListener('click', processInputText);

els.btnSample.addEventListener('click', () => {
  els.rawInput.value = SAMPLE_INPUT;
  processInputText();
});

els.btnSampleMd.addEventListener('click', () => {
  els.rawInput.value = SAMPLE_MD_INPUT;
  processInputText();
});

els.btnClear.addEventListener('click', () => {
  els.rawInput.value = '';
  currentRows = [];
  rawRowsByDate = {};
  els.markdownOutput.value = '';
  els.btnCopyMd.disabled = true;
  els.btnDownloadPng.disabled = true;
  els.btnShareQr.disabled = true;
  els.parseStatus.textContent = '';
  els.parseStatus.className = 'status';
  refreshPreview();
});

els.btnCopyMd.addEventListener('click', copyMarkdown);
els.btnDownloadPng.addEventListener('click', downloadPng);
els.btnShareQr.addEventListener('click', openQrModal);

// QR modal
els.qrModalClose.addEventListener('click', closeQrModal);
els.qrModalBackdrop.addEventListener('click', closeQrModal);
els.btnCopyQrLink.addEventListener('click', copyQrLink);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !els.qrModal.hidden) closeQrModal();
});

// Mobile banner
els.btnMobileDownload.addEventListener('click', mobileDownloadPng);

// Config: theme preset
els.cfgTheme.addEventListener('change', () => {
  applyThemePreset(els.cfgTheme.value);
  refreshPreview();
});

// Config: cualquier otro control -> re-render en tiempo real
const liveControls = [
  els.cfgCard, els.cfgText, els.cfgAccent, els.cfgHeaderBg,
  els.cfgFontData, els.cfgFontTitle, els.cfgFontSize, els.cfgRadius,
  els.cfgPadding, els.cfgBorder, els.cfgZebra, els.cfgWeekend,
  els.cfgShadow, els.cfgTitle, els.cfgTitleAlign
];

liveControls.forEach(el => {
  el.addEventListener('input', () => {
    syncOutputLabels();
    if (['cfgCard', 'cfgText', 'cfgAccent', 'cfgHeaderBg'].includes(el.id)) {
      els.cfgTheme.value = 'custom';
    }
    refreshPreview();
  });
});

// Inicialización
syncOutputLabels();

// Intentar restaurar estado desde URL (cuando se llega desde QR)
tryRestoreFromHash();

});
