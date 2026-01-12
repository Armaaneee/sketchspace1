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

const penButton = document.getElementById('pen-button');
const eraserButton = document.getElementById('eraser-button');
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

penButton.addEventListener('click', () => {
  isEraser = false;
  penButton.classList.add('active');
  eraserButton.classList.remove('active');
});

eraserButton.addEventListener('click', () => {
  isEraser = true;
  eraserButton.classList.add('active');
  penButton.classList.remove('active');
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

document.addEventListener('click', () => {
  thicknessPopup.classList.remove('show');
  eraserThicknessPopup.classList.remove('show');
});

clearButton.addEventListener('click', () => {
  if (confirm('Are you sure you want to clear the entire canvas?')) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes = [];
    saveToStorage();
  }
});

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
  if (e.key === 'p' || e.key === 'P') {
    penButton.click();
  } else if (e.key === 'e' || e.key === 'E') {
    eraserButton.click();
  } else if (e.key === 'c' || e.key === 'C') {
    clearButton.click();
  }
});

function startDrawing(e) {
  drawing = true;
  lastX = e.offsetX;
  lastY = e.offsetY;
  
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
}

function draw(e) {
  if (!drawing) return;
  
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
}

function stopDrawing() {
  drawing = false;
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

function saveStroke(x, y, lastX, lastY) {
  const stroke = {
    x: x,
    y: y,
    lastX: lastX,
    lastY: lastY,
    color: penColor,
    thickness: isEraser ? eraserThickness : penThickness,
    isEraser: isEraser
  };
  strokes.push(stroke);
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