// 鍵盤、滑鼠與 Pointer Lock 輸入。邊緣觸發的按鍵會用 consume 消耗一次。
export class Input {
  constructor(element) {
    this.element = element;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouse = [false, false, false];
    this.mousePressed = [false, false, false];
    this.dx = 0;
    this.dy = 0;
    this.locked = false;
    this.onLockChange = null;
    this.onAnyInput = null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code === 'F1') e.preventDefault();
      if (!e.repeat) {
        this.pressedKeys.add(e.code);
        if (this.onAnyInput) this.onAnyInput();
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse = [false, false, false];
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button >= 0 && e.button <= 2) {
        this.mouse[e.button] = true;
        this.mousePressed[e.button] = true;
      }
      if (this.onAnyInput) this.onAnyInput();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button >= 0 && e.button <= 2) this.mouse[e.button] = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX || 0;
      this.dy += e.movementY || 0;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.element;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      this.locked = false;
      if (this.onLockChange) this.onLockChange(false);
    });
  }

  requestLock() {
    if (!this.locked) {
      const p = this.element.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  consumeKey(code) {
    if (!this.pressedKeys.has(code)) return false;
    this.pressedKeys.delete(code);
    return true;
  }

  isMouseDown(button) {
    return this.mouse[button];
  }

  consumeMouse(button) {
    if (!this.mousePressed[button]) return false;
    this.mousePressed[button] = false;
    return true;
  }

  consumeMouseDelta() {
    const out = { x: this.dx, y: this.dy };
    this.dx = 0;
    this.dy = 0;
    return out;
  }

  endFrame() {
    this.pressedKeys.clear();
    this.mousePressed = [false, false, false];
  }
}
