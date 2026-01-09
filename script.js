const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');

let drawing = false;
let lastX = 0;
let lastY = 0;

function resizeCanvas() {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  tempCtx.drawImage(canvas, 0, 0);
  
  canvas.width = window.innerWidth - 70;
  canvas.height = window.innerHeight;
  
  ctx.drawImage(tempCanvas, 0, 0);
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function startDrawing(e) {
  drawing = true;
  lastX = e.offsetX;
  lastY = e.offsetY;
}

function draw(e) {
  if (!drawing) return;
  
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  
  lastX = e.offsetX;
  lastY = e.offsetY;
}

function stopDrawing() {
  if (drawing) {
    drawing = false;
  }
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);