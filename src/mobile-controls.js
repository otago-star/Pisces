export class MobileControls {
  constructor() {
    this._root = document.getElementById('mobile-controls');
    this._leftStick = document.getElementById('left-stick');
    this._leftThumb = document.getElementById('left-thumb');
    this._lookPad = document.getElementById('look-pad');
    this._riseBtn = document.getElementById('rise-btn');
    this._sinkBtn = document.getElementById('sink-btn');

    this._state = {
      moveX: 0,
      moveY: 0,
      lookDX: 0,
      lookDY: 0,
      ascend: false,
      descend: false,
    };

    this._stickPointerId = null;
    this._lookPointerId = null;
    this._lastLookX = 0;
    this._lastLookY = 0;
    this._stickRadius = 54;

    this._bindEvents();
  }

  show() {
    this._root.classList.add('is-visible');
  }

  hide() {
    this._root.classList.remove('is-visible');
    this.reset();
  }

  reset() {
    this._stickPointerId = null;
    this._lookPointerId = null;
    this._state.moveX = 0;
    this._state.moveY = 0;
    this._state.lookDX = 0;
    this._state.lookDY = 0;
    this._state.ascend = false;
    this._state.descend = false;
    this._leftThumb.style.transform = 'translate(-50%, -50%)';
    this._riseBtn.classList.remove('is-pressed');
    this._sinkBtn.classList.remove('is-pressed');
  }

  getState() {
    return this._state;
  }

  consumeLook() {
    const lookDX = this._state.lookDX;
    const lookDY = this._state.lookDY;
    this._state.lookDX = 0;
    this._state.lookDY = 0;
    return { lookDX, lookDY };
  }

  _bindEvents() {
    this._leftStick.addEventListener('pointerdown', (event) => {
      if (this._stickPointerId !== null) return;
      this._stickPointerId = event.pointerId;
      this._leftStick.setPointerCapture(event.pointerId);
      this._updateStick(event.clientX, event.clientY);
    });

    this._leftStick.addEventListener('pointermove', (event) => {
      if (this._stickPointerId !== event.pointerId) return;
      this._updateStick(event.clientX, event.clientY);
    });

    const releaseStick = (event) => {
      if (this._stickPointerId !== event.pointerId) return;
      this._stickPointerId = null;
      this._state.moveX = 0;
      this._state.moveY = 0;
      this._leftThumb.style.transform = 'translate(-50%, -50%)';
    };

    this._leftStick.addEventListener('pointerup', releaseStick);
    this._leftStick.addEventListener('pointercancel', releaseStick);

    this._lookPad.addEventListener('pointerdown', (event) => {
      if (this._lookPointerId !== null) return;
      this._lookPointerId = event.pointerId;
      this._lastLookX = event.clientX;
      this._lastLookY = event.clientY;
      this._lookPad.setPointerCapture(event.pointerId);
    });

    this._lookPad.addEventListener('pointermove', (event) => {
      if (this._lookPointerId !== event.pointerId) return;
      this._state.lookDX += event.clientX - this._lastLookX;
      this._state.lookDY += event.clientY - this._lastLookY;
      this._lastLookX = event.clientX;
      this._lastLookY = event.clientY;
    });

    const releaseLook = (event) => {
      if (this._lookPointerId !== event.pointerId) return;
      this._lookPointerId = null;
    };

    this._lookPad.addEventListener('pointerup', releaseLook);
    this._lookPad.addEventListener('pointercancel', releaseLook);

    this._riseBtn.addEventListener('pointerdown', () => {
      this._state.ascend = true;
      this._riseBtn.classList.add('is-pressed');
    });

    this._riseBtn.addEventListener('pointerup', () => {
      this._state.ascend = false;
      this._riseBtn.classList.remove('is-pressed');
    });

    this._riseBtn.addEventListener('pointercancel', () => {
      this._state.ascend = false;
      this._riseBtn.classList.remove('is-pressed');
    });

    this._sinkBtn.addEventListener('pointerdown', () => {
      this._state.descend = true;
      this._sinkBtn.classList.add('is-pressed');
    });

    this._sinkBtn.addEventListener('pointerup', () => {
      this._state.descend = false;
      this._sinkBtn.classList.remove('is-pressed');
    });

    this._sinkBtn.addEventListener('pointercancel', () => {
      this._state.descend = false;
      this._sinkBtn.classList.remove('is-pressed');
    });
  }

  _updateStick(clientX, clientY) {
    const rect = this._leftStick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const length = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(length, this._stickRadius);
    const nx = dx / length * clamped;
    const ny = dy / length * clamped;

    this._state.moveX = nx / this._stickRadius;
    this._state.moveY = -(ny / this._stickRadius);
    this._leftThumb.style.transform = `translate(-50%, -50%) translate(${nx}px, ${ny}px)`;
  }
}