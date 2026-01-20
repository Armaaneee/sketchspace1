const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');

let drawing = false;
let lastX = 0;
let lastY = 0;
let isEraser = false;
let penColor = '#000000';
let penThickness = 5;
let eraserThickness = 20;
let textSize = 24;
let strokes = [];
let redoStack = [];
let currentTool = 'pen';
let shapeStartX = 0;
let shapeStartY = 0;
let isDrawingShape = false;
let tempCanvas = null;
let scale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let spacePressed = false;
let currentStrokeGroupId = null;

let layers = [];
let currentLayerId = null;
let pages = [];
let currentPageIndex = 0;
let layerCanvases = {};

let isSelecting = false;
let selectionStartX = 0;
let selectionStartY = 0;
let selectionEndX = 0;
let selectionEndY = 0;
let selectedStrokeIds = new Set();
let selectionClipboard = null;
let pasteCount = 0;

let isDraggingSelection = false;
let dragLastX = 0;
let dragLastY = 0;
let dragOriginals = new Map();

const penButton = document.getElementById('pen-button');
const selectButton = document.getElementById('select-button');
const panButton = document.getElementById('pan-button');
const eraserButton = document.getElementById('eraser-button');
const textButton = document.getElementById('text-button');
const fillButton = document.getElementById('fill-button');
const shapesButton = document.getElementById('shapes-button');
const shapesPopup = document.getElementById('shapes-popup');
const shapeLineButton = document.getElementById('shape-line');
const shapeRectangleButton = document.getElementById('shape-rectangle');
const shapeCircleButton = document.getElementById('shape-circle');
const shapeArrowButton = document.getElementById('shape-arrow');
const colorPicker = document.getElementById('color-picker');
const thicknessSlider = document.getElementById('thickness-slider');
const thicknessValue = document.getElementById('thickness-value');
const thicknessDot = document.getElementById('thickness-dot');
const thicknessPreview = document.querySelector('.thickness-preview');
const thicknessPopup = document.querySelector('.thickness-popup');
const eraserThicknessSlider = document.getElementById('eraser-thickness-slider');
const eraserThicknessValue = document.getElementById('eraser-thickness-value');
const eraserThicknessDot = document.getElementById('eraser-thickness-dot');
const eraserThicknessPreview = document.querySelector('.eraser-thickness-preview');
const eraserThicknessPopup = document.querySelector('.eraser-thickness-popup');
const textSizeSlider = document.getElementById('text-size-slider');
const textSizeValue = document.getElementById('text-size-value');
const textSizePreview = document.querySelector('.text-size-preview');
const textSizePopup = document.querySelector('.text-size-popup');
const textInputOverlay = document.getElementById('text-input-overlay');
const textInput = document.getElementById('text-input');
const clearButton = document.getElementById('clear-button');
const undoButton = document.getElementById('undo-button');
const redoButton = document.getElementById('redo-button');
const exportButton = document.getElementById('export-button');
const infoButton = document.getElementById('info-button');
const infoModal = document.getElementById('info-modal');
const closeButton = document.querySelector('.close-button');

const layersButton = document.getElementById('layers-button');
const layersPopup = document.getElementById('layers-popup');
const layersList = document.getElementById('layers-list');
const addLayerButton = document.getElementById('add-layer-button');

const pagesButton = document.getElementById('pages-button');
const pagesPopup = document.getElementById('pages-popup');
const pagesList = document.getElementById('pages-list');
const addPageButton = document.getElementById('add-page-button');

const zoomValue = document.getElementById('zoom-value');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');

const ZOOM_STEP = 0.1;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateZoomUI() {
  if (!zoomValue) return;
  zoomValue.textContent = (Math.round(scale * 10) * 10) + '%';
}

function zoomTo(newScale, anchorX, anchorY) {
  const snapped = Math.round(newScale / ZOOM_STEP) * ZOOM_STEP;
  const clamped = clamp(snapped, 0.1, 5);
  const worldX = (anchorX - panX) / scale;
  const worldY = (anchorY - panY) / scale;

  scale = clamped;
  panX = anchorX - worldX * scale;
  panY = anchorY - worldY * scale;

  applyTransform();
  updateZoomUI();
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function ensureStrokeId(stroke) {
  if (!stroke.id) stroke.id = generateId('stroke');
  return stroke.id;
}

function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function normalizeRect(x1, y1, x2, y2) {
  return {
    minX: Math.min(x1, x2),
    minY: Math.min(y1, y2),
    maxX: Math.max(x1, x2),
    maxY: Math.max(y1, y2)
  };
}

function rectIntersects(a, b) {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

function rectContainsPoint(rect, x, y) {
  return x >= rect.minX && x <= rect.maxX && y >= rect.minY && y <= rect.maxY;
}

function expandRect(rect, padding) {
  return {
    minX: rect.minX - padding,
    minY: rect.minY - padding,
    maxX: rect.maxX + padding,
    maxY: rect.maxY + padding
  };
}

function getStrokeBounds(stroke) {
  if (!stroke || stroke.type === 'fill') return null;

  if (stroke.type === 'moveAction') return null;

  if (stroke.type === 'deleteAction') return null;

  if (stroke.type === 'line' || stroke.type === 'rectangle' || stroke.type === 'circle' || stroke.type === 'arrow') {
    if (stroke.type === 'circle') {
      const r = Math.sqrt(Math.pow(stroke.endX - stroke.startX, 2) + Math.pow(stroke.endY - stroke.startY, 2));
      const circleRect = {
        minX: stroke.startX - r,
        minY: stroke.startY - r,
        maxX: stroke.startX + r,
        maxY: stroke.startY + r
      };
      return expandRect(circleRect, Math.max(2, (stroke.thickness || 3) / 2));
    }

    const base = normalizeRect(stroke.startX, stroke.startY, stroke.endX, stroke.endY);
    return expandRect(base, Math.max(2, (stroke.thickness || 3) / 2));
  }

  if (stroke.type === 'text') {
    ctx.save();
    ctx.font = `${stroke.size || 24}px Arial`;
    const width = ctx.measureText(stroke.text || '').width || 0;
    ctx.restore();

    const size = stroke.size || 24;
    const rect = {
      minX: stroke.x,
      minY: stroke.y - size,
      maxX: stroke.x + width,
      maxY: stroke.y
    };
    return expandRect(rect, 2);
  }

  if (stroke.type === 'fillRegion') {
    if (typeof stroke.x !== 'number' || typeof stroke.y !== 'number' || typeof stroke.w !== 'number' || typeof stroke.h !== 'number') return null;
    return expandRect({
      minX: stroke.x,
      minY: stroke.y,
      maxX: stroke.x + stroke.w,
      maxY: stroke.y + stroke.h
    }, 1 / Math.max(0.001, scale));
  }

  if (
    typeof stroke.x === 'number' &&
    typeof stroke.y === 'number' &&
    typeof stroke.lastX === 'number' &&
    typeof stroke.lastY === 'number'
  ) {
    const base = normalizeRect(stroke.x, stroke.y, stroke.lastX, stroke.lastY);
    return expandRect(base, Math.max(2, (stroke.thickness || 3) / 2));
  }

  return null;
}

function getSelectionBounds() {
  const selected = strokes.filter(s => selectedStrokeIds.has(s.id));
  let bounds = null;
  for (const s of selected) {
    const b = getStrokeBounds(s);
    if (!b) continue;
    if (!bounds) {
      bounds = { ...b };
    } else {
      bounds.minX = Math.min(bounds.minX, b.minX);
      bounds.minY = Math.min(bounds.minY, b.minY);
      bounds.maxX = Math.max(bounds.maxX, b.maxX);
      bounds.maxY = Math.max(bounds.maxY, b.maxY);
    }
  }
  return bounds;
}

function drawSelectionOverlay() {
  const hasMarquee = isSelecting;
  const hasSelection = selectedStrokeIds.size > 0;
  if (!hasMarquee && !hasSelection) return;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#4d90fe';
  ctx.lineWidth = 1 / Math.max(0.001, scale);

  if (hasSelection) {
    const b = getSelectionBounds();
    if (b) {
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
      ctx.setLineDash([]);
    }
  }

  if (hasMarquee) {
    const r = normalizeRect(selectionStartX, selectionStartY, selectionEndX, selectionEndY);
    ctx.setLineDash([4 / scale, 3 / scale]);
    ctx.strokeRect(r.minX, r.minY, r.maxX - r.minX, r.maxY - r.minY);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function copySelectionToClipboard() {
  const selected = strokes
    .filter(s => selectedStrokeIds.has(s.id))
    .filter(s => s.type !== 'fill' && s.type !== 'moveAction' && s.type !== 'deleteAction');

  if (!selected.length) {
    selectionClipboard = null;
    pasteCount = 0;
    return;
  }

  selectionClipboard = {
    strokes: selected.map(s => deepClone(s)),
    bounds: getSelectionBounds()
  };
  pasteCount = 0;
}

function translateStroke(stroke, dx, dy) {
  if (!stroke) return;

  if (stroke.type === 'fillRegion') {
    stroke.x += dx;
    stroke.y += dy;
    return;
  }

  if (stroke.type === 'line' || stroke.type === 'rectangle' || stroke.type === 'circle' || stroke.type === 'arrow') {
    stroke.startX += dx;
    stroke.startY += dy;
    stroke.endX += dx;
    stroke.endY += dy;
    return;
  }

  if (stroke.type === 'text') {
    stroke.x += dx;
    stroke.y += dy;
    return;
  }

  if (typeof stroke.x === 'number') stroke.x += dx;
  if (typeof stroke.y === 'number') stroke.y += dy;
  if (typeof stroke.lastX === 'number') stroke.lastX += dx;
  if (typeof stroke.lastY === 'number') stroke.lastY += dy;
}

function pasteSelectionFromClipboard() {
  if (!selectionClipboard || !selectionClipboard.strokes || !selectionClipboard.strokes.length) return;

  pasteCount += 1;
  const offset = 20 * pasteCount;

  const validLayerIds = new Set(layers.map(l => l.id));
  const pasted = selectionClipboard.strokes.map(s => {
    const clone = deepClone(s);
    clone.id = generateId('stroke');
    if (!clone.layerId || !validLayerIds.has(clone.layerId)) clone.layerId = currentLayerId;
    translateStroke(clone, offset, offset);
    return clone;
  });

  strokes.push(...pasted);
  redoStack = [];
  selectedStrokeIds = new Set(pasted.map(s => s.id));

  setActiveTool('select');
  rebuildAllLayers();
  redrawCanvas();
  saveToStorage();
}

function deleteSelectedStrokes() {
  if (!selectedStrokeIds.size) return;

  const selectedIds = new Set(selectedStrokeIds);
  const removed = [];

  for (let i = 0; i < strokes.length; i++) {
    const s = strokes[i];
    if (!s || !s.id) continue;
    if (s.type === 'moveAction' || s.type === 'deleteAction') continue;
    if (selectedIds.has(s.id)) {
      removed.push({ index: i, stroke: deepClone(s) });
    }
  }

  if (!removed.length) {
    selectedStrokeIds.clear();
    redrawCanvas();
    return;
  }

  strokes = strokes.filter(s => !s || !s.id || !selectedIds.has(s.id));

  strokes.push({
    id: generateId('delete'),
    type: 'deleteAction',
    removed
  });

  redoStack = [];
  selectedStrokeIds.clear();
  isSelecting = false;
  isDraggingSelection = false;
  dragOriginals.clear();

  saveToStorage();
  rebuildAllLayers();
  redrawCanvas();
}

function applyDeleteAction(action) {
  if (!action || action.type !== 'deleteAction' || !Array.isArray(action.removed)) return;
  const ids = new Set(action.removed.map(r => r && r.stroke && r.stroke.id).filter(Boolean));
  if (!ids.size) return;
  strokes = strokes.filter(s => !s || !s.id || !ids.has(s.id));
}

function revertDeleteAction(action) {
  if (!action || action.type !== 'deleteAction' || !Array.isArray(action.removed)) return;

  const sorted = action.removed
    .filter(r => r && r.stroke)
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  for (const item of sorted) {
    const idx = Math.max(0, Math.min(strokes.length, item.index ?? strokes.length));
    const restored = deepClone(item.stroke);
    ensureStrokeId(restored);
    strokes.splice(idx, 0, restored);
  }
}

function getStrokeById(id) {
  return strokes.find(s => s && s.id === id);
}

function restoreStrokeState(target, snapshot) {
  if (!target || !snapshot) return;
  Object.keys(target).forEach(k => {
    delete target[k];
  });
  Object.assign(target, deepClone(snapshot));
}

function hideAllPopups() {
  thicknessPopup.classList.remove('show');
  eraserThicknessPopup.classList.remove('show');
  textSizePopup.classList.remove('show');
  shapesPopup.classList.remove('show');
  layersPopup.classList.remove('show');
  pagesPopup.classList.remove('show');
}

function positionPopup(triggerEl, popupEl) {
  if (!popupEl.classList.contains('show')) return;

  const triggerRect = triggerEl.getBoundingClientRect();
  const popupRect = popupEl.getBoundingClientRect();
  const padding = 12;
  const gap = 10;

  let left = triggerRect.right + gap;
  if (left + popupRect.width > window.innerWidth - padding) {
    left = triggerRect.left - popupRect.width - gap;
  }
  left = clamp(left, padding, window.innerWidth - popupRect.width - padding);

  const top = clamp(
    triggerRect.top + triggerRect.height / 2 - popupRect.height / 2,
    padding,
    window.innerHeight - popupRect.height - padding
  );

  popupEl.style.left = left + 'px';
  popupEl.style.top = top + 'px';
}

function togglePopup(triggerEl, popupEl) {
  const willShow = !popupEl.classList.contains('show');
  hideAllPopups();
  if (!willShow) return;
  popupEl.classList.add('show');
  requestAnimationFrame(() => positionPopup(triggerEl, popupEl));
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  if (canvas.width === w && canvas.height === h) {
    return;
  }

  canvas.width = w;
  canvas.height = h;
  layerCanvases = {};
  if (layers.length) {
    rebuildAllLayers();
  }
  applyTransform();
}

function requestCanvasResize() {
  requestAnimationFrame(resizeCanvas);
}

requestCanvasResize();
requestAnimationFrame(requestCanvasResize);
window.addEventListener('resize', requestCanvasResize);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', requestCanvasResize);
}

function updateThicknessDot(size) {
  const scaledSize = Math.max(4, Math.min(size * 0.8, 18));
  thicknessDot.style.width = scaledSize + 'px';
  thicknessDot.style.height = scaledSize + 'px';
}

function updateEraserThicknessDot(size) {
  const scaledSize = Math.max(4, Math.min(size * 0.6, 20));
  eraserThicknessDot.style.width = scaledSize + 'px';
  eraserThicknessDot.style.height = scaledSize + 'px';
}

updateThicknessDot(penThickness);
updateEraserThicknessDot(eraserThickness);

function createLayer(name) {
  return {
    id: 'layer-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    name: name,
    visible: true
  };
}

function createPage(name) {
  const firstLayer = createLayer('Layer 1');
  return {
    id: 'page-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    name: name,
    strokes: [],
    redoStack: [],
    layers: [firstLayer],
    currentLayerId: firstLayer.id,
    scale: 1,
    panX: 0,
    panY: 0
  };
}

function getCurrentPage() {
  return pages[currentPageIndex];
}

function saveCurrentPageState() {
  if (!pages.length) return;
  const page = getCurrentPage();
  page.strokes = strokes;
  page.redoStack = redoStack;
  page.layers = layers;
  page.currentLayerId = currentLayerId;
  page.scale = scale;
  page.panX = panX;
  page.panY = panY;
}

function loadPageState(index) {
  saveCurrentPageState();
  currentPageIndex = index;
  const page = getCurrentPage();
  strokes = page.strokes;
  redoStack = page.redoStack;
  layers = page.layers;
  currentLayerId = page.currentLayerId;
  scale = page.scale;
  panX = page.panX;
  panY = page.panY;

  layerCanvases = {};
  isSelecting = false;
  selectedStrokeIds.clear();
  rebuildAllLayers();
  redrawCanvas();
  renderLayers();
  renderPages();
}

function getLayerCanvas(layerId) {
  if (!layerCanvases[layerId]) {
    layerCanvases[layerId] = document.createElement('canvas');
  }
  const layerCanvas = layerCanvases[layerId];
  if (layerCanvas.width !== canvas.width || layerCanvas.height !== canvas.height) {
    layerCanvas.width = canvas.width;
    layerCanvas.height = canvas.height;
  }
  return layerCanvas;
}

function getLayerContext(layerId) {
  return getLayerCanvas(layerId).getContext('2d');
}

function rebuildAllLayers() {
  layers.forEach(layer => {
    const lctx = getLayerContext(layer.id);
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  strokes.forEach(stroke => {
    if (!stroke || stroke.type === 'moveAction' || stroke.type === 'deleteAction') return;
    if (!stroke.layerId) {
      stroke.layerId = currentLayerId;
    }
    const layerExists = layers.some(l => l.id === stroke.layerId);
    if (!layerExists && layers.length) {
      stroke.layerId = layers[0].id;
    }
    applyStrokeToLayer(stroke);
  });
}

function applyFloodFill(context, startX, startY, fillColor) {
  const w = context.canvas.width;
  const h = context.canvas.height;
  if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

  const imageData = context.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  const startPos = (startY * w + startX) * 4;
  const targetR = pixels[startPos];
  const targetG = pixels[startPos + 1];
  const targetB = pixels[startPos + 2];
  const targetA = pixels[startPos + 3];

  const fillR = parseInt(fillColor.slice(1, 3), 16);
  const fillG = parseInt(fillColor.slice(3, 5), 16);
  const fillB = parseInt(fillColor.slice(5, 7), 16);

  const tolerance = 10;

  const matchesTarget = (pos) => {
    const a = pixels[pos + 3];
    if (targetA === 0) {
      return a === 0;
    }
    if (Math.abs(a - targetA) > tolerance) return false;
    if (Math.abs(pixels[pos] - targetR) > tolerance) return false;
    if (Math.abs(pixels[pos + 1] - targetG) > tolerance) return false;
    if (Math.abs(pixels[pos + 2] - targetB) > tolerance) return false;
    return true;
  };

  if (
    targetA === 255 &&
    Math.abs(targetR - fillR) <= tolerance &&
    Math.abs(targetG - fillG) <= tolerance &&
    Math.abs(targetB - fillB) <= tolerance
  ) {
    return;
  }

  const setFill = (pos) => {
    pixels[pos] = fillR;
    pixels[pos + 1] = fillG;
    pixels[pos + 2] = fillB;
    pixels[pos + 3] = 255;
  };

  const stack = [[startX, startY]];

  const pushSpans = (y, x1, x2) => {
    let x = x1;
    while (x <= x2) {
      const pos = (y * w + x) * 4;
      if (matchesTarget(pos)) {
        stack.push([x, y]);
        x += 1;
        while (x <= x2 && matchesTarget((y * w + x) * 4)) {
          x += 1;
        }
      }
      x += 1;
    }
  };

  while (stack.length) {
    const [x0, y0] = stack.pop();
    if (x0 < 0 || x0 >= w || y0 < 0 || y0 >= h) continue;

    let left = x0;
    while (left >= 0 && matchesTarget((y0 * w + left) * 4)) {
      left -= 1;
    }
    left += 1;

    let right = x0;
    while (right < w && matchesTarget((y0 * w + right) * 4)) {
      right += 1;
    }
    right -= 1;

    for (let x = left; x <= right; x++) {
      setFill((y0 * w + x) * 4);
    }

    if (y0 > 0) pushSpans(y0 - 1, left, right);
    if (y0 < h - 1) pushSpans(y0 + 1, left, right);
  }

  context.putImageData(imageData, 0, 0);
}

function applyFloodFillRegion(context, startX, startY, fillColor) {
  const w = context.canvas.width;
  const h = context.canvas.height;
  if (startX < 0 || startX >= w || startY < 0 || startY >= h) return null;

  const imageData = context.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  const startPos = (startY * w + startX) * 4;
  const targetR = pixels[startPos];
  const targetG = pixels[startPos + 1];
  const targetB = pixels[startPos + 2];
  const targetA = pixels[startPos + 3];

  const fillR = parseInt(fillColor.slice(1, 3), 16);
  const fillG = parseInt(fillColor.slice(3, 5), 16);
  const fillB = parseInt(fillColor.slice(5, 7), 16);

  const tolerance = 10;

  const matchesTarget = (pos) => {
    const a = pixels[pos + 3];
    if (targetA === 0) {
      return a === 0;
    }
    if (Math.abs(a - targetA) > tolerance) return false;
    if (Math.abs(pixels[pos] - targetR) > tolerance) return false;
    if (Math.abs(pixels[pos + 1] - targetG) > tolerance) return false;
    if (Math.abs(pixels[pos + 2] - targetB) > tolerance) return false;
    return true;
  };

  if (
    targetA === 255 &&
    Math.abs(targetR - fillR) <= tolerance &&
    Math.abs(targetG - fillG) <= tolerance &&
    Math.abs(targetB - fillB) <= tolerance
  ) {
    return null;
  }

  const setFill = (pos) => {
    pixels[pos] = fillR;
    pixels[pos + 1] = fillG;
    pixels[pos + 2] = fillB;
    pixels[pos + 3] = 255;
  };

  const stack = [[startX, startY]];
  const spans = [];
  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;

  const pushSpans = (y, x1, x2) => {
    let x = x1;
    while (x <= x2) {
      const pos = (y * w + x) * 4;
      if (matchesTarget(pos)) {
        stack.push([x, y]);
        x += 1;
        while (x <= x2 && matchesTarget((y * w + x) * 4)) {
          x += 1;
        }
      }
      x += 1;
    }
  };

  while (stack.length) {
    const [x0, y0] = stack.pop();
    if (x0 < 0 || x0 >= w || y0 < 0 || y0 >= h) continue;

    let left = x0;
    while (left >= 0 && matchesTarget((y0 * w + left) * 4)) {
      left -= 1;
    }
    left += 1;

    let right = x0;
    while (right < w && matchesTarget((y0 * w + right) * 4)) {
      right += 1;
    }
    right -= 1;

    for (let x = left; x <= right; x++) {
      setFill((y0 * w + x) * 4);
    }

    spans.push([y0, left, right]);
    minX = Math.min(minX, left);
    maxX = Math.max(maxX, right);
    minY = Math.min(minY, y0);
    maxY = Math.max(maxY, y0);

    if (y0 > 0) pushSpans(y0 - 1, left, right);
    if (y0 < h - 1) pushSpans(y0 + 1, left, right);
  }

  if (!spans.length) return null;

  context.putImageData(imageData, 0, 0);

  return {
    minX,
    minY,
    maxX,
    maxY,
    spans,
    targetA
  };
}

function applyStrokeToLayer(stroke) {
  if (!stroke || stroke.type === 'moveAction' || stroke.type === 'deleteAction') return;
  const layerId = stroke.layerId || currentLayerId;
  const lctx = getLayerContext(layerId);

  if (stroke.type === 'fill') {
    const screenX = Math.round(stroke.x * scale + panX);
    const screenY = Math.round(stroke.y * scale + panY);
    lctx.setTransform(1, 0, 0, 1, 0, 0);

    const allowTransparent = stroke.allowTransparent === true;
    const sample = lctx.getImageData(screenX, screenY, 1, 1).data;
    if (!allowTransparent && sample[3] === 0) return;

    applyFloodFill(lctx, screenX, screenY, stroke.color);
    return;
  }

  if (stroke.type === 'fillRegion') {
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = stroke.color;

    const screenX = Math.round(stroke.x * scale + panX);
    const screenY = Math.round(stroke.y * scale + panY);
    const screenW = Math.max(1, Math.round(stroke.w * scale));
    const screenH = Math.max(1, Math.round(stroke.h * scale));

    const pw = Math.max(1, stroke.pw || 1);
    const ph = Math.max(1, stroke.ph || 1);
    const sx = screenW / pw;
    const sy = screenH / ph;

    const spans = Array.isArray(stroke.spans) ? stroke.spans : [];
    for (let i = 0; i + 2 < spans.length; i += 3) {
      const y0 = spans[i];
      const x1 = spans[i + 1];
      const x2 = spans[i + 2];

      const dstY = screenY + Math.floor(y0 * sy);
      const dstY2 = screenY + Math.floor((y0 + 1) * sy);
      const dstH = Math.max(1, dstY2 - dstY);

      const dstX1 = screenX + Math.floor(x1 * sx);
      const dstX2 = screenX + Math.ceil((x2 + 1) * sx) - 1;
      const dstW = dstX2 - dstX1 + 1;
      if (dstW <= 0 || dstH <= 0) continue;

      const drawX = clamp(dstX1, 0, lctx.canvas.width);
      const drawY = clamp(dstY, 0, lctx.canvas.height);

      const skipX = drawX - dstX1;
      const skipY = drawY - dstY;

      const maxW = lctx.canvas.width - drawX;
      const maxH = lctx.canvas.height - drawY;
      const drawW = Math.min(dstW - skipX, maxW);
      const drawH = Math.min(dstH - skipY, maxH);
      if (drawW <= 0 || drawH <= 0) continue;

      lctx.fillRect(drawX, drawY, drawW, drawH);
    }
    return;
  }

  lctx.setTransform(scale, 0, 0, scale, panX, panY);

  if (stroke.type === 'line') {
    lctx.globalCompositeOperation = 'source-over';
    lctx.strokeStyle = stroke.color;
    lctx.lineWidth = Math.max(3, stroke.thickness);
    lctx.lineCap = 'round';
    lctx.lineJoin = 'round';
    drawLine(stroke.startX, stroke.startY, stroke.endX, stroke.endY, lctx);
  } else if (stroke.type === 'rectangle') {
    lctx.globalCompositeOperation = 'source-over';
    lctx.strokeStyle = stroke.color;
    lctx.lineWidth = Math.max(3, stroke.thickness);
    lctx.lineCap = 'round';
    lctx.lineJoin = 'round';
    drawRectangle(stroke.startX, stroke.startY, stroke.endX, stroke.endY, lctx);
  } else if (stroke.type === 'circle') {
    lctx.globalCompositeOperation = 'source-over';
    lctx.strokeStyle = stroke.color;
    lctx.lineWidth = Math.max(3, stroke.thickness);
    lctx.lineCap = 'round';
    lctx.lineJoin = 'round';
    drawCircle(stroke.startX, stroke.startY, stroke.endX, stroke.endY, lctx);
  } else if (stroke.type === 'arrow') {
    lctx.globalCompositeOperation = 'source-over';
    lctx.strokeStyle = stroke.color;
    lctx.lineWidth = Math.max(3, stroke.thickness);
    lctx.lineCap = 'round';
    lctx.lineJoin = 'round';
    drawArrow(stroke.startX, stroke.startY, stroke.endX, stroke.endY, lctx);
  } else if (stroke.type === 'text') {
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = stroke.color;
    lctx.font = `${stroke.size}px Arial`;
    lctx.fillText(stroke.text, stroke.x, stroke.y);
  } else {
    lctx.lineWidth = stroke.thickness;
    lctx.lineCap = 'round';
    
    if (stroke.isEraser) {
      lctx.globalCompositeOperation = 'destination-out';
    } else {
      lctx.globalCompositeOperation = 'source-over';
      lctx.strokeStyle = stroke.color;
    }
    
    lctx.beginPath();
    lctx.moveTo(stroke.lastX, stroke.lastY);
    lctx.lineTo(stroke.x, stroke.y);
    lctx.stroke();
  }
}

function renderLayers() {
  if (!layersList) return;
  layersList.innerHTML = '';

  layers.forEach((layer, index) => {
    const row = document.createElement('div');
    row.className = 'popup-row' + (layer.id === currentLayerId ? ' active' : '');
    row.addEventListener('click', () => {
      currentLayerId = layer.id;
      renderLayers();
    });

    const left = document.createElement('div');
    left.className = 'popup-row-left';

    const title = document.createElement('div');
    title.className = 'popup-row-title';
    title.textContent = layer.name;
    left.appendChild(title);

    const right = document.createElement('div');
    right.className = 'popup-row-right';

    const vis = document.createElement('button');
    vis.className = 'mini-btn';
    vis.title = layer.visible ? 'Hide' : 'Show';
    const eyeOpen = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.25 12s3.5-7.5 9.75-7.5S21.75 12 21.75 12 18.25 19.5 12 19.5 2.25 12 2.25 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const eyeOff = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M2.25 12s3.5-7.5 9.75-7.5c2.1 0 3.9.6 5.35 1.45" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21.75 12S18.25 19.5 12 19.5c-2.1 0-3.9-.6-5.35-1.45" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.2 10.2A3 3 0 0 0 13.8 13.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    vis.innerHTML = layer.visible ? eyeOpen : eyeOff;
    vis.addEventListener('click', (e) => {
      e.stopPropagation();
      layer.visible = !layer.visible;
      vis.innerHTML = layer.visible ? eyeOpen : eyeOff;
      redrawCanvas();
      renderLayers();
      saveToStorage();
    });

    const up = document.createElement('button');
    up.className = 'mini-btn';
    up.textContent = '↑';
    up.title = 'Move Up';
    up.disabled = index === 0;
    up.addEventListener('click', (e) => {
      e.stopPropagation();
      if (index === 0) return;
      const tmp = layers[index - 1];
      layers[index - 1] = layers[index];
      layers[index] = tmp;
      redrawCanvas();
      renderLayers();
      saveToStorage();
    });

    const down = document.createElement('button');
    down.className = 'mini-btn';
    down.textContent = '↓';
    down.title = 'Move Down';
    down.disabled = index === layers.length - 1;
    down.addEventListener('click', (e) => {
      e.stopPropagation();
      if (index === layers.length - 1) return;
      const tmp = layers[index + 1];
      layers[index + 1] = layers[index];
      layers[index] = tmp;
      redrawCanvas();
      renderLayers();
      saveToStorage();
    });

    const del = document.createElement('button');
    del.className = 'mini-btn';
    del.textContent = '×';
    del.title = 'Delete';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm('Delete this layer?')) return;
      const layerId = layer.id;
      layers = layers.filter(l => l.id !== layerId);
      strokes = strokes.filter(s => s.layerId !== layerId);
      delete layerCanvases[layerId];
      if (!layers.length) {
        const newLayer = createLayer('Layer 1');
        layers = [newLayer];
        currentLayerId = newLayer.id;
      } else if (currentLayerId === layerId) {
        currentLayerId = layers[0].id;
      }
      rebuildAllLayers();
      redrawCanvas();
      renderLayers();
      saveToStorage();
    });

    right.appendChild(vis);
    right.appendChild(up);
    right.appendChild(down);
    right.appendChild(del);

    row.appendChild(left);
    row.appendChild(right);
    layersList.appendChild(row);
  });
}

function renderPages() {
  if (!pagesList) return;
  pagesList.innerHTML = '';

  pages.forEach((page, index) => {
    const row = document.createElement('div');
    row.className = 'popup-row' + (index === currentPageIndex ? ' active' : '');
    row.addEventListener('click', () => {
      if (index === currentPageIndex) return;
      loadPageState(index);
      pagesPopup.classList.remove('show');
    });

    const left = document.createElement('div');
    left.className = 'popup-row-left';

    const title = document.createElement('div');
    title.className = 'popup-row-title';
    title.textContent = page.name;
    left.appendChild(title);

    const right = document.createElement('div');
    right.className = 'popup-row-right';

    const del = document.createElement('button');
    del.className = 'mini-btn';
    del.textContent = '×';
    del.title = 'Delete';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm('Delete this canvas?')) return;
      pages.splice(index, 1);
      if (currentPageIndex >= pages.length) {
        currentPageIndex = Math.max(0, pages.length - 1);
      }
      if (!pages.length) {
        pages = [createPage('Canvas 1')];
        currentPageIndex = 0;
      }
      loadPageState(currentPageIndex);
      saveToStorage();
    });

    right.appendChild(del);
    row.appendChild(left);
    row.appendChild(right);
    pagesList.appendChild(row);
  });
}

function setActiveTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
  
  if (tool === 'select') {
    if (selectButton) selectButton.classList.add('active');
    isEraser = false;
    canvas.style.cursor = 'default';
  } else if (tool === 'pan') {
    if (panButton) panButton.classList.add('active');
    isEraser = false;
    canvas.style.cursor = 'grab';
  } else if (tool === 'pen') {
    penButton.classList.add('active');
    isEraser = false;
    canvas.style.cursor = 'crosshair';
  } else if (tool === 'eraser') {
    eraserButton.classList.add('active');
    isEraser = true;
    canvas.style.cursor = 'crosshair';
  } else if (tool === 'text') {
    textButton.classList.add('active');
    isEraser = false;
    canvas.style.cursor = 'text';
  } else if (tool === 'fill') {
    fillButton.classList.add('active');
    isEraser = false;
    canvas.style.cursor = 'crosshair';
  } else if (tool === 'line' || tool === 'rectangle' || tool === 'circle' || tool === 'arrow') {
    shapesButton.classList.add('active');
    isEraser = false;
    canvas.style.cursor = 'crosshair';
  }

  if (tool !== 'select') {
    isSelecting = false;
    selectedStrokeIds.clear();
    isDraggingSelection = false;
    dragOriginals.clear();
  }
}

if (selectButton) selectButton.addEventListener('click', () => setActiveTool('select'));
if (panButton) panButton.addEventListener('click', () => setActiveTool('pan'));
penButton.addEventListener('click', () => setActiveTool('pen'));
eraserButton.addEventListener('click', () => setActiveTool('eraser'));
textButton.addEventListener('click', () => setActiveTool('text'));
fillButton.addEventListener('click', () => setActiveTool('fill'));

shapesButton.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePopup(shapesButton, shapesPopup);
});

shapeLineButton.addEventListener('click', (e) => {
  e.stopPropagation();
  setActiveTool('line');
  shapesPopup.classList.remove('show');
});

shapeRectangleButton.addEventListener('click', (e) => {
  e.stopPropagation();
  setActiveTool('rectangle');
  shapesPopup.classList.remove('show');
});

shapeCircleButton.addEventListener('click', (e) => {
  e.stopPropagation();
  setActiveTool('circle');
  shapesPopup.classList.remove('show');
});

shapeArrowButton.addEventListener('click', (e) => {
  e.stopPropagation();
  setActiveTool('arrow');
  shapesPopup.classList.remove('show');
});

colorPicker.addEventListener('input', (e) => {
  penColor = e.target.value;
});

thicknessSlider.addEventListener('input', (e) => {
  penThickness = parseInt(e.target.value);
  thicknessValue.textContent = penThickness + 'px';
  updateThicknessDot(penThickness);
});

eraserThicknessSlider.addEventListener('input', (e) => {
  eraserThickness = parseInt(e.target.value);
  eraserThicknessValue.textContent = eraserThickness + 'px';
  updateEraserThicknessDot(eraserThickness);
});

textSizeSlider.addEventListener('input', (e) => {
  textSize = parseInt(e.target.value);
  textSizeValue.textContent = textSize + 'px';
});

thicknessPreview.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePopup(thicknessPreview, thicknessPopup);
});

eraserThicknessPreview.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePopup(eraserThicknessPreview, eraserThicknessPopup);
});

textSizePreview.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePopup(textSizePreview, textSizePopup);
});

layersButton.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePopup(layersButton, layersPopup);
  renderLayers();
});

pagesButton.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePopup(pagesButton, pagesPopup);
  renderPages();
});

thicknessPopup.addEventListener('click', (e) => {
  e.stopPropagation();
});

eraserThicknessPopup.addEventListener('click', (e) => {
  e.stopPropagation();
});

textSizePopup.addEventListener('click', (e) => {
  e.stopPropagation();
});

shapesPopup.addEventListener('click', (e) => {
  e.stopPropagation();
});

layersPopup.addEventListener('click', (e) => {
  e.stopPropagation();
});

pagesPopup.addEventListener('click', (e) => {
  e.stopPropagation();
});

document.addEventListener('click', () => {
  hideAllPopups();
});

window.addEventListener('resize', () => {
  positionPopup(thicknessPreview, thicknessPopup);
  positionPopup(eraserThicknessPreview, eraserThicknessPopup);
  positionPopup(textSizePreview, textSizePopup);
  positionPopup(shapesButton, shapesPopup);
  positionPopup(layersButton, layersPopup);
  positionPopup(pagesButton, pagesPopup);
});

const sidebarScroll = document.getElementById('sidebar-scroll');
if (sidebarScroll) {
  sidebarScroll.addEventListener('scroll', () => {
    hideAllPopups();
  }, { passive: true });
}

addLayerButton.addEventListener('click', () => {
  const name = 'Layer ' + (layers.length + 1);
  const layer = createLayer(name);
  layers.push(layer);
  currentLayerId = layer.id;
  getLayerCanvas(layer.id);
  renderLayers();
  redrawCanvas();
  saveToStorage();
});

addPageButton.addEventListener('click', () => {
  const name = 'Canvas ' + (pages.length + 1);
  saveCurrentPageState();
  pages.push(createPage(name));
  saveToStorage();
  loadPageState(pages.length - 1);
});

clearButton.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the entire canvas?')) {
    strokes = [];
    redoStack = [];
    tempCanvas = null;
    scale = 1;
    panX = 0;
    panY = 0;
    layerCanvases = {};
    rebuildAllLayers();
    saveToStorage();
    redrawCanvas();
  }
});

undoButton.addEventListener('click', () => {
  undo();
});

redoButton.addEventListener('click', () => {
  redo();
});

exportButton.addEventListener('click', () => {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportCtx = exportCanvas.getContext('2d');
  
  exportCtx.fillStyle = '#ffffff';
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  
  exportCtx.save();
  layers.slice().reverse().forEach(layer => {
    if (!layer.visible) return;
    exportCtx.globalCompositeOperation = 'source-over';
    exportCtx.drawImage(getLayerCanvas(layer.id), 0, 0);
  });
  
  exportCtx.restore();
  
  exportCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sketchspace-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});

function undo() {
  if (strokes.length === 0) return;

  const last = strokes[strokes.length - 1];
  if (last && last.groupId) {
    const groupId = last.groupId;
    const batch = [];
    while (strokes.length && strokes[strokes.length - 1] && strokes[strokes.length - 1].groupId === groupId) {
      batch.push(strokes.pop());
    }
    batch.reverse();
    redoStack.push({ type: 'batch', strokes: batch });
  } else {
    const lastStroke = strokes.pop();
    redoStack.push(lastStroke);

    if (lastStroke && lastStroke.type === 'moveAction' && Array.isArray(lastStroke.moved)) {
      for (const item of lastStroke.moved) {
        const target = getStrokeById(item.id);
        if (!target) continue;
        restoreStrokeState(target, item.before);
      }
    } else if (lastStroke && lastStroke.type === 'deleteAction') {
      revertDeleteAction(lastStroke);
    }
  }

  saveToStorage();
  rebuildAllLayers();
  redrawCanvas();
}

function redo() {
  if (redoStack.length === 0) return;

  const entry = redoStack.pop();
  if (entry && entry.type === 'batch' && Array.isArray(entry.strokes)) {
    strokes.push(...entry.strokes);
  } else {
    const strokeToRedo = entry;
    strokes.push(strokeToRedo);

    if (strokeToRedo && strokeToRedo.type === 'moveAction' && Array.isArray(strokeToRedo.moved)) {
      for (const item of strokeToRedo.moved) {
        const target = getStrokeById(item.id);
        if (!target) continue;
        restoreStrokeState(target, item.after);
      }
    } else if (strokeToRedo && strokeToRedo.type === 'deleteAction') {
      applyDeleteAction(strokeToRedo);
    }
  }

  saveToStorage();
  rebuildAllLayers();
  redrawCanvas();
}

infoButton.addEventListener('click', () => {
  infoModal.style.display = 'flex';
});

closeButton.addEventListener('click', () => {
  infoModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
  if (e.target === infoModal) {
    infoModal.style.display = 'none';
  }
});

document.addEventListener('keydown', (e) => {
  if (textInputOverlay.style.display === 'block') {
    return;
  }

  const isMod = e.ctrlKey || e.metaKey;

  if (isMod && (e.key === 'c' || e.key === 'C')) {
    if (selectedStrokeIds.size > 0) {
      e.preventDefault();
      copySelectionToClipboard();
    }
    return;
  }

  if (isMod && (e.key === 'v' || e.key === 'V')) {
    if (selectionClipboard) {
      e.preventDefault();
      pasteSelectionFromClipboard();
    }
    return;
  }

  if (currentTool === 'select' && selectedStrokeIds.size > 0 && (e.key === 'Backspace' || e.key === 'Delete')) {
    e.preventDefault();
    deleteSelectedStrokes();
    return;
  }
  
  if (e.code === 'Space' && !spacePressed) {
    e.preventDefault();
    spacePressed = true;
    canvas.style.cursor = 'grab';
    return;
  }
  
  if (isMod && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    undo();
  } else if (isMod && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    redo();
  } else if (e.key === 's' || e.key === 'S') {
    if (selectButton) selectButton.click();
  } else if (e.key === 'p' || e.key === 'P') {
    penButton.click();
  } else if (e.key === 'e' || e.key === 'E') {
    eraserButton.click();
  } else if (e.key === 't' || e.key === 'T') {
    textButton.click();
  } else if (e.key === 'f' || e.key === 'F') {
    fillButton.click();
  } else if (e.key === 'l' || e.key === 'L') {
    setActiveTool('line');
  } else if (e.key === 'r' || e.key === 'R') {
    setActiveTool('rectangle');
  } else if (e.key === 'o' || e.key === 'O') {
    setActiveTool('circle');
  } else if (e.key === 'a' || e.key === 'A') {
    setActiveTool('arrow');
  } else if (e.key === 'c' || e.key === 'C') {
    clearButton.click();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    spacePressed = false;
    if (!isPanning) {
      if (currentTool === 'select') {
        canvas.style.cursor = 'default';
      } else if (currentTool === 'text') {
        canvas.style.cursor = 'text';
      } else {
        canvas.style.cursor = 'crosshair';
      }
    }
  }
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  
  const mouseX = e.offsetX;
  const mouseY = e.offsetY;
  
  const direction = e.deltaY < 0 ? 1 : -1;
  zoomTo(scale + direction * ZOOM_STEP, mouseX, mouseY);
}, { passive: false });

function applyTransform() {
  rebuildAllLayers();
  redrawCanvas();
}

if (zoomInButton) {
  zoomInButton.addEventListener('click', () => {
    zoomTo(scale + ZOOM_STEP, canvas.width / 2, canvas.height / 2);
  });
}

if (zoomOutButton) {
  zoomOutButton.addEventListener('click', () => {
    zoomTo(scale - ZOOM_STEP, canvas.width / 2, canvas.height / 2);
  });
}

let textClickX = 0;
let textClickY = 0;
let pendingTextTap = null;

function handleTextInput(x, y, immediateFocus = false) {
  textClickX = x;
  textClickY = y;
  
  const canvasRect = canvas.getBoundingClientRect();
  const screenX = x * scale + panX;
  const screenY = y * scale + panY;
  
  textInputOverlay.style.left = (canvasRect.left + screenX) + 'px';
  textInputOverlay.style.top = (canvasRect.top + screenY) + 'px';
  textInputOverlay.style.display = 'block';
  textInput.style.fontSize = textSize + 'px';
  textInput.style.color = penColor;
  textInput.value = '';

  if (immediateFocus) {
    textInput.focus();
  }
  setTimeout(() => textInput.focus(), 0);
  
  const finishText = () => {
    const text = textInput.value;
    if (text.trim()) {
      const textStroke = {
        id: generateId('stroke'),
        type: 'text',
        x: textClickX,
        y: textClickY + textSize,
        text: text,
        color: penColor,
        size: textSize,
        layerId: currentLayerId
      };
      
      strokes.push(textStroke);
      redoStack = [];
      applyStrokeToLayer(textStroke);
      saveToStorage();
      redrawCanvas();
    }
    textInputOverlay.style.display = 'none';
    textInput.onblur = null;
    textInput.onkeydown = null;
  };
  
  textInput.onblur = finishText;
  textInput.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      finishText();
    } else if (e.key === 'Escape') {
      textInputOverlay.style.display = 'none';
      textInput.onblur = null;
      textInput.onkeydown = null;
    }
  };
}

function floodFill(screenX, screenY, fillColor) {
  const lctx = getLayerContext(currentLayerId);

  const x = Math.round(screenX);
  const y = Math.round(screenY);
  lctx.setTransform(1, 0, 0, 1, 0, 0);

  const region = applyFloodFillRegion(lctx, x, y, fillColor);
  if (!region) return;

  const pw = region.maxX - region.minX + 1;
  const ph = region.maxY - region.minY + 1;
  const worldX = (region.minX - panX) / scale;
  const worldY = (region.minY - panY) / scale;
  const worldW = pw / scale;
  const worldH = ph / scale;

  const spans = [];
  for (const s of region.spans) {
    spans.push(s[0] - region.minY, s[1] - region.minX, s[2] - region.minX);
  }

  const fillStroke = {
    id: generateId('stroke'),
    type: 'fillRegion',
    x: worldX,
    y: worldY,
    w: worldW,
    h: worldH,
    pw,
    ph,
    spans,
    color: fillColor,
    layerId: currentLayerId
  };

  strokes.push(fillStroke);
  redoStack = [];
  saveToStorage();
  redrawCanvas();
}

function startDrawing(e) {
  if (spacePressed) {
    isPanning = true;
    panStartX = e.clientX - panX;
    panStartY = e.clientY - panY;
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (currentTool === 'pan') {
    isPanning = true;
    panStartX = e.clientX - panX;
    panStartY = e.clientY - panY;
    canvas.style.cursor = 'grabbing';
    return;
  }
  
  const x = (e.offsetX - panX) / scale;
  const y = (e.offsetY - panY) / scale;

  if (currentTool === 'select') {
    if (selectedStrokeIds.size > 0) {
      const b = getSelectionBounds();
      if (b && rectContainsPoint(expandRect(b, 4 / Math.max(0.001, scale)), x, y)) {
        isDraggingSelection = true;
        dragLastX = x;
        dragLastY = y;
        dragOriginals = new Map();
        for (const id of selectedStrokeIds) {
          const s = getStrokeById(id);
          if (!s) continue;
          dragOriginals.set(id, deepClone(s));
        }
        return;
      }
    }

    isSelecting = true;
    selectionStartX = x;
    selectionStartY = y;
    selectionEndX = x;
    selectionEndY = y;
    redrawCanvas();
    return;
  }
  
  if (currentTool === 'text') {
    handleTextInput(x, y, false);
    return;
  }
  
  if (currentTool === 'fill') {
    floodFill(e.offsetX, e.offsetY, penColor);
    return;
  }
  
  drawing = true;
  lastX = x;
  lastY = y;
  
  if (currentTool === 'pen' || currentTool === 'eraser') {
    currentStrokeGroupId = generateId('group');
    const tinyX = lastX + 0.01;
    const tinyY = lastY + 0.01;
    saveStroke(tinyX, tinyY, lastX, lastY);
    lastX = tinyX;
    lastY = tinyY;
  } else if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'arrow') {
    isDrawingShape = true;
    shapeStartX = x;
    shapeStartY = y;
  }
}

function draw(e) {
  if (isPanning) {
    panX = e.clientX - panStartX;
    panY = e.clientY - panStartY;
    applyTransform();
    return;
  }

  if (currentTool === 'select' && isSelecting) {
    const x = (e.offsetX - panX) / scale;
    const y = (e.offsetY - panY) / scale;
    selectionEndX = x;
    selectionEndY = y;
    redrawCanvas();
    return;
  }

  if (currentTool === 'select' && isDraggingSelection) {
    const x = (e.offsetX - panX) / scale;
    const y = (e.offsetY - panY) / scale;
    const dx = x - dragLastX;
    const dy = y - dragLastY;
    dragLastX = x;
    dragLastY = y;

    if (dx !== 0 || dy !== 0) {
      for (const id of selectedStrokeIds) {
        const s = getStrokeById(id);
        if (!s) continue;
        translateStroke(s, dx, dy);
      }
      rebuildAllLayers();
      redrawCanvas();
    }
    return;
  }
  
  if (!drawing) return;
  
  const x = (e.offsetX - panX) / scale;
  const y = (e.offsetY - panY) / scale;
  
  if (currentTool === 'pen' || currentTool === 'eraser') {
    saveStroke(x, y, lastX, lastY);
    
    lastX = x;
    lastY = y;
  } else if (isDrawingShape) {
    redrawCanvas();
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = penColor;
    ctx.lineWidth = Math.max(3, penThickness);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (currentTool === 'line') {
      drawLine(shapeStartX, shapeStartY, x, y);
    } else if (currentTool === 'rectangle') {
      drawRectangle(shapeStartX, shapeStartY, x, y);
    } else if (currentTool === 'circle') {
      drawCircle(shapeStartX, shapeStartY, x, y);
    } else if (currentTool === 'arrow') {
      drawArrow(shapeStartX, shapeStartY, x, y);
    }
  }
}

function stopDrawing(e) {
  if (isPanning) {
    isPanning = false;
    if (spacePressed) {
      canvas.style.cursor = 'grab';
    } else if (currentTool === 'select') {
      canvas.style.cursor = 'default';
    } else if (currentTool === 'pan') {
      canvas.style.cursor = 'grab';
    } else if (currentTool === 'text') {
      canvas.style.cursor = 'text';
    } else {
      canvas.style.cursor = 'crosshair';
    }
    return;
  }

  if (currentTool === 'select' && isSelecting) {
    const x = (e.offsetX - panX) / scale;
    const y = (e.offsetY - panY) / scale;
    selectionEndX = x;
    selectionEndY = y;

    const r = normalizeRect(selectionStartX, selectionStartY, selectionEndX, selectionEndY);
    const w = r.maxX - r.minX;
    const h = r.maxY - r.minY;

    selectedStrokeIds.clear();

    const clickThreshold = 3 / Math.max(0.001, scale);
    if (w < clickThreshold && h < clickThreshold) {
      for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        ensureStrokeId(s);
        const b = getStrokeBounds(s);
        if (!b) continue;
        if (rectContainsPoint(b, x, y)) {
          selectedStrokeIds.add(s.id);
          break;
        }
      }
    } else {
      for (const s of strokes) {
        ensureStrokeId(s);
        const b = getStrokeBounds(s);
        if (!b) continue;
        if (rectIntersects(b, r)) selectedStrokeIds.add(s.id);
      }
    }

    isSelecting = false;
    redrawCanvas();
    return;
  }

  if (currentTool === 'select' && isDraggingSelection) {
    const moved = [];
    for (const id of selectedStrokeIds) {
      const before = dragOriginals.get(id);
      const afterStroke = getStrokeById(id);
      if (!before || !afterStroke) continue;
      moved.push({ id, before: deepClone(before), after: deepClone(afterStroke) });
    }

    if (moved.length) {
      strokes.push({
        id: generateId('move'),
        type: 'moveAction',
        moved
      });
      redoStack = [];
      saveToStorage();
    }

    isDraggingSelection = false;
    dragOriginals.clear();
    rebuildAllLayers();
    redrawCanvas();
    return;
  }
  
  if (!drawing) return;
  
  if (isDrawingShape) {
    const x = (e.offsetX - panX) / scale;
    const y = (e.offsetY - panY) / scale;
    
    const shape = {
      id: generateId('stroke'),
      type: currentTool,
      startX: shapeStartX,
      startY: shapeStartY,
      endX: x,
      endY: y,
      color: penColor,
      thickness: penThickness,
      layerId: currentLayerId
    };
    
    strokes.push(shape);
    redoStack = [];
    applyStrokeToLayer(shape);
    saveToStorage();
    redrawCanvas();
    isDrawingShape = false;
  }
  
  currentStrokeGroupId = null;
  drawing = false;
}

function drawLine(x1, y1, x2, y2, context = ctx) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function drawRectangle(x1, y1, x2, y2, context = ctx) {
  const width = x2 - x1;
  const height = y2 - y1;
  context.beginPath();
  context.rect(x1, y1, width, height);
  context.stroke();
}

function drawCircle(x1, y1, x2, y2, context = ctx) {
  const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  context.beginPath();
  context.arc(x1, y1, radius, 0, 2 * Math.PI);
  context.stroke();
}

function drawArrow(x1, y1, x2, y2, context = ctx) {
  const headLength = 15;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  
  context.beginPath();
  context.moveTo(x2, y2);
  context.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
  context.moveTo(x2, y2);
  context.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
  context.stroke();
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

function saveStroke(x, y, lastX, lastY) {
  const stroke = {
    id: generateId('stroke'),
    type: currentTool,
    x: x,
    y: y,
    lastX: lastX,
    lastY: lastY,
    groupId: currentStrokeGroupId,
    color: penColor,
    thickness: isEraser ? eraserThickness : penThickness,
    isEraser: isEraser,
    layerId: currentLayerId
  };
  strokes.push(stroke);
  redoStack = [];
  applyStrokeToLayer(stroke);
  saveToStorage();
  redrawCanvas();
}

function saveToStorage() {
  try {
    saveCurrentPageState();
    const data = {
      pages: pages,
      currentPageIndex: currentPageIndex
    };
    localStorage.setItem('sketchspace-pages', JSON.stringify(data));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

function loadFromStorage() {
  try {
    const savedPages = localStorage.getItem('sketchspace-pages');
    if (savedPages) {
      const data = JSON.parse(savedPages);
      pages = data.pages || [];
      currentPageIndex = data.currentPageIndex || 0;
    } else {
      const savedStrokes = localStorage.getItem('sketchspace-strokes');
      if (savedStrokes) {
        const migratedStrokes = JSON.parse(savedStrokes);
        const page = createPage('Canvas 1');
        page.strokes = migratedStrokes;
        pages = [page];
        currentPageIndex = 0;
      }
    }

    if (!pages.length) {
      pages = [createPage('Canvas 1')];
      currentPageIndex = 0;
    }

    const page = getCurrentPage();
    strokes = page.strokes;
    redoStack = page.redoStack;
    layers = page.layers;
    currentLayerId = page.currentLayerId;
    scale = 1;
    panX = 0;
    panY = 0;

    page.scale = scale;
    page.panX = panX;
    page.panY = panY;

    if (!layers.length) {
      const firstLayer = createLayer('Layer 1');
      layers = [firstLayer];
      currentLayerId = firstLayer.id;
    }

    strokes.forEach(s => {
      if (!s.layerId) s.layerId = currentLayerId;
      ensureStrokeId(s);
    });

    layerCanvases = {};
    rebuildAllLayers();
    redrawCanvas();
    renderLayers();
    renderPages();

    updateZoomUI();

    saveToStorage();
  } catch (e) {
    console.error('Load error:', e);
  }
}

function redrawCanvas() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  layers.slice().reverse().forEach(layer => {
    if (!layer.visible) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(getLayerCanvas(layer.id), 0, 0);
  });

  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(scale, 0, 0, scale, panX, panY);

  drawSelectionOverlay();
}

function getTouchPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.touches[0].clientX - rect.left,
    y: e.touches[0].clientY - rect.top
  };
}

canvas.addEventListener('touchstart', (e) => {
  const pos = getTouchPos(e);

  if (currentTool === 'pan') {
    e.preventDefault();
    pendingTextTap = null;
    isPanning = true;
    const t = e.touches[0];
    panStartX = t.clientX - panX;
    panStartY = t.clientY - panY;
    return;
  }

  const x = (pos.x - panX) / scale;
  const y = (pos.y - panY) / scale;

  if (currentTool === 'select') {
    if (selectedStrokeIds.size > 0) {
      const b = getSelectionBounds();
      if (b && rectContainsPoint(expandRect(b, 6 / Math.max(0.001, scale)), x, y)) {
        isDraggingSelection = true;
        dragLastX = x;
        dragLastY = y;
        dragOriginals = new Map();
        for (const id of selectedStrokeIds) {
          const s = getStrokeById(id);
          if (!s) continue;
          dragOriginals.set(id, deepClone(s));
        }
        return;
      }
    }

    isSelecting = true;
    selectionStartX = x;
    selectionStartY = y;
    selectionEndX = x;
    selectionEndY = y;
    redrawCanvas();
    return;
  }

  if (currentTool === 'text') {
    e.preventDefault();
    pendingTextTap = { x, y, sx: pos.x, sy: pos.y };
    return;
  }

  e.preventDefault();

  if (currentTool === 'fill') {
    floodFill(pos.x, pos.y, penColor);
    return;
  }

  drawing = true;
  lastX = x;
  lastY = y;

  if (currentTool === 'pen' || currentTool === 'eraser') {
    currentStrokeGroupId = generateId('group');
    const tinyX = lastX + 0.01;
    const tinyY = lastY + 0.01;
    saveStroke(tinyX, tinyY, lastX, lastY);
    lastX = tinyX;
    lastY = tinyY;
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();

  if (currentTool === 'pan' && isPanning) {
    const t = e.touches[0];
    panX = t.clientX - panStartX;
    panY = t.clientY - panStartY;
    applyTransform();
    return;
  }

  if (currentTool === 'text' && pendingTextTap) {
    const pos = getTouchPos(e);
    const dx = pos.x - pendingTextTap.sx;
    const dy = pos.y - pendingTextTap.sy;
    if (Math.hypot(dx, dy) > 6) pendingTextTap = null;
    return;
  }

  if (currentTool === 'select' && isSelecting) {
    const pos = getTouchPos(e);
    const x = (pos.x - panX) / scale;
    const y = (pos.y - panY) / scale;
    selectionEndX = x;
    selectionEndY = y;
    redrawCanvas();
    return;
  }

  if (currentTool === 'select' && isDraggingSelection) {
    const pos = getTouchPos(e);
    const x = (pos.x - panX) / scale;
    const y = (pos.y - panY) / scale;
    const dx = x - dragLastX;
    const dy = y - dragLastY;
    dragLastX = x;
    dragLastY = y;

    if (dx !== 0 || dy !== 0) {
      for (const id of selectedStrokeIds) {
        const s = getStrokeById(id);
        if (!s) continue;
        translateStroke(s, dx, dy);
      }
      rebuildAllLayers();
      redrawCanvas();
    }
    return;
  }

  if (!drawing) return;
  
  const pos = getTouchPos(e);
  const x = (pos.x - panX) / scale;
  const y = (pos.y - panY) / scale;
  
  if (currentTool === 'pen' || currentTool === 'eraser') {
    saveStroke(x, y, lastX, lastY);
    lastX = x;
    lastY = y;
  } else if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'arrow') {
    if (!isDrawingShape) {
      isDrawingShape = true;
      shapeStartX = lastX;
      shapeStartY = lastY;
    }

    redrawCanvas();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = penColor;
    ctx.lineWidth = Math.max(3, penThickness);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool === 'line') {
      drawLine(shapeStartX, shapeStartY, x, y);
    } else if (currentTool === 'rectangle') {
      drawRectangle(shapeStartX, shapeStartY, x, y);
    } else if (currentTool === 'circle') {
      drawCircle(shapeStartX, shapeStartY, x, y);
    } else if (currentTool === 'arrow') {
      drawArrow(shapeStartX, shapeStartY, x, y);
    }

    lastX = x;
    lastY = y;
  }
}, { passive: false });

canvas.addEventListener('touchend', () => {
  if (currentTool === 'pan' && isPanning) {
    isPanning = false;
    return;
  }

  if (currentTool === 'text' && pendingTextTap) {
    handleTextInput(pendingTextTap.x, pendingTextTap.y, true);
    pendingTextTap = null;
    return;
  }

  if (currentTool === 'select' && isSelecting) {
    const r = normalizeRect(selectionStartX, selectionStartY, selectionEndX, selectionEndY);
    const w = r.maxX - r.minX;
    const h = r.maxY - r.minY;
    selectedStrokeIds.clear();

    const clickThreshold = 3 / Math.max(0.001, scale);
    if (w < clickThreshold && h < clickThreshold) {
      const x = selectionEndX;
      const y = selectionEndY;
      for (let i = strokes.length - 1; i >= 0; i--) {
        const s = strokes[i];
        ensureStrokeId(s);
        const b = getStrokeBounds(s);
        if (!b) continue;
        if (rectContainsPoint(b, x, y)) {
          selectedStrokeIds.add(s.id);
          break;
        }
      }
    } else {
      for (const s of strokes) {
        ensureStrokeId(s);
        const b = getStrokeBounds(s);
        if (!b) continue;
        if (rectIntersects(b, r)) selectedStrokeIds.add(s.id);
      }
    }

    isSelecting = false;
    redrawCanvas();
    return;
  }

  if (currentTool === 'select' && isDraggingSelection) {
    const moved = [];
    for (const id of selectedStrokeIds) {
      const before = dragOriginals.get(id);
      const afterStroke = getStrokeById(id);
      if (!before || !afterStroke) continue;
      moved.push({ id, before: deepClone(before), after: deepClone(afterStroke) });
    }

    if (moved.length) {
      strokes.push({
        id: generateId('move'),
        type: 'moveAction',
        moved
      });
      redoStack = [];
      saveToStorage();
    }

    isDraggingSelection = false;
    dragOriginals.clear();
    rebuildAllLayers();
    redrawCanvas();
    return;
  }

  if (isDrawingShape) {
    const shape = {
      id: generateId('stroke'),
      type: currentTool,
      startX: shapeStartX,
      startY: shapeStartY,
      endX: lastX,
      endY: lastY,
      color: penColor,
      thickness: penThickness,
      layerId: currentLayerId
    };

    strokes.push(shape);
    redoStack = [];
    applyStrokeToLayer(shape);
    saveToStorage();
    isDrawingShape = false;
    redrawCanvas();
  }

  currentStrokeGroupId = null;
  drawing = false;
});

loadFromStorage();