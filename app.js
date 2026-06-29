/* app.js
 * Orquesta el flujo: input -> parser -> estado -> render -> export.
 */
document.addEventListener('DOMContentLoaded', () => {

const SAMPLE_INPUT = `Tipo	Estado	Fecha	Tiempo desde	Tiempo hasta	Estado
Turnos	Turno Publicado	13/06/2026	05:45	07:45	Accepted
Permiso (CU)	Approbado	13/06/2026	09:00	11:00	Accepted
Turnos	Turno Publicado	14/06/2026	09:45	14:00	Accepted
Día Libre	Día Libre	15/06/2026			Accepted
Día Libre	Día Libre	16/06/2026			Accepted`;

const SAMPLE_MD_INPUT = `| Tipo | Estado | Fecha | Tiempo desde | Tiempo hasta | Estado |
|------|--------|-------|-------------|--------------|--------|
| Turnos | Turno Publicado | 13/06/2026 | 05:45 | 07:45 | Accepted |
| Permiso (CU) | Approbado | 13/06/2026 | 09:00 | 11:00 | Accepted |
| Turnos | Turno Publicado | 14/06/2026 | 09:45 | 14:00 | Accepted |
| Día Libre | Día Libre | 15/06/2026 | | | Accepted |
| Día Libre | Día Libre | 16/06/2026 | | | Accepted |`;

let currentRows = [];

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
  btnDownloadPng: document.getElementById('btnDownloadPng')
};

/**
 * Lee la configuración actual desde los controles.
 */
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

/**
 * Aplica un preset de tema a los color pickers (sin tocar fuentes/tamaños).
 */
function applyThemePreset(name) {
  if (name === 'custom') return;
  const preset = THEME_PRESETS[name];
  if (!preset) return;
  els.cfgCard.value = preset.card;
  els.cfgText.value = preset.text;
  els.cfgAccent.value = preset.accent;
  els.cfgHeaderBg.value = preset.headerBg;
}

/**
 * Vuelve a renderizar la previsualización con el estado y config actuales.
 */
function refreshPreview() {
  if (currentRows.length === 0) {
    els.previewStage.innerHTML = '';
    els.previewStage.appendChild(els.emptyState);
    els.dimHint.textContent = '—';
    els.btnDownloadPng.disabled = true;
    return;
  }

  const config = readConfig();
  const card = renderScheduleCard(els.previewStage, currentRows, config);
  els.btnDownloadPng.disabled = false;

  // Mostrar dimensiones aproximadas tras el render
  requestAnimationFrame(() => {
    const rect = card.getBoundingClientRect();
    els.dimHint.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px (aprox.)`;
  });
}

/**
 * Actualiza las etiquetas de salida (output) de los sliders.
 */
function syncOutputLabels() {
  els.outFontSize.textContent = els.cfgFontSize.value + 'px';
  els.outRadius.textContent = els.cfgRadius.value + 'px';
  els.outPadding.textContent = els.cfgPadding.value + 'px';
  els.outBorder.textContent = els.cfgBorder.value + 'px';
}

/**
 * Procesa el texto de entrada: parsea, calcula y actualiza markdown + preview.
 */
function processInputText() {
  const text = els.rawInput.value.trim();
  if (!text) {
    els.parseStatus.textContent = 'Pega una tabla antes de procesar.';
    els.parseStatus.className = 'status error';
    return;
  }

  try {
    const { rows, markdown } = processInput(text);
    currentRows = rows;
    els.markdownOutput.value = markdown;
    els.btnCopyMd.disabled = false;

    els.parseStatus.textContent = `Procesado correctamente: ${rows.length} día(s) detectados.`;
    els.parseStatus.className = 'status ok';

    refreshPreview();
  } catch (err) {
    els.parseStatus.textContent = err.message || 'Error al procesar la tabla.';
    els.parseStatus.className = 'status error';
    currentRows = [];
    els.markdownOutput.value = '';
    els.btnCopyMd.disabled = true;
    refreshPreview();
  }
}

/**
 * Exporta la tarjeta actual como imagen PNG.
 */
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

/**
 * Copia el markdown al portapapeles.
 */
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

/* ---- Listeners ---- */

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
  els.markdownOutput.value = '';
  els.btnCopyMd.disabled = true;
  els.btnDownloadPng.disabled = true;
  els.parseStatus.textContent = '';
  els.parseStatus.className = 'status';
  refreshPreview();
});

els.btnCopyMd.addEventListener('click', copyMarkdown);
els.btnDownloadPng.addEventListener('click', downloadPng);

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
  const eventName = (el.type === 'range' || el.tagName === 'SELECT' || el.type === 'color' || el.type === 'checkbox')
    ? 'input'
    : 'input';
  el.addEventListener(eventName, () => {
    syncOutputLabels();
    // Si el usuario cambia manualmente un color, pasar el tema a "personalizado"
    if (['cfgCard', 'cfgText', 'cfgAccent', 'cfgHeaderBg'].includes(el.id)) {
      els.cfgTheme.value = 'custom';
    }
    refreshPreview();
  });
});

// Inicialización
syncOutputLabels();

});