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

let layers = [];
let currentLayerId = null;
let pages = [];
let currentPageIndex = 0;
let layerCanvases = {};

const penButton = document.getElementById('pen-button');
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  const startR = pixels[startPos];
  const startG = pixels[startPos + 1];
  const startB = pixels[startPos + 2];
  const startA = pixels[startPos + 3];

  const fillR = parseInt(fillColor.slice(1, 3), 16);
  const fillG = parseInt(fillColor.slice(3, 5), 16);
  const fillB = parseInt(fillColor.slice(5, 7), 16);

  if (startR === fillR && startG === fillG && startB === fillB && startA === 255) {
    return;
  }

  const stack = [[startX, startY]];
  const visited = new Set();

  while (stack.length > 0 && stack.length < 50000) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= w || y < 0 || y >= h) continue;

    const key = `${x},${y}`;
    if (visited.has(key)) continue;

    const pos = (y * w + x) * 4;
    const r = pixels[pos];
    const g = pixels[pos + 1];
    const b = pixels[pos + 2];
    const a = pixels[pos + 3];

    if (r !== startR || g !== startG || b !== startB || a !== startA) continue;

    visited.add(key);

    pixels[pos] = fillR;
    pixels[pos + 1] = fillG;
    pixels[pos + 2] = fillB;
    pixels[pos + 3] = 255;

    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }

  context.putImageData(imageData, 0, 0);
}

function applyStrokeToLayer(stroke) {
  const layerId = stroke.layerId || currentLayerId;
  const lctx = getLayerContext(layerId);

  if (stroke.type === 'fill') {
    const screenX = Math.floor(stroke.x * scale + panX);
    const screenY = Math.floor(stroke.y * scale + panY);
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    applyFloodFill(lctx, screenX, screenY, stroke.color);
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
  
  if (tool === 'pen') {
    penButton.classList.add('active');
    isEraser = false;
  } else if (tool === 'eraser') {
    eraserButton.classList.add('active');
    isEraser = true;
  } else if (tool === 'text') {
    textButton.classList.add('active');
    isEraser = false;
  } else if (tool === 'fill') {
    fillButton.classList.add('active');
    isEraser = false;
  } else if (tool === 'line' || tool === 'rectangle' || tool === 'circle' || tool === 'arrow') {
    shapesButton.classList.add('active');
    isEraser = false;
  }
}

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
  
  const lastStroke = strokes.pop();
  redoStack.push(lastStroke);
  saveToStorage();
  rebuildAllLayers();
  redrawCanvas();
}

function redo() {
  if (redoStack.length === 0) return;
  
  const strokeToRedo = redoStack.pop();
  strokes.push(strokeToRedo);
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
  
  if (e.code === 'Space' && !spacePressed) {
    e.preventDefault();
    spacePressed = true;
    canvas.style.cursor = 'grab';
    return;
  }
  
  if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    undo();
  } else if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
    e.preventDefault();
    redo();
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
      canvas.style.cursor = 'crosshair';
    }
  }
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  
  const mouseX = e.offsetX;
  const mouseY = e.offsetY;
  
  const worldX = (mouseX - panX) / scale;
  const worldY = (mouseY - panY) / scale;
  
  const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.max(0.1, Math.min(5, scale * zoomFactor));
  
  scale = newScale;
  
  panX = mouseX - worldX * scale;
  panY = mouseY - worldY * scale;
  
  applyTransform();
}, { passive: false });

function applyTransform() {
  rebuildAllLayers();
  redrawCanvas();
}

let textClickX = 0;
let textClickY = 0;

function handleTextInput(x, y) {
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
  
  setTimeout(() => textInput.focus(), 0);
  
  const finishText = () => {
    const text = textInput.value;
    if (text.trim()) {
      const textStroke = {
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

function floodFill(startX, startY, fillColor) {
  const lctx = getLayerContext(currentLayerId);

  const screenX = Math.floor(startX * scale + panX);
  const screenY = Math.floor(startY * scale + panY);
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  applyFloodFill(lctx, screenX, screenY, fillColor);
  
  const fillStroke = {
    type: 'fill',
    x: startX,
    y: startY,
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
  
  const x = (e.offsetX - panX) / scale;
  const y = (e.offsetY - panY) / scale;
  
  if (currentTool === 'text') {
    handleTextInput(x, y);
    return;
  }
  
  if (currentTool === 'fill') {
    floodFill(Math.floor(x), Math.floor(y), penColor);
    return;
  }
  
  drawing = true;
  lastX = x;
  lastY = y;
  
  if (currentTool === 'pen' || currentTool === 'eraser') {
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
    canvas.style.cursor = spacePressed ? 'grab' : 'crosshair';
    return;
  }
  
  if (!drawing) return;
  
  if (isDrawingShape) {
    const x = (e.offsetX - panX) / scale;
    const y = (e.offsetY - panY) / scale;
    
    const shape = {
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
    type: currentTool,
    x: x,
    y: y,
    lastX: lastX,
    lastY: lastY,
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
    });

    layerCanvases = {};
    rebuildAllLayers();
    redrawCanvas();
    renderLayers();
    renderPages();

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
}

function getTouchPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.touches[0].clientX - rect.left,
    y: e.touches[0].clientY - rect.top
  };
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const pos = getTouchPos(e);

  const x = (pos.x - panX) / scale;
  const y = (pos.y - panY) / scale;

  if (currentTool === 'fill') {
    floodFill(Math.floor(x), Math.floor(y), penColor);
    return;
  }

  drawing = true;
  lastX = x;
  lastY = y;

  if (currentTool === 'pen' || currentTool === 'eraser') {
    const tinyX = lastX + 0.01;
    const tinyY = lastY + 0.01;
    saveStroke(tinyX, tinyY, lastX, lastY);
    lastX = tinyX;
    lastY = tinyY;
  }
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
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
});

canvas.addEventListener('touchend', () => {
  if (isDrawingShape) {
    const shape = {
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

  drawing = false;
});

loadFromStorage();