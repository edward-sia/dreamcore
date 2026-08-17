const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'), crosshair: $('crosshair'), prompt: $('prompt'),
      objective: $('objective'), items: $('items'), subtitle: $('subtitle'),
      hintKeys: $('hint-keys'),
      noteOverlay: $('note-overlay'), noteTitle: $('note-title'), noteBody: $('note-body'),
      journal: $('journal'), journalEntries: $('journal-entries'),
      keypad: $('keypad'), keypadLabel: $('keypad-label'),
      keypadDisplay: $('keypad-display'), keypadGrid: $('keypad-grid'),
      fade: $('fade'), flash: $('flash'), titlecard: $('titlecard'),
      titlecardNum: $('titlecard-num'), titlecardName: $('titlecard-name'),
      interlude: $('interlude'), interludeText: $('interlude-text'),
      interludeContinue: $('interlude-continue'),
    };

    this.onModalChange = null; // (isOpen) => void
    this._modal = null;        // 'note' | 'journal' | 'keypad' | null
    this._noteClose = null;
    this._keypadState = null;
    this._subTimer = null;
    this._flashTimer = null;
    this._clues = [];

    document.addEventListener('keydown', (e) => this._onKey(e));
    this.el.noteOverlay.addEventListener('mousedown', () => {
      if (this._modal === 'note') this._closeNote();
    });

    setTimeout(() => { this.el.hintKeys.style.opacity = '0'; }, 26000);
  }

  get modalOpen() { return this._modal !== null; }

  get modalKind() { return this._modal; }

  /** Public close for the current overlay (also used by automated playtests). */
  closeModal() { this._closeModal(); }

  showHUD(on) { this.el.hud.classList.toggle('hidden', !on); }

  setPrompt(text) {
    if (text) {
      this.el.prompt.textContent = text;
      this.el.prompt.classList.remove('hidden');
      this.el.crosshair.classList.add('on');
    } else {
      this.el.prompt.classList.add('hidden');
      this.el.crosshair.classList.remove('on');
    }
  }

  setObjective(text) {
    const el = this.el.objective;
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = text || '';
      el.style.opacity = '1';
    }, 600);
  }

  subtitle(text, duration = 4.5, { voice = 'inner' } = {}) {
    clearTimeout(this._subTimer);
    const el = this.el.subtitle;
    el.textContent = text;
    el.classList.toggle('cue', voice === 'cue');
    el.classList.remove('hidden');
    el.style.opacity = '1';
    this._subTimer = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.classList.add('hidden'), 900);
    }, duration * 1000);
  }

  /** A blink: the screen goes to `color` at once and clears over 0.25 s after `ms`. */
  flash(color = '#000', ms = 110) {
    const el = this.el.flash;
    if (!el) return;
    clearTimeout(this._flashTimer);
    el.style.transition = 'none';
    el.style.background = color;
    el.style.opacity = '1';
    this._flashTimer = setTimeout(() => {
      el.style.transition = 'opacity 0.25s ease';
      el.style.opacity = '0';
    }, ms);
  }

  // ---------- notes & journal ----------

  showNote({ title, body }, onClose = null) {
    this._noteClose = onClose;
    this.el.noteTitle.textContent = title || '';
    this.el.noteBody.textContent = body || '';
    this._openModal('note', this.el.noteOverlay);
  }

  addClue(clue) {
    if (!this._clues.some((c) => c.id === clue.id)) this._clues.push(clue);
  }

  clearClues() { this._clues = []; }

  toggleJournal() {
    if (this._modal === 'journal') { this._closeModal(); return; }
    if (this._modal) return;
    const box = this.el.journalEntries;
    box.innerHTML = '';
    if (!this._clues.length) {
      box.innerHTML = '<div class="journal-empty">nothing yet. it will come back to you.</div>';
    } else {
      for (const c of this._clues) {
        const div = document.createElement('div');
        div.className = 'journal-entry';
        const t = document.createElement('div');
        t.className = 'je-title'; t.textContent = c.title;
        const b = document.createElement('div');
        b.className = 'je-body'; b.textContent = c.body;
        div.append(t, b);
        box.appendChild(div);
      }
    }
    this._openModal('journal', this.el.journal);
  }

  // ---------- keypad ----------

  showKeypad({ label, length = 4, keys = '1234567890', onSubmit, onCancel, onKey }) {
    this._keypadState = { code: '', length, keys, onSubmit, onCancel, onKey };
    this.el.keypadLabel.textContent = label || '';
    this.el.keypadDisplay.textContent = '';
    const grid = this.el.keypadGrid;
    grid.innerHTML = '';
    for (const k of keys) {
      const btn = document.createElement('button');
      btn.className = 'keypad-btn';
      btn.textContent = k;
      btn.addEventListener('click', () => this._keypadPress(k));
      grid.appendChild(btn);
    }
    const del = document.createElement('button');
    del.className = 'keypad-btn';
    del.textContent = '⌫';
    del.addEventListener('click', () => this._keypadPress(null));
    grid.appendChild(del);
    this._openModal('keypad', this.el.keypad);
  }

  _keypadPress(k) {
    const st = this._keypadState;
    if (!st) return;
    if (k === null) st.code = st.code.slice(0, -1);
    else if (!st.keys.includes(k)) return;   // a key this pad does not have
    else if (st.code.length < st.length) { st.code += k; st.onKey?.(k); }
    this.el.keypadDisplay.textContent = st.code.padEnd(st.length, '·');
    if (st.code.length === st.length) {
      const code = st.code;
      setTimeout(() => {
        if (this._keypadState !== st) return;
        this._closeModal();
        st.onSubmit?.(code);
      }, 260);
    }
  }

  /** Programmatic entry for automated playtests. */
  submitKeypad(code) {
    const st = this._keypadState;
    if (!st) return false;
    this._closeModal();
    st.onSubmit?.(code);
    return true;
  }

  // ---------- items ----------

  setItems(items) {
    this.el.items.innerHTML = '';
    for (const it of items) {
      const chip = document.createElement('div');
      chip.className = 'item-chip';
      chip.textContent = it.name;
      this.el.items.appendChild(chip);
    }
  }

  // ---------- fades / cards / interludes ----------

  fadeToBlack(slow = false) {
    return new Promise((res) => {
      this.el.fade.classList.toggle('slow', slow);
      this.el.fade.style.opacity = '1';
      setTimeout(res, slow ? 3300 : 1700);
    });
  }

  fadeIn(slow = false) {
    return new Promise((res) => {
      this.el.fade.classList.toggle('slow', slow);
      this.el.fade.style.opacity = '0';
      setTimeout(res, slow ? 3300 : 1700);
    });
  }

  async showTitleCard(num, name, holdMs = 2600) {
    this.el.titlecardNum.textContent = num;
    this.el.titlecardName.textContent = name;
    this.el.titlecard.classList.remove('hidden');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    this.el.titlecard.classList.add('show');
    await new Promise((r) => setTimeout(r, holdMs));
    this.el.titlecard.classList.remove('show');
    await new Promise((r) => setTimeout(r, 1900));
    this.el.titlecard.classList.add('hidden');
  }

  async showInterlude(text) {
    const { interlude, interludeText, interludeContinue } = this.el;
    interludeText.textContent = text;
    interlude.classList.remove('hidden');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    interludeText.classList.add('show');
    await new Promise((r) => setTimeout(r, Math.min(2600 + text.length * 28, 7000)));
    interludeContinue.classList.add('show');
    await new Promise((res) => {
      const done = () => {
        document.removeEventListener('keydown', done);
        document.removeEventListener('mousedown', done);
        res();
      };
      document.addEventListener('keydown', done);
      document.addEventListener('mousedown', done);
      if (window.__TEST_MODE__) setTimeout(done, 400);
    });
    interludeText.classList.remove('show');
    interludeContinue.classList.remove('show');
    await new Promise((r) => setTimeout(r, 1200));
    interlude.classList.add('hidden');
  }

  hideInterlude() {
    this.el.interlude.classList.add('hidden');
    this.el.interludeText.classList.remove('show');
    this.el.interludeContinue.classList.remove('show');
  }

  // ---------- modality ----------

  _openModal(kind, el) {
    if (this._modal) this._closeModal(true);
    this._modal = kind;
    el.classList.remove('hidden');
    this.setPrompt(null);
    this.onModalChange?.(true);
  }

  _closeModal(silent = false) {
    if (!this._modal) return;
    const kind = this._modal;
    this._modal = null;
    this.el.noteOverlay.classList.add('hidden');
    this.el.journal.classList.add('hidden');
    this.el.keypad.classList.add('hidden');
    if (kind === 'keypad') {
      const st = this._keypadState;
      this._keypadState = null;
      if (!silent) st?.onCancel?.();
    }
    if (kind === 'note' && !silent) {
      const cb = this._noteClose;
      this._noteClose = null;
      cb?.();
    }
    this.onModalChange?.(false);
  }

  _closeNote() { this._closeModal(); }

  _onKey(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'KeyJ') {
      if (this._modal === null || this._modal === 'journal') this.toggleJournal();
      return;
    }
    if (!this._modal) return;
    if ((e.code === 'KeyE' && this._modal !== 'keypad') || e.code === 'Enter' || e.code === 'Space') {
      if (this._modal === 'note') this._closeNote();
    } else if (e.code === 'Escape') {
      this._closeModal();
    } else if (this._modal === 'keypad' && /^(Digit|Numpad)\d$/.test(e.code)) {
      this._keypadPress(e.code.slice(-1));
    } else if (this._modal === 'keypad' && e.code === 'Backspace') {
      this._keypadPress(null);
    } else if (this._modal === 'keypad' && /^Key[A-Z]$/.test(e.code)) {
      this._keypadPress(e.code.slice(-1));   // _keypadPress applies the keys whitelist
    }
  }
}
