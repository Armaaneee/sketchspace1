const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');

let drawing = false;
let lastX = 0;
let lastY = 0;
let isEraser = false;
let penColor = '#000000';
let penThickness = 5;
let eraserThickness = 20;
let strokes = [];
let redoStack = [];
let currentTool = 'pen';
let shapeStartX = 0;
let shapeStartY = 0;
let isDrawingShape = false;
let tempCanvas = null;

const penButton = document.getElementById('pen-button');
const eraserButton = document.getElementById('eraser-button');
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
const clearButton = document.getElementById('clear-button');
const undoButton = document.getElementById('undo-button');
const redoButton = document.getElementById('redo-button');
const infoButton = document.getElementById('info-button');
const infoModal = document.getElementById('info-modal');
const closeButton = document.querySelector('.close-button');

function resizeCanvas() {
  canvas.width = window.innerWidth - 70;
  canvas.height = window.innerHeight;
  redrawCanvas();
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

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

function setActiveTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('active'));
  
  if (tool === 'pen') {
    penButton.classList.add('active');
    isEraser = false;
  } else if (tool === 'eraser') {
    eraserButton.classList.add('active');
    isEraser = true;
  } else if (tool === 'line' || tool === 'rectangle' || tool === 'circle' || tool === 'arrow') {
    shapesButton.classList.add('active');
    isEraser = false;
  }
}

penButton.addEventListener('click', () => setActiveTool('pen'));
eraserButton.addEventListener('click', () => setActiveTool('eraser'));

// Shapes menu toggle and selection
shapesButton.addEventListener('click', (e) => {
  e.stopPropagation();
  shapesPopup.classList.toggle('show');
  thicknessPopup.classList.remove('show');
  eraserThicknessPopup.classList.remove('show');
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

thicknessPreview.addEventListener('click', (e) => {
  e.stopPropagation();
  thicknessPopup.classList.toggle('show');
  eraserThicknessPopup.classList.remove('show');
});

eraserThicknessPreview.addEventListener('click', (e) => {
  e.stopPropagation();
  eraserThicknessPopup.classList.toggle('show');
  thicknessPopup.classList.remove('show');
});

thicknessPopup.addEventListener('click', (e) => {
  e.stopPropagation();
});

eraserThicknessPopup.addEventListener('click', (e) => {
  e.stopPropagation();
});

shapesPopup.addEventListener('click', (e) => {
  e.stopPropagation();
});

document.addEventListener('click', () => {
  thicknessPopup.classList.remove('show');
  eraserThicknessPopup.classList.remove('show');
  shapesPopup.classList.remove('show');
});

clearButton.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the entire canvas?')) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes = [];
    redoStack = [];
    tempCanvas = null;
    saveToStorage();
  }
});

undoButton.addEventListener('click', () => {
  undo();
});

redoButton.addEventListener('click', () => {
  redo();
});

function undo() {
  if (strokes.length === 0) return;
  
  const lastStroke = strokes.pop();
  redoStack.push(lastStroke);
  saveToStorage();
  redrawCanvas();
}

function redo() {
  if (redoStack.length === 0) return;
  
  const strokeToRedo = redoStack.pop();
  strokes.push(strokeToRedo);
  saveToStorage();
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

function startDrawing(e) {
  drawing = true;
  lastX = e.offsetX;
  lastY = e.offsetY;
  
  if (currentTool === 'pen' || currentTool === 'eraser') {
    ctx.lineWidth = isEraser ? eraserThickness : penThickness;
    ctx.lineCap = 'round';
    
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor;
    }
    
    ctx.beginPath();
    ctx.arc(lastX, lastY, 0.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (currentTool === 'line' || currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'arrow') {
    isDrawingShape = true;
    shapeStartX = e.offsetX;
    shapeStartY = e.offsetY;
    
    // Always refresh the temporary canvas snapshot of current state
    if (!tempCanvas) {
      tempCanvas = document.createElement('canvas');
    }
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tctx = tempCanvas.getContext('2d');
    tctx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tctx.drawImage(canvas, 0, 0);
  }
}

function draw(e) {
  if (!drawing) return;
  
  if (currentTool === 'pen' || currentTool === 'eraser') {
    ctx.lineWidth = isEraser ? eraserThickness : penThickness;
    ctx.lineCap = 'round';
    
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor;
    }
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    
    saveStroke(e.offsetX, e.offsetY, lastX, lastY);
    
    lastX = e.offsetX;
    lastY = e.offsetY;
  } else if (isDrawingShape) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = penColor;
    ctx.lineWidth = Math.max(3, penThickness);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (currentTool === 'line') {
      drawLine(shapeStartX, shapeStartY, e.offsetX, e.offsetY);
    } else if (currentTool === 'rectangle') {
      drawRectangle(shapeStartX, shapeStartY, e.offsetX, e.offsetY);
    } else if (currentTool === 'circle') {
      drawCircle(shapeStartX, shapeStartY, e.offsetX, e.offsetY);
    } else if (currentTool === 'arrow') {
      drawArrow(shapeStartX, shapeStartY, e.offsetX, e.offsetY);
    }
  }
}

function stopDrawing(e) {
  if (!drawing) return;
  
  if (isDrawingShape) {
    const shape = {
      type: currentTool,
      startX: shapeStartX,
      startY: shapeStartY,
      endX: e.offsetX,
      endY: e.offsetY,
      color: penColor,
      thickness: penThickness
    };
    
    strokes.push(shape);
    redoStack = [];
    saveToStorage();
    isDrawingShape = false;
  }
  
  drawing = false;
}

function drawLine(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawRectangle(x1, y1, x2, y2) {
  const width = x2 - x1;
  const height = y2 - y1;
  ctx.beginPath();
  ctx.rect(x1, y1, width, height);
  ctx.stroke();
}

function drawCircle(x1, y1, x2, y2) {
  const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  ctx.beginPath();
  ctx.arc(x1, y1, radius, 0, 2 * Math.PI);
  ctx.stroke();
}

function drawArrow(x1, y1, x2, y2) {
  const headLength = 15;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
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
    isEraser: isEraser
  };
  strokes.push(stroke);
  redoStack = [];
  saveToStorage();
}

function saveToStorage() {
  try {
    localStorage.setItem('sketchspace-strokes', JSON.stringify(strokes));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('sketchspace-strokes');
    if (saved) {
      strokes = JSON.parse(saved);
      redrawCanvas();
    }
  } catch (e) {
    console.error('Load error:', e);
  }
}

function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  strokes.forEach(stroke => {
    if (stroke.type === 'line') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(3, stroke.thickness);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawLine(stroke.startX, stroke.startY, stroke.endX, stroke.endY);
    } else if (stroke.type === 'rectangle') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(3, stroke.thickness);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawRectangle(stroke.startX, stroke.startY, stroke.endX, stroke.endY);
    } else if (stroke.type === 'circle') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(3, stroke.thickness);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawCircle(stroke.startX, stroke.startY, stroke.endX, stroke.endY);
    } else if (stroke.type === 'arrow') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = Math.max(3, stroke.thickness);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      drawArrow(stroke.startX, stroke.startY, stroke.endX, stroke.endY);
    } else {
      ctx.lineWidth = stroke.thickness;
      ctx.lineCap = 'round';
      
      if (stroke.isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
      }
      
      ctx.beginPath();
      ctx.moveTo(stroke.lastX, stroke.lastY);
      ctx.lineTo(stroke.x, stroke.y);
      ctx.stroke();
    }
  });
  
  ctx.globalCompositeOperation = 'source-over';
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
  drawing = true;
  lastX = pos.x;
  lastY = pos.y;
});

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!drawing) return;
  
  const pos = getTouchPos(e);
  
  ctx.lineWidth = isEraser ? eraserThickness : penThickness;
  ctx.lineCap = 'round';
  
  if (isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = penColor;
  }
  
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  
  saveStroke(pos.x, pos.y, lastX, lastY);
  
  lastX = pos.x;
  lastY = pos.y;
});

canvas.addEventListener('touchend', () => {
  drawing = false;
});

loadFromStorage();