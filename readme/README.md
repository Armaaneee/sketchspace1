# SketchSpace

SketchSpace is a browser-based whiteboard with drawing, shapes, text, layers, pages, selection tools, and export. Everything runs locally and is stored in your browser, so your whiteboards stay on your device.

## What it does


### Whiteboard tools
- Pen, eraser, text, fill bucket, and shapes (line, rectangle, circle, arrow).
- Adjustable pen thickness, eraser thickness, and text size.
- Color picker for strokes and text.

### Selection tools
- Rectangle select and single-click select.
- Move selections and resize with handles.
- Copy/paste selections and delete selected strokes.

### Layers and canvases
- Create, reorder, hide/show, and delete layers.
- Multiple canvases (whiteboards).

### Pan and zoom
- Mouse wheel zoom in/out.
- Space + drag to pan or use the pan tool.
- Zoom controls in the bottom-right corner.

### Export
- Export the current canvas to PNG with a white background.

## How it works
- All data is persisted in localStorage, so layers, pages, and strokes are restored on reload.
- The renderer uses per-layer offscreen canvases and redraws the visible stack for fast updates.
- Selection operations (move/resize) are recorded so undo/redo stays consistent.

## Project structure
- sketchspace-react/: Vite + React version.
- OLD/: Original static implementation (HTML/CSS/JS).

## AI Declaration
AI was used during the production of this project, but only to help me learn (especially when I was trying to refactor everything over to React) or when I desperately could not find the source of an error/debug to nudge me in the right direction.
