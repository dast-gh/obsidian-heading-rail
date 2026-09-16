const { Plugin, MarkdownView, PluginSettingTab, Setting, Notice, Modal, Platform } = require('obsidian');

/* ---------------------------- строки интерфейса ---------------------------- */
// Один язык сейчас, но структура готова под добавление других:
// достаточно дописать соседний объект по образцу `en` и подключить его в LOCALES.
const LOCALES = {
  en: {
    tocTooltip: 'Note structure',
    trashTooltip: 'Section history',
    searchPlaceholder: 'Search structure',
    startOfDoc: 'Start of document',
    endOfDoc: 'End of document',
    jumpAboveLabel: 'Current position is above — show it',
    jumpBelowLabel: 'Current position is below — show it',
    delete: 'Delete',
    deleteN: (n) => 'Delete ' + n,
    copy: 'Copy',
    copyN: (n) => 'Copy ' + n,
    copyAgain: 'Copy again',
    copy: 'Copy',
    copyN: (n) => 'Copy ' + n,
    copyAgain: 'Copy again',
    cancel: 'Cancel',
    restore: 'Restore',
    forget: 'Forget',
    historyTitle: 'Section history',
    trashCopiedHead: 'Copied',
    trashCopiedEmpty: 'Nothing copied yet.',
    trashDeletedHead: 'Deleted',
    trashDeletedEmpty: 'Nothing deleted yet.',
    trashHint: 'Newest first. If the file was edited after a deletion, restore later entries first.',
    settingSearchName: 'Search field',
    settingSearchDesc: 'Show a search box next to the expanded structure.',
    settingSearchBottomName: 'Search at bottom',
    settingSearchBottomDesc: 'Swap places: search below the structure, structure on top.',
    settingTrashMaxName: 'Keep deletions',
    settingTrashMaxDesc: 'How many entries to keep in the deleted-sections list.',
    cmdDeleteSelected: 'Delete selected sections',
    cmdCopySelected: 'Copy selected sections',
    cmdCopySelected: 'Copy selected sections',
    cmdRestoreLast: 'Restore last deletion',
    noticeReadFail: 'Heading Rail: could not read the file',
    noticeStale: 'Structure is outdated — refresh the list and try again',
    noticeDeleted: (sections, lines) => 'Deleted sections: ' + sections + ', lines: ' + lines,
    noticeNothingToRestore: 'Nothing to restore',
    noticeFileNotFound: 'File not found',
    noticeReadFail2: 'Could not read the file',
    noticeChangedAfterDelete: 'The file changed after this deletion. Restore later entries first, or use Ctrl+Z.',
    noticeRestored: 'Deletion restored',
    noticeCopied: (sections, lines) => 'Copied sections: ' + sections + ', lines: ' + lines,
    noticeCopyFail: 'Could not copy to the clipboard',
    noticeCopied: (sections, lines) => 'Copied sections: ' + sections + ', lines: ' + lines,
    noticeCopyFail: 'Could not copy to the clipboard',
    noticeRestoreFail: (msg) => 'Could not restore: ' + msg,
    errWriteConflict: 'the file changed during the operation, please try again',
    noticeModifyFail: (msg) => 'Heading Rail: ' + (msg || 'could not modify the file'),
    consoleFallbackCss: '[Heading Rail] styles.css not found next to main.js — using the built-in copy.',
    consoleStyleCheckFail: '[Heading Rail] could not verify styles:',
    consoleBuildFail: '[Heading Rail] error while building the interface:',
    trashNoTitle: '(untitled)',
    trashMeta: (lines, path, when) => lines + ' lines · ' + path + ' · ' + when,
  },
};

// Язык интерфейса Obsidian, если доступен, иначе английский.
// Пока заполнен только en — при отсутствии перевода всегда используется он.
const CURRENT_LOCALE =
  (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('language')) || 'en';

function t(key, ...args) {
  const table = LOCALES[CURRENT_LOCALE] || LOCALES.en;
  const val = key in table ? table[key] : LOCALES.en[key];
  if (val === undefined) {
    // иначе отсутствующая строка молча рисуется пустотой, и поломку не видно
    console.warn('[Heading Rail] missing string:', key);
    return key;
  }
  return typeof val === 'function' ? val(...args) : val;
}


/* ---------- Настройки внешнего вида (можно править прямо здесь) ---------- */

const BASE_W = { 1: 36, 2: 27, 3: 20, 4: 15, 5: 11, 6: 9 };
const CAP_W = 10;         // базовая ширина торцевых полосок (верх/низ документа)

const ROW_H_MAX = 15;
const ROW_H_MIN = 7;
const HOVER_W = 56;
const MOBILE_HOVER_W = 36;   // на узком экране зона уже
const MOBILE_PAD_TOP = 14;   // отступ сверху на телефоне
const MOBILE_PAD_BOTTOM = 72; // отступ снизу: под панелью действий мобильного Obsidian
const MOBILE_DEPTH_SPAN = 170; // на сколько пикселей влево ведём палец до полной ширины
const MOBILE_DEPTH_MIN = 0.38; // отклик уже при касании у самого края, без ведения
const MOBILE_MAX_EXTRA = 115;  // предел прироста ширины на телефоне
const LONG_PRESS_MS = 450;   // удержание вместо правой кнопки
const TOUCH_SLOP = 10;       // сдвиг пальца, после которого это уже протяжка, а не удержание
const RAIL_WHEEL_BOOST = 3.2;  // во сколько раз колесо/жест над рельсом быстрее обычной прокрутки
const COL_GAP = 10;       // зазор между столбцами полосок
const RAIL_PAD_TOP = 26;   // отступ рельса сверху: с запасом под верхний указатель структуры (12px зазор + его высота)
const RAIL_PAD_BOTTOM = 34; // отступ снизу: под строкой состояния со счётчиком слов
const PANEL_W = 250;      // ширина раскрытой структуры
const SEARCH_H = 30;      // высота строки поиска
const SEARCH_GAP = 26;    // зазор между поиском и структурой (в нём живёт указатель)
const MAX_EXTRA = 62;
const SIGMA = 2.0;

const JUMP_MARGIN = 12;
const CENTER_RATIO = 0.5;
const MARKER_MIN_H = 6;   // минимальная высота бегунка видимой зоны структуры
const GROUP_LEAVE_DELAY = 90;  // мс: пауза перед выводом «мышь ушла с виджета»

const ANIM_MIN = 200;     // мс: минимальная длительность перехода
const ANIM_MAX = 800;     // мс: максимальная длительность перехода
const SETTLE_TRIES = 6;   // сколько раз доводить до точной позиции после анимации
const SETTLE_STEP = 50;   // мс между доводками
const SETTLE_EPS = 2;     // px: допустимая погрешность попадания
const UNDO_DEPTH = 5;       // сколько удалений можно откатить
const SCRUB_MAX_MS = 20000; // предохранитель: протяжка не может длиться дольше
const PANEL_LERP = 0.34;  // скорость подводки списка структуры
const SCRUB_LERP = 0.55;  // 1 = мгновенно; чуть меньше даёт незаметное сглаживание

/* ------------------------------------------------------------------------ */

const DEFAULT_SETTINGS = {
  showSearch: true,      // строка поиска над структурой
  searchAtBottom: false, // поменять местами: поиск снизу, структура сверху
  trashMax: 20,          // сколько удалений хранить в этой сессии (сбрасывается при перезапуске Obsidian)
};

class HeadingRailPlugin extends Plugin {
  async onload() {
    this.loadId = 'hr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addSettingTab(new HeadingRailSettingTab(this.app, this));
    this.isOpen = false;
    this.ctrlTemp = false;
    this.overRail = false;
    this.headings = [];
    this.stops = [];          // торцы + полоски заголовков единым списком
    this.panelItems = [];
    this.hostEl = null;
    this.railEl = null;
    this.sideEl = null;
    this.panelEl = null;
    if (this.panelRaf) { cancelAnimationFrame(this.panelRaf); this.panelRaf = null; }
    this.panelTarget = null;
    this.markerEls = null;
    this.itemTop = null;
    this.itemH = null;
    this.panelTarget = null;
    if (this.panelRaf) { cancelAnimationFrame(this.panelRaf); this.panelRaf = null; }
    this.menuEl = null;
    this.menuIdx = null;
    this.colEls = [];
    this.centers = null;
    this.filterActive = false;
    this.searchInput = null;
    this.panelListEl = null;
    this.markerEl = null;
    this.edgeTop = null;
    this.edgeBottom = null;
    this.pendingCenterIdx = null;
    this.currentFile = null;
    this.currentMode = null;
    this.scrollTarget = null;
    this.rowH = ROW_H_MAX;
    this.activeIndex = 0;
    this.lastSyncedIdx = -1;
    this.pinnedIdx = null;
    this.railHovered = false;
    this.panelHovered = false;
    this.leaveTimer = null;
    this.animId = null;
    this.settleTimer = null;
    this.dragging = false;
    this.spaceHeld = false;
    this.scrubTarget = null;
    this.scrubRaf = null;
    this.rafScroll = false;
    this.rafWave = false;
    this.rafMarker = false;
    this.pendingPointer = null;
    this.actionViews = new WeakSet();
    this.selected = new Set();
    this.anchorIdx = null;
    this.undoStack = [];
    this.copyStack = [];
    this.holdOpen = false;
    this.isMobile = this.detectMobile();
    this.kbOpen = false;

    this.onScroll = this.onScroll.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onDocMouseMove = this.onDocMouseMove.bind(this);
    this.onDocMouseUp = this.onDocMouseUp.bind(this);

    this.registerDomEvent(document, 'keydown', this.onKeyDown);
    this.registerDomEvent(document, 'keyup', this.onKeyUp);
    this.registerDomEvent(document, 'mousemove', this.onDocMouseMove);
    this.registerDomEvent(document, 'mouseup', this.onDocMouseUp);
    this.registerDomEvent(window, 'blur', () => {
      this.setCtrlTemp(false);
      this.spaceHeld = false;
      this.holdOpen = false;
      this.endScrub();
    });
    this.registerDomEvent(document, 'visibilitychange', () => {
      if (document.hidden) { this.spaceHeld = false; this.endScrub(); }
    });
    this.registerDomEvent(document, 'mouseleave', () => {
      if (this.dragging) this.endScrub();
    });

    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.refresh()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.refresh()));
    this.registerEvent(this.app.workspace.on('layout-change', () => this.refresh()));
    this.registerEvent(
      this.app.metadataCache.on('changed', (file) => {
        if (!this.currentFile || file.path !== this.currentFile.path) return;
        // с запасом по времени: пока идёт набор текста, перестраивать нечего
        if (this.metaTimer) clearTimeout(this.metaTimer);
        this.metaTimer = window.setTimeout(() => {
          this.metaTimer = null;
          this.refresh();
        }, 300);
      })
    );

    this.addCommand({
      id: 'delete-selected-sections',
      name: t('cmdDeleteSelected'),
      callback: () => this.deleteSelected(),
    });
    this.addCommand({
      id: 'copy-selected-sections',
      name: t('cmdCopySelected'),
      callback: () => this.copySelected(),
    });
    this.addCommand({
      id: 'restore-last-deletion',
      name: t('cmdRestoreLast'),
      callback: () => this.restoreLast(),
    });

    if (this.isMobile) this.registerMobileGlobals();

    this.app.workspace.onLayoutReady(() => this.refresh());
  }

  onunload() {
    // свои кнопки уносим с собой, иначе останутся мёртвыми в шапке заметки
    try {
      document.querySelectorAll('.hr-action-btn[data-hr-load="' + this.loadId + '"]')
        .forEach((b) => b.remove());
    } catch (e) { /* нечего убирать */ }
    this.cancelAnim();
    this.endScrub();
    this.teardown();
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    if (this.metaTimer) clearTimeout(this.metaTimer);
    if (this.fallbackStyleEl) this.fallbackStyleEl.remove();
  }

  /* --------------------- удаление разделов и откат --------------------- */

  // Сравнивать файлы дословно нельзя: Obsidian может поменять концы строк
  // или хвостовой перенос, и восстановление отказывало бы без причины
  normText(t) {
    return String(t).replace(/\r\n/g, '\n').replace(/\n+$/, '\n');
  }

  // Короткий отпечаток вместо копии файла целиком
  checksum(t) {
    const s2 = this.normText(t);
    let hash = 5381;
    for (let i = 0; i < s2.length; i++) hash = ((hash * 33) ^ s2.charCodeAt(i)) >>> 0;
    return hash + ':' + s2.length;
  }

  // Границы раздела: заголовок и всё под ним до следующего заголовка
  // того же или более высокого уровня. Вложенные подразделы входят внутрь.
  sectionRange(i, totalLines) {
    const level = this.headings[i].level;
    const from = this.headings[i].position.start.line;
    let to = totalLines - 1;
    for (let j = i + 1; j < this.headings.length; j++) {
      if (this.headings[j].level <= level) {
        to = this.headings[j].position.start.line - 1;
        break;
      }
    }
    return { from, to: Math.max(from, to) };
  }

  // Сколько вложенных подразделов попадёт под удаление вместе с выбранным
  nestedCount(i) {
    const level = this.headings[i].level;
    let n = 0;
    for (let j = i + 1; j < this.headings.length; j++) {
      if (this.headings[j].level <= level) break;
      n++;
    }
    return n;
  }

  // Объединяем выбранное: родитель может поглощать своих детей
  mergedRanges(totalLines) {
    const list = Array.from(this.selected)
      .sort((a, b) => a - b)
      .map((i) => this.sectionRange(i, totalLines));

    const out = [];
    for (const r of list) {
      const last = out[out.length - 1];
      if (last && r.from <= last.to + 1) last.to = Math.max(last.to, r.to);
      else out.push({ from: r.from, to: r.to });
    }
    return out;
  }

  // Положения заголовков берутся из разбора файла и могли устареть, если текст
  // правили после отрисовки. Работать по устаревшим номерам строк означало бы
  // тронуть чужой текст — поэтому сверяем перед любой операцией.
  linesMatchHeadings(lines) {
    for (const i of this.selected) {
      const h = this.headings[i];
      const line = lines[h.position.start.line];
      if (line === undefined || line.replace(/^#+\s*/, '').trim() !== h.heading.trim()) {
        new Notice(t('noticeStale'));
        this.hideItemMenu();
        this.refresh(true);
        return false;
      }
    }
    return true;
  }

  // Скопировать выбранные разделы целиком в буфер обмена
  async copySelected() {
    if (!this.selected.size || !this.currentFile) return;
    const file = this.currentFile;

    let content;
    try {
      content = await this.app.vault.read(file);
    } catch (e) {
      new Notice(t('noticeReadFail'));
      return;
    }

    const lines = content.split('\n');
    if (!this.linesMatchHeadings(lines)) return;

    const ranges = this.mergedRanges(lines.length);
    const parts = ranges.map((r) => lines.slice(r.from, r.to + 1).join('\n'));
    const text = parts.join('\n');
    const lineCount = ranges.reduce((sum, r) => sum + (r.to - r.from + 1), 0);

    if (!(await this.writeClipboard(text))) {
      new Notice(t('noticeCopyFail'));
      return;
    }

    const titles = Array.from(this.selected).sort((a, b) => a - b)
      .map((i) => this.headings[i].heading);

    this.copyStack.push({
      path: file.path,
      text,
      titles,
      lines: lineCount,
      time: Date.now(),
    });
    this.pruneTrash();

    const copied = this.selected.size;
    new Notice(t('noticeCopied', copied, lineCount));
  }

  // Повторно положить ранее скопированное в буфер
  async copyAgain(index) {
    const entry = this.copyStack[index];
    if (!entry) return false;
    if (await this.writeClipboard(entry.text)) {
      new Notice(t('noticeCopied', entry.titles.length, entry.lines));
      return true;
    }
    new Notice(t('noticeCopyFail'));
    return false;
  }

  // Запись в буфер обмена с запасными путями: браузерный интерфейс может быть
  // недоступен без действия пользователя, поэтому есть отход на средства Electron
  // и, в последнюю очередь, на старый способ через скрытое поле ввода.
  async writeClipboard(text) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* пробуем следующий способ */ }

    try {
      const electron = require('electron');
      if (electron && electron.clipboard) {
        electron.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* пробуем следующий способ */ }

    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  async deleteSelected(confirmed) {
    if (!this.selected.size || !this.currentFile) return;
    // подтверждением служит само меню; из палитры команд удаление явное
    if (confirmed !== true && confirmed !== undefined) return;
    const file = this.currentFile;

    let content;
    try {
      content = await this.app.vault.read(file);
    } catch (e) {
      new Notice(t('noticeReadFail'));
      return;
    }

    const lines = content.split('\n');
    if (!this.linesMatchHeadings(lines)) return;

    const ranges = this.mergedRanges(lines.length);
    const lineCount = ranges.reduce((sum, r) => sum + (r.to - r.from + 1), 0);

    // удаляем с конца, чтобы номера строк выше не сдвигались
    const next = lines.slice();
    for (let k = ranges.length - 1; k >= 0; k--) {
      next.splice(ranges[k].from, ranges[k].to - ranges[k].from + 1);
    }
    const after = next.join('\n');

    try {
      await this.writeFile(file, content, after);
    } catch (e) {
      new Notice(t('noticeModifyFail', e && e.message));
      return;
    }

    // Запоминаем только вырезанные куски и отпечаток результата,
    // а не копию всего файла
    const segments = ranges.map((r) => ({
      from: r.from,
      lines: lines.slice(r.from, r.to + 1),
    }));
    const titles = Array.from(this.selected).sort((a, b) => a - b)
      .map((i) => this.headings[i].heading);

    this.undoStack.push({
      path: file.path,
      segments,
      afterSum: this.checksum(after),
      titles,
      lines: lineCount,
      time: Date.now(),
    });
    this.pruneTrash();

    const removedSections = this.selected.size;
    this.selected.clear();
    this.anchorIdx = null;
    this.hideItemMenu();
    new Notice(t('noticeDeleted', removedSections, lineCount));
  }

  // Между чтением и записью человек может успеть напечатать. Обычная запись
  // затёрла бы набранное, поэтому пользуемся атомарным изменением, если оно есть.
  async writeFile(file, expected, next) {
    const vault = this.app.vault;
    if (typeof vault.process === 'function') {
      let clash = false;
      await vault.process(file, (current) => {
        if (this.normText(current) !== this.normText(expected)) { clash = true; return current; }
        return next;
      });
      if (clash) throw new Error(t('errWriteConflict'));
      return;
    }
    // старые версии Obsidian: перепроверяем прямо перед записью
    const current = await vault.read(file);
    if (this.normText(current) !== this.normText(expected)) {
      throw new Error(t('errWriteConflict'));
    }
    await vault.modify(file, next);
  }

  // Чистка истории удалений по количеству. Список живёт только в памяти
  // текущей сессии и в любом случае обнуляется при перезапуске Obsidian —
  // ограничение по дням тут не имело бы смысла и только вводило бы в заблуждение.
  pruneTrash() {
    const cfg = this.settings || DEFAULT_SETTINGS;
    const maxCount = Math.max(1, Number(cfg.trashMax) || UNDO_DEPTH);
    if (this.undoStack.length > maxCount) {
      this.undoStack = this.undoStack.slice(this.undoStack.length - maxCount);
    }
    if (this.copyStack.length > maxCount) {
      this.copyStack = this.copyStack.slice(this.copyStack.length - maxCount);
    }
  }

  async restoreLast() {
    return this.restoreAt(this.undoStack.length - 1);
  }

  async restoreAt(index) {
    const entry = this.undoStack[index];
    if (!entry) { new Notice(t('noticeNothingToRestore')); return false; }
    const file = this.app.vault.getAbstractFileByPath(entry.path);
    if (!file) { new Notice(t('noticeFileNotFound')); return false; }

    let current;
    try {
      current = await this.app.vault.read(file);
    } catch (e) {
      new Notice(t('noticeReadFail2'));
      return false;
    }

    // если после удаления файл успели изменить, возврат затёр бы правки
    if (this.checksum(current) !== entry.afterSum) {
      new Notice(t('noticeChangedAfterDelete'));
      return false;
    }

    // вставляем куски сверху вниз: каждый предыдущий возвращает смещение.
    // Пустой файл при разборе даёт одну мнимую пустую строку — её быть не должно,
    // иначе после возврата в конце появлялся лишний перенос.
    const lines = current === '' ? [] : current.split('\n');
    const ordered = entry.segments.slice().sort((a, b) => a.from - b.from);
    for (const seg of ordered) {
      lines.splice(seg.from, 0, ...seg.lines);
    }
    const before = lines.join('\n');

    try {
      await this.writeFile(file, current, before);
      this.undoStack.splice(index, 1);
      new Notice(t('noticeRestored'));
      return true;
    } catch (e) {
      new Notice(t('noticeRestoreFail', (e && e.message) || ''));
      return false;
    }
  }

  /* ------------------------------ стили ------------------------------ */

  ensureStyles() {
    if (this.stylesChecked) return;
    this.stylesChecked = true;
    try {
      const probe = document.createElement('div');
      probe.className = 'hr-rail';
      probe.style.visibility = 'hidden';
      document.body.appendChild(probe);
      const applied = getComputedStyle(probe).position === 'absolute';
      probe.remove();
      if (applied) return;

      const style = document.createElement('style');
      style.id = 'hr-fallback-styles';
      style.textContent = FALLBACK_CSS;
      document.head.appendChild(style);
      this.fallbackStyleEl = style;
      console.warn(t('consoleFallbackCss'));
    } catch (e) {
      console.error(t('consoleStyleCheckFail'), e);
    }
  }

  /* ------------------------------ жизненный цикл ------------------------------ */

  getView() {
    return this.app.workspace.getActiveViewOfType(MarkdownView);
  }

  teardown() {
    this.detachScroll();
    if (this.hostEl) {
      this.hostEl.classList.remove('hr-host', 'hr-panel-visible', 'hr-no-wave');
    }
    if (this.railEl) this.railEl.remove();
    if (this.sideEl) this.sideEl.remove();
    this.railEl = null;
    this.sideEl = null;
    this.panelEl = null;
    if (this.panelRaf) { cancelAnimationFrame(this.panelRaf); this.panelRaf = null; }
    this.panelTarget = null;
    this.markerEls = null;
    this.itemTop = null;
    this.itemH = null;
    this.panelTarget = null;
    if (this.panelRaf) { cancelAnimationFrame(this.panelRaf); this.panelRaf = null; }
    this.menuEl = null;
    this.menuIdx = null;
    this.colEls = [];
    this.centers = null;
    this.filterActive = false;
    this.searchInput = null;
    this.panelListEl = null;
    this.markerEl = null;
    this.edgeTop = null;
    this.edgeBottom = null;
    this.hostEl = null;
    this.stops = [];
    this.panelItems = [];
    this.lastSyncedIdx = -1;
  }

  refresh(force) {
    const view = this.getView();
    if (!view || !view.file) {
      this.cancelAnim();
      this.endScrub();
      this.teardown();
      this.currentFile = null;
      this.sig = null;
      return;
    }

    const cache = this.app.metadataCache.getFileCache(view.file);
    const heads = cache && cache.headings ? cache.headings : [];
    const host = view.containerEl.querySelector('.view-content') || view.containerEl;
    const mode = typeof view.getMode === 'function' ? view.getMode() : 'source';

    // Подпись состояния: пока она не изменилась, разметку трогать незачем.
    // Событий раскладки приходит много, поэтому сначала дешёвая проверка
    // «тот же самый список заголовков», и только затем подсчёт контрольной суммы —
    // раньше на каждое событие заново собиралась строка из всех заголовков.
    const geo = view.file.path + '|' + mode + '|' + Math.round((host.clientHeight || 0) / 8);
    let sig;
    if (heads === this.lastHeads && this.lastHeadsSig !== null && this.lastHeadsSig !== undefined) {
      sig = geo + '|' + this.lastHeadsSig;
    } else {
      let hash = 5381;
      for (let i = 0; i < heads.length; i++) {
        hash = ((hash * 33) ^ heads[i].level) >>> 0;
        const t = heads[i].heading;
        for (let k = 0; k < t.length; k++) hash = ((hash * 33) ^ t.charCodeAt(k)) >>> 0;
      }
      this.lastHeads = heads;
      this.lastHeadsSig = hash;
      sig = geo + '|' + hash;
    }

    if (!force && sig === this.sig && this.railEl && this.hostEl) {
      this.updateActive();
      return;
    }

    this.cancelAnim();
    this.endScrub();
    this.teardown();

    this.sig = sig;
    this.currentFile = view.file;
    this.ensureAction(view);
    this.headings = heads;
    this.activeApplied = false;
    this.prevActiveEls = null;
    this.selected.clear();
    this.anchorIdx = null;
    if (this.headings.length < 2) return;

    try {
      this.build(view);
      this.attachScroll(view);
      this.applyPanelState();
      this.updateActive();
    } catch (e) {
      console.error(t('consoleBuildFail'), e);
    }
  }

  ensureAction(view) {
    try {
      // Кнопки от прошлой загрузки плагина остаются в шапке заметки и выглядят
      // как дубликат, который ни на что не отвечает. Убираем чужие.
      view.containerEl.querySelectorAll('.hr-action-btn').forEach((btn) => {
        if (btn.dataset.hrLoad !== this.loadId) btn.remove();
      });

      if (view.containerEl.querySelector('.hr-action-btn[data-hr-load="' + this.loadId + '"]')) {
        this.actionViews.add(view);
        return;
      }

      const el = view.addAction('list', t('tocTooltip'), () => {
        this.isOpen = !this.isOpen;
        this.applyPanelState();
      });
      if (el) {
        el.addClass('hr-action-btn');
        el.dataset.hrLoad = this.loadId;
      }

      const trash = view.addAction('rotate-ccw', t('trashTooltip'), () => {
        new HeadingRailTrashModal(this.app, this).open();
      });
      if (trash) {
        trash.addClass('hr-action-btn');
        trash.addClass('hr-trash-btn');
        trash.dataset.hrLoad = this.loadId;
      }

      this.actionViews.add(view);
    } catch (e) {
      /* без кнопок — остальное работает */
    }
  }

  /* --------------------------------- разметка -------------------------------- */

  build(view) {
    this.ensureStyles();
    // класс мобильного приложения мог появиться уже после запуска плагина
    this.isMobile = this.detectMobile();

    const host = view.containerEl.querySelector('.view-content') || view.containerEl;
    this.hostEl = host;
    host.classList.add('hr-host');
    host.classList.toggle('hr-mobile', this.isMobile);
    host.classList.toggle('hr-kb', !!this.kbOpen);
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    // ---------- раскладка: один столбец или несколько ----------
    const n = this.headings.length;
    const padTop = this.isMobile ? MOBILE_PAD_TOP : RAIL_PAD_TOP;
    const padBottom = this.isMobile ? MOBILE_PAD_BOTTOM : RAIL_PAD_BOTTOM;
    const usable = Math.max(120, host.clientHeight - padTop - padBottom);
    const slotCount = n + 2;                    // заголовки плюс два торца
    let rowH = usable / slotCount;
    let multi = false;
    let perCol = slotCount;

    if (rowH < ROW_H_MIN) {
      // ужимать дальше некуда — раскладываем в несколько столбцов
      multi = true;
      rowH = ROW_H_MIN;
      perCol = Math.max(3, Math.floor(usable / ROW_H_MIN));
    } else {
      rowH = Math.min(ROW_H_MAX, rowH);
    }
    this.rowH = rowH;
    this.multi = multi;

    const colCount = multi ? Math.ceil(slotCount / perCol) : 1;
    this.colCount = colCount;

    const HW = this.isMobile ? MOBILE_HOVER_W : HOVER_W;
    const rail = host.createDiv({ cls: 'hr-rail' });
    rail.style.setProperty('--hr-hover-w', HW + 'px');
    rail.style.top = padTop + 'px';
    rail.style.bottom = padBottom + 'px';
    // структура центруется по рельсу, а он смещён вверх — компенсируем
    host.style.setProperty('--hr-center-offset', ((padTop - padBottom) / 2) + 'px');
    rail.classList.toggle('hr-multi', multi);
    this.railEl = rail;
    this.stops = [];
    this.colEls = [];

    const railW = colCount * HW + (colCount - 1) * COL_GAP;
    host.style.setProperty('--hr-rail-w', railW + 'px');
    host.style.setProperty('--hr-push', (railW + 8 + PANEL_W + 16) + 'px');

    // список мест: торец начала, заголовки, торец конца
    const slots = [{ kind: 'top' }]
      .concat(this.headings.map((h, i) => ({ kind: 'h', hIdx: i })))
      .concat([{ kind: 'bottom' }]);

    let colEl = null;
    let inCol = 0;
    let colIdx = -1;

    const newCol = () => {
      colIdx++;
      inCol = 0;
      colEl = rail.createDiv({ cls: 'hr-col' });
      colEl.style.width = HW + 'px';
      this.colEls.push(colEl);
      return colEl;
    };
    newCol();

    slots.forEach((slot, si) => {
      if (multi && inCol >= perCol) newCol();
      const isLastSlot = si === slots.length - 1;

      if (slot.kind === 'h') {
        this.addRow(colEl, slot.hIdx, colIdx, rowH);
      } else {
        // торец начала — над левым столбцом, торец конца — под последней полоской правого
        const stretch = !multi || (slot.kind === 'bottom' && isLastSlot);
        this.addCap(colEl, slot.kind, colIdx, stretch ? null : rowH);
      }
      inCol++;
    });

    this.cacheCenters();

    if (!this.isMobile) {
      rail.addEventListener('mouseenter', () => { this.railHovered = true; this.onGroupEnter(); });
      rail.addEventListener('mouseleave', () => { this.railHovered = false; this.scheduleGroupLeave(); });
    } else {
      // протяжка пальцем вдоль рельса — основной способ листать на телефоне
      rail.addEventListener('touchmove', (e) => this.touchMove(e, true), { passive: false });
      rail.addEventListener('touchend', () => this.touchEnd(), { passive: true });
      rail.addEventListener('touchcancel', () => this.touchEnd(), { passive: true });
    }
    if (!this.isMobile) rail.addEventListener('mousemove', (e) => {
      // волна обновляется всегда, в том числе во время протяжки —
      // иначе широкой остаётся та полоска, с которой начали
      this.queueWave(e);
      if (this.dragging || this.spaceHeld) this.scrubTo(e.clientY, e.clientX);
    });

    // протяжка: зажать кнопку и вести — документ едет вместе с курсором
    if (!this.isMobile) rail.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.ctrlKey || e.metaKey) return;   // это Ctrl+клик, а не протяжка
      e.preventDefault();
      this.dragging = true;
      this.movedWhileDown = false;
      this.downY = e.clientY;
      this.scrubTo(e.clientY, e.clientX);
    });

    if (!this.isMobile) rail.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.isOpen = !this.isOpen;
      this.applyPanelState();
    });

    rail.addEventListener('wheel', (e) => {
      if (this.isPanelVisible() && this.panelListEl) {
        e.preventDefault();
        e.stopPropagation();
        this.panelTarget = null;
        this.panelListEl.scrollTop += e.deltaY;
        return;
      }
      // Структура свёрнута — колесо над рельсом крутит сам документ,
      // но заметно быстрее обычного: удобно долистывать длинные заметки,
      // не уводя курсор на сам текст.
      if (this.scrollTarget) {
        e.preventDefault();
        e.stopPropagation();
        this.cancelAnim();
        this.pinnedIdx = null;
        const max = Math.max(0, this.scrollTarget.scrollHeight - this.scrollTarget.clientHeight);
        const next = this.scrollTarget.scrollTop + e.deltaY * RAIL_WHEEL_BOOST;
        this.scrollTarget.scrollTop = Math.max(0, Math.min(max, next));
      }
    }, { passive: false });

    /* --- обёртка: поиск и структура --- */
    const side = host.createDiv({ cls: 'hr-side' });
    this.sideEl = side;
    side.classList.toggle('hr-search-bottom', !!this.settings.searchAtBottom);

    // высота ограничена размахом полосок: от верхней до нижней
    // Предел высоты — вся свободная высота рельса, а не размах полосок.
    // Привязка к полоскам зажимала структуру на коротких заметках: полосок мало,
    // размах крошечный, и список сжимался до пары строк. Теперь верх и низ
    // структуры могут выходить за крайние полоски, и центровка не ломается.
    host.style.setProperty('--hr-span', usable + 'px');

    if (this.settings.showSearch) {
      const search = side.createDiv({ cls: 'hr-search' });
      const input = search.createEl('input', { cls: 'hr-search-input' });
      input.setAttr('type', 'text');
      input.setAttr('placeholder', t('searchPlaceholder'));
      input.addEventListener('input', () => this.applyFilter(input.value));
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();            // набор текста не должен трогать навигацию
        if (e.key === 'Escape') { input.value = ''; this.applyFilter(''); }
      });
      this.searchInput = input;
    }

    const panel = side.createDiv({ cls: 'hr-panel' });
    this.panelEl = panel;

    const list = panel.createDiv({ cls: 'hr-panel-list' });
    this.panelListEl = list;
    this.panelItems = [];

    this.headings.forEach((h, idx) => {
      const item = list.createDiv({ cls: 'hr-panel-item hr-lvl-' + h.level });
      item.setText(h.heading);
      item.addEventListener('click', (e) => {
        if (this.suppressTap) return;   // это было удержание

        // На телефоне нет Shift и Alt: пока есть выбранное, тап добавляет
        // и убирает пункты из выбора, а не переходит по документу.
        if (this.isMobile) {
          if (this.selected.size) {
            if (this.selected.has(idx)) this.selected.delete(idx);
            else this.selected.add(idx);
            this.renderSelection();
            if (this.selected.size) this.showItemMenu(idx);
            return;
          }
          this.animateScrollTo(this.stopOfHeading(idx));
          return;
        }

        // по нажатию на уже выделенную группу показываем действия,
        // а не переходим — выбор при этом сохраняется
        if (!e.shiftKey && !e.altKey && this.selected.size > 1 && this.selected.has(idx)) {
          e.preventDefault();
          this.showItemMenu(idx);
          return;
        }
        this.hideItemMenu();

        if (e.shiftKey && this.anchorIdx !== null) {
          // Shift — выделить диапазон от опорного пункта
          e.preventDefault();
          const a = Math.min(this.anchorIdx, idx);
          const b = Math.max(this.anchorIdx, idx);
          this.selected.clear();
          for (let k = a; k <= b; k++) {
            // при активном поиске между краями диапазона есть скрытые пункты:
            // выделять их нельзя, иначе удалилось бы больше, чем человек видит
            if (this.panelItems[k] && this.panelItems[k].classList.contains('hr-hidden')) continue;
            this.selected.add(k);
          }
          this.renderSelection();
          return;
        }
        if (e.altKey) {
          // Alt — добавить или убрать один пункт
          e.preventDefault();
          if (this.selected.has(idx)) this.selected.delete(idx);
          else this.selected.add(idx);
          this.anchorIdx = idx;
          this.renderSelection();
          return;
        }

        // Обычный клик — только переход. Серая рамка выделения появляется
        // по правой кнопке, Shift и Alt: она означает «выбрано для действия»,
        // а не «здесь я сейчас нахожусь».
        this.selected.clear();
        this.anchorIdx = idx;
        this.renderSelection();
        this.animateScrollTo(this.stopOfHeading(idx));
      });
      const openActions = () => {
        // если пункт не был выбран, выбираем только его;
        // выделенную группу сохраняем как есть
        if (!this.selected.has(idx)) {
          this.selected.clear();
          this.selected.add(idx);
          this.anchorIdx = idx;
          this.renderSelection();
        }
        this.showItemMenu(idx);
      };

      if (this.isMobile) {
        item.addEventListener('touchstart', (e) => this.touchStart(e, openActions), { passive: true });
        item.addEventListener('touchmove', (e) => this.touchMove(e, false), { passive: true });
        item.addEventListener('touchend', () => this.touchEnd(), { passive: true });
        item.addEventListener('touchcancel', () => this.touchEnd(), { passive: true });
      } else {
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openActions();
        });
        item.addEventListener('mouseenter', () => this.setRailHover(idx));
        item.addEventListener('mouseleave', () => this.setRailHover(-1));
      }
      this.panelItems.push(item);
    });

    panel.addEventListener('wheel', (e) => {
      if (!this.panelListEl) return;
      e.stopPropagation();
      this.panelTarget = null;
      const before = this.panelListEl.scrollTop;
      this.panelListEl.scrollTop += e.deltaY;
      if (this.panelListEl.scrollTop !== before) e.preventDefault();
    }, { passive: false });

    this.menuEl = panel.createDiv({ cls: 'hr-item-menu' });
    this.menuEl.addEventListener('mouseleave', () => {
      if (this.menuEl && this.menuEl.classList.contains('is-ghost')) {
        this.holdOpen = false;
        this.hideItemMenu();
        // не полагаемся на то, что браузер отдельно сообщит об уходе с панели:
        // проверяем сами, а проверка сама же и отменится, если курсор внутри
        this.scheduleGroupLeave();
      }
    });

    this.edgeTop = panel.createDiv({ cls: 'hr-edge hr-edge-top' });
    this.edgeBottom = panel.createDiv({ cls: 'hr-edge hr-edge-bottom' });
    this.edgeTop.setAttr('aria-label', t('jumpAboveLabel'));
    this.edgeBottom.setAttr('aria-label', t('jumpBelowLabel'));
    this.edgeTop.addEventListener('click', () => this.syncPanelTo(this.activeIndex, true));
    this.edgeBottom.addEventListener('click', () => this.syncPanelTo(this.activeIndex, true));

    side.addEventListener('mouseenter', () => { this.panelHovered = true; this.onGroupEnter(); });
    side.addEventListener('mouseleave', () => { this.panelHovered = false; this.scheduleGroupLeave(); });

    // по бегунку на столбец: видимая зона структуры делится между ними
    this.markerEls = this.colEls.map((c) => {
      const m = c.createDiv({ cls: 'hr-marker' });
      m.style.height = MARKER_MIN_H + 'px';
      return m;
    });

    window.setTimeout(() => { this.cacheItemMetrics(); this.updateMarker(); }, 0);

    list.addEventListener('scroll', () => {
      if (this.rafMarker) return;
      this.rafMarker = true;
      requestAnimationFrame(() => {
        this.rafMarker = false;
        this.updateMarker();
        this.updateEdges();
        this.positionItemMenu();
      });
    }, { passive: true });
  }

  // Полоска одного заголовка
  addRow(colEl, hIdx, colIdx, rowH) {
    const h = this.headings[hIdx];
    const row = colEl.createDiv({ cls: 'hr-row' });
    row.style.height = rowH + 'px';

    const bar = row.createDiv({ cls: 'hr-bar' });
    const w = BASE_W[h.level] || 8;
    bar.style.setProperty('--hr-base-w', w + 'px');
    bar.style.width = w + 'px';
    bar.setAttr('aria-label', h.heading);

    const stopI = this.stops.length;

    if (!this.isMobile) {
      row.addEventListener('mouseenter', () => {
        row.addClass('is-hover');
        this.setPanelHover(hIdx);
        if (!this.dragging && !this.spaceHeld) this.syncPanelTo(hIdx);
      });
      row.addEventListener('mouseleave', () => {
        row.removeClass('is-hover');
        this.setPanelHover(-1);
      });
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.togglePanelAt(hIdx);
      });
    }

    row.addEventListener('click', () => {
      if (this.movedWhileDown) return;
      if (this.suppressTap) return;   // это было удержание или протяжка пальцем
      // Ctrl здесь намеренно не обрабатывается: пока клавиша удерживается,
      // структура показана временно, и клик должен просто выбирать место
      this.animateScrollTo(stopI);
    });

    if (this.isMobile) {
      // Удержание заменяет правую кнопку, движение пальцем — протяжку
      row.addEventListener('touchstart', (e) => this.touchStart(e, () => this.togglePanelAt(hIdx)),
        { passive: true });
    }

    this.stops.push({ el: row, bar, kind: 'h', hIdx, baseW: w, col: colIdx });
  }

  // Торец: начало или конец документа
  addCap(colEl, kind, colIdx, fixedH) {
    const cap = colEl.createDiv({ cls: 'hr-end hr-end-' + kind });
    if (fixedH !== null && fixedH !== undefined) {
      cap.style.height = fixedH + 'px';
      cap.style.flex = '0 0 auto';
    }
    const bar = cap.createDiv({ cls: 'hr-cap-bar' });
    bar.style.setProperty('--hr-base-w', CAP_W + 'px');
    bar.style.width = CAP_W + 'px';
    bar.setAttr('aria-label', kind === 'top' ? t('startOfDoc') : t('endOfDoc'));

    const stopI = this.stops.length;
    cap.addEventListener('click', () => {
      if (this.movedWhileDown) return;
      this.animateScrollTo(stopI);
    });

    this.stops.push({ el: cap, bar, kind, hIdx: -1, baseW: CAP_W, col: colIdx });
  }

  stopOfHeading(hIdx) {
    for (let i = 0; i < this.stops.length; i++) {
      if (this.stops[i].kind === 'h' && this.stops[i].hIdx === hIdx) return i;
    }
    return 0;
  }

  /* --------------------------- геометрия остановок --------------------------- */

  // Центр берём у самой видимой полоски: у торцов зона огромная,
  // и её середина не совпала бы с положением линии
  stopCenter(i) {
    if (this.centers && this.centers[i] !== undefined) return this.centers[i];
    const bar = this.stops[i].bar;
    return bar.offsetTop + bar.offsetHeight / 2;
  }

  // Центры считаются один раз после построения: при прокрутке они не меняются,
  // а замер в каждом кадре заставлял браузер пересчитывать раскладку
  cacheCenters() {
    this.centers = this.stops.map((st) => st.bar.offsetTop + st.bar.offsetHeight / 2);
  }

  // Какой столбец под курсором. Если курсор ушёл вбок (протяжка) — держим прежний.
  colAtClientX(clientX) {
    if (!this.colEls || this.colEls.length < 2) return 0;
    if (clientX === undefined || clientX === null) return this.activeCol || 0;
    let best = this.activeCol || 0;
    let bestD = Infinity;
    for (let c = 0; c < this.colEls.length; c++) {
      const r = this.colEls[c].getBoundingClientRect();
      const d = clientX < r.left ? r.left - clientX : (clientX > r.right ? clientX - r.right : 0);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  // Ближайшая остановка: сначала столбец по горизонтали, потом полоска по вертикали
  stopAtClientY(clientY, clientX) {
    const rect = this.railEl.getBoundingClientRect();
    const y = clientY - rect.top;
    const col = this.colAtClientX(clientX);
    this.activeCol = col;

    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.stops.length; i++) {
      if (this.stops[i].col !== col) continue;
      const d = Math.abs(this.stopCenter(i) - y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best === -1) {
      for (let i = 0; i < this.stops.length; i++) {
        const d = Math.abs(this.stopCenter(i) - y);
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    return best;
  }

  // Куда прокручивать документ для данной остановки
  targetScrollFor(i) {
    const st = this.scrollTarget;
    const stop = this.stops[i];
    if (!st || !stop) return null;

    const max = Math.max(0, st.scrollHeight - st.clientHeight);
    if (stop.kind === 'top') return 0;
    if (stop.kind === 'bottom') return max;

    const own = !this.measureRect;
    if (own) this.beginMeasure();
    const top = this.headingTop(stop.hIdx);
    if (own) this.endMeasure();

    if (top === null) return null;
    return Math.max(0, Math.min(max, top - JUMP_MARGIN));
  }

  /* ------------------------------- волна на hover ------------------------------ */

  queueWave(e) {
    if (this.isOpen) return;
    this.pendingPointer = { x: e.clientX, y: e.clientY };
    if (this.rafWave) return;
    this.rafWave = true;
    requestAnimationFrame(() => {
      this.rafWave = false;
      this.applyWave();
    });
  }

  applyWave() {
    if (!this.railEl || !this.pendingPointer) return;
    // В закреплённом режиме ширина фиксирована: не пересчитываем её здесь,
    // вместо того чтобы потом перебивать результат из стилей.
    if (this.isOpen) return;
    const { x, y } = this.pendingPointer;

    const col = this.colAtClientX(x);
    this.activeCol = col;
    const colRect = this.colEls[col].getBoundingClientRect();
    const railRect = this.railEl.getBoundingClientRect();

    // На компьютере сила волны считается по ширине узкой зоны наведения.
    // На телефоне так нельзя: палец прижат к краю экрана и всегда давал бы ноль.
    // Поэтому отсчёт идёт от края рельса на заметно большем расстоянии —
    // ведя пальцем влево, можно плавно наращивать ширину до предела.
    let depth;
    if (this.isMobile) {
      const frac = Math.max(0, Math.min(1, (railRect.right - x) / MOBILE_DEPTH_SPAN));
      depth = MOBILE_DEPTH_MIN + (1 - MOBILE_DEPTH_MIN) * frac;
    } else {
      depth = Math.max(0, Math.min(1, (colRect.right - x) / colRect.width));
    }
    const maxExtra = this.isMobile ? MOBILE_MAX_EXTRA : MAX_EXTRA;
    const yLocal = y - railRect.top;
    const span = this.rowH * SIGMA;

    // Затухание за пределами нескольких строк неразличимо, поэтому трогаем
    // только ближние полоски, а ранее задетые возвращаем к базовой ширине.
    const reach = span * 3;
    const touched = [];

    for (let i = 0; i < this.stops.length; i++) {
      const stop = this.stops[i];
      // волна живёт только в том столбце, где курсор — иначе соседние
      // столбцы расширялись бы «за компанию» и лезли в зазор
      if (stop.col !== col) continue;
      const dist = this.stopCenter(i) - yLocal;
      if (Math.abs(dist) > reach) continue;

      const falloff = Math.exp(-(dist / span) * (dist / span));
      stop.bar.style.width = (stop.baseW + maxExtra * depth * falloff) + 'px';
      touched.push(i);
    }

    if (this.waveTouched) {
      const now = new Set(touched);
      for (const i of this.waveTouched) {
        if (!now.has(i)) this.stops[i].bar.style.width = this.stops[i].baseW + 'px';
      }
    }
    this.waveTouched = touched;
  }

  resetWave() {
    for (const stop of this.stops) stop.bar.style.width = stop.baseW + 'px';
    this.waveTouched = null;
    this.pendingPointer = null;
  }

  /* ------------------ протяжка: документ едет вместе с курсором ------------------ */

  scrubTo(clientY, clientX) {
    if (!this.stops.length || !this.scrollTarget) return;
    this.cancelAnim();

    const i = this.stopAtClientY(clientY, clientX);
    this.scrubStop = i;
    const stop = this.stops[i];
    if (stop.kind === 'h') {
      this.setActive(stop.hIdx);
      this.syncPanelTo(stop.hIdx);
    }

    if (this.scrubRaf === null || this.scrubRaf === undefined) this.runScrub();
  }

  runScrub() {
    // Защита от вечного вращения. Цикл мог не остановиться никогда в двух случаях:
    // кнопку отпустили за пределами окна (флаг протяжки оставался включённым)
    // или цель недостижима (документ упёрся в край, и разница не убывала).
    // Оба варианта непрерывно грузили процессор.
    const startedAt = Date.now();
    let stuckFrames = 0;
    let lastTop = null;

    const step = () => {
      if (!this.scrollTarget || this.scrubStop === undefined) { this.scrubRaf = null; return; }
      const target = this.targetScrollFor(this.scrubStop);
      if (target === null) { this.scrubRaf = null; return; }

      const st = this.scrollTarget;
      const diff = target - st.scrollTop;
      st.scrollTop = Math.abs(diff) < 1 ? target : st.scrollTop + diff * SCRUB_LERP;

      // прокрутка не сдвинулась — дальше ехать некуда
      if (lastTop !== null && Math.abs(st.scrollTop - lastTop) < 0.5) stuckFrames++;
      else stuckFrames = 0;
      lastTop = st.scrollTop;

      const holding = this.dragging || this.spaceHeld;
      const timedOut = Date.now() - startedAt > SCRUB_MAX_MS;

      if (stuckFrames > 12 || timedOut) {
        this.scrubRaf = null;
        if (timedOut) this.endScrub();
        return;
      }

      if (holding || Math.abs(diff) >= 1) {
        this.scrubRaf = requestAnimationFrame(step);
      } else {
        this.scrubRaf = null;
        this.settle(this.scrubStop, 0);
      }
    };
    this.scrubRaf = requestAnimationFrame(step);
  }

  endScrub() {
    const wasActive = this.dragging || this.spaceHeld;
    this.dragging = false;
    if (this.scrubRaf) { cancelAnimationFrame(this.scrubRaf); this.scrubRaf = null; }
    if (wasActive && this.scrubStop !== undefined) {
      const stop = this.stops[this.scrubStop];
      if (stop) {
        this.pinnedIdx = stop.kind === 'h' ? stop.hIdx : null;
        this.settle(this.scrubStop, 0);
      }
    }
  }

  onDocMouseMove(e) {
    if (this.holdOpen) {
      const inside = this.pointerInsideWidget(e.clientX, e.clientY);
      if (!inside) {
        this.holdOpen = false;
        this.scheduleGroupLeave();
      }
    }
    if (!this.dragging) return;
    // кнопку могли отпустить за пределами окна — событие отпускания не придёт
    if (e.buttons === 0) { this.endScrub(); return; }
    if (Math.abs(e.clientY - this.downY) > 3) this.movedWhileDown = true;
    this.queueWave(e);   // курсор мог уйти вбок от рельса — волна всё равно следует за ним
    this.scrubTo(e.clientY, e.clientX);
  }

  onDocMouseUp() {
    if (!this.dragging) return;
    this.endScrub();
    window.setTimeout(() => { this.movedWhileDown = false; }, 0);
  }

  /* --------------- переход к остановке: своя анимация с пересчётом --------------- */

  cancelAnim() {
    if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
    if (this.settleTimer) { clearTimeout(this.settleTimer); this.settleTimer = null; }
  }

  animateScrollTo(stopI) {
    const st = this.scrollTarget;
    if (!st || !this.stops[stopI]) return;

    this.cancelAnim();
    const start = st.scrollTop;
    const first = this.targetScrollFor(stopI);
    if (first === null) return;

    const dur = Math.min(ANIM_MAX, Math.max(ANIM_MIN, Math.abs(first - start) * 0.35));
    const t0 = performance.now();

    const stop = this.stops[stopI];
    if (stop.kind === 'h') {
      this.pinnedIdx = stop.hIdx;
      this.setActive(stop.hIdx);
      this.syncPanelTo(stop.hIdx, true);   // подвести выбранный раздел к центру структуры
    } else {
      this.pinnedIdx = null;
    }

    const step = (now) => {
      // цель пересчитывается каждый кадр: пока документ дорисовывается,
      // реальная позиция заголовка уточняется, и анимация едет уже к ней
      const target = this.targetScrollFor(stopI);
      if (target === null) { this.animId = null; return; }

      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      st.scrollTop = start + (target - start) * eased;

      if (p < 1) {
        this.animId = requestAnimationFrame(step);
      } else {
        this.animId = null;
        this.settle(stopI, 0);
      }
    };

    this.animId = requestAnimationFrame(step);
  }

  // Доводка: после анимации сверяемся с целью ещё несколько раз.
  // Именно это гарантирует попадание, даже если высота контента уточнилась в пути.
  settle(stopI, tries) {
    if (this.settleTimer) { clearTimeout(this.settleTimer); this.settleTimer = null; }
    if (tries >= SETTLE_TRIES) return;

    this.settleTimer = window.setTimeout(() => {
      this.settleTimer = null;
      const st = this.scrollTarget;
      if (!st || this.dragging || this.spaceHeld || this.animId) return;

      const target = this.targetScrollFor(stopI);
      if (target === null) return;

      if (Math.abs(st.scrollTop - target) > SETTLE_EPS) {
        st.scrollTop = target;
        this.settle(stopI, tries + 1);
      }
    }, SETTLE_STEP);
  }

  /* --------------------------------- панель ---------------------------------- */

  isPanelVisible() {
    return this.isOpen || (this.ctrlTemp && this.overRail);
  }

  // Курсор в пределах рельса или раскрытой структуры
  pointerInsideWidget(x, y) {
    const boxes = [];
    if (this.railEl) boxes.push(this.railEl.getBoundingClientRect());
    if (this.sideEl && this.isPanelVisible()) boxes.push(this.sideEl.getBoundingClientRect());
    for (const r of boxes) {
      if (x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12) return true;
    }
    return false;
  }

  onGroupEnter() {
    if (this.leaveTimer) { clearTimeout(this.leaveTimer); this.leaveTimer = null; }
    this.overRail = true;
    this.applyPanelState();
  }

  scheduleGroupLeave() {
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = window.setTimeout(() => {
      this.leaveTimer = null;
      if (this.railHovered || this.panelHovered) return;
      if (this.dragging) return;   // тянем — курсор мог уйти вбок, это не уход
      // Нажатая кнопка меню исчезает прямо из-под курсора, и браузер сообщает
      // об уходе мыши, хотя пользователь ничего никуда не уводил. Держим открытым
      // до настоящего движения мыши в сторону — см. onDocMouseMove.
      if (this.holdOpen) return;

      this.overRail = false;
      this.resetWave();
      this.setPanelHover(-1);
      this.setRailHover(-1);
      this.hideItemMenu();
      this.applyPanelState();
      // структура остаётся там, где её оставили: вместо отката появляются
      // указатели у края, если активное место ушло за пределы видимой зоны
      this.updateEdges();
    }, GROUP_LEAVE_DELAY);
  }

  renderSelection() {
    this.panelItems.forEach((it, i) => it.classList.toggle('is-selected', this.selected.has(i)));
    if (!this.selected.size) this.hideItemMenu();
  }

  // Прокрутка структуры своей анимацией. Штатная плавная прокрутка при каждом
  // новом наведении начиналась заново и не догоняла быстрое движение мыши;
  // здесь повторный вызов лишь меняет цель, а движение не прерывается.
  panelScrollTo(top) {
    const list = this.panelListEl;
    if (!list) return;

    const max = Math.max(0, list.scrollHeight - list.clientHeight);
    this.panelTarget = Math.max(0, Math.min(max, top));

    if (this.panelRaf) return;

    let stuck = 0;
    let last = null;
    const step = () => {
      const el = this.panelListEl;
      if (!el || this.panelTarget === null) { this.panelRaf = null; return; }

      const diff = this.panelTarget - el.scrollTop;
      if (Math.abs(diff) < 0.5) {
        el.scrollTop = this.panelTarget;
        this.panelRaf = null;
        return;
      }
      el.scrollTop = el.scrollTop + diff * PANEL_LERP;

      // цель может быть недостижима — не крутим цикл впустую
      if (last !== null && Math.abs(el.scrollTop - last) < 0.1) stuck++;
      else stuck = 0;
      last = el.scrollTop;
      if (stuck > 6) { this.panelRaf = null; return; }

      this.panelRaf = requestAnimationFrame(step);
    };
    this.panelRaf = requestAnimationFrame(step);
  }

  /* ------------------------- касания (только телефон) ------------------------- */

  // Полагаться на один признак оказалось ненадёжно: если он недоступен,
  // весь мобильный код молча не включался и телефон вёл себя как компьютер.
  // Поэтому проверяем несколькими способами, включая класс, который сам
  // Obsidian вешает на страницу в мобильном приложении.
  detectMobile() {
    try {
      if (typeof Platform !== 'undefined' && Platform) {
        if (Platform.isMobile === true) return true;
        if (Platform.isMobileApp === true) return true;
        if (Platform.isPhone === true || Platform.isTablet === true) return true;
      }
    } catch (e) { /* признак недоступен — пробуем следующий */ }

    try {
      if (document.body && document.body.classList.contains('is-mobile')) return true;
    } catch (e) { /* и этот недоступен */ }

    return false;
  }


  registerMobileGlobals() {
    // Касание мимо структуры сворачивает её — привычное поведение на телефоне
    this.registerDomEvent(document, 'touchstart', (e) => {
      if (!this.isOpen) return;
      const t = e.touches && e.touches[0];
      if (!t) return;
      if (this.pointInside(this.sideEl, t.clientX, t.clientY)) return;
      if (this.pointInside(this.railEl, t.clientX, t.clientY)) return;  // рельс живёт своей жизнью
      this.isOpen = false;
      this.clearSelection();
      this.applyPanelState();
    }, { passive: true });

    // Появление клавиатуры ужимает видимую часть экрана. Раньше рельс просто
    // пересчитывался под остаток высоты, и полоски слипались в сплошную линию —
    // вместо этого убираем его целиком, пока клавиатура открыта.
    const vv = window.visualViewport;
    if (vv) {
      this.registerDomEvent(vv, 'resize', () => {
        const open = vv.height < window.innerHeight * 0.75;
        if (open === this.kbOpen) return;
        this.kbOpen = open;
        if (this.hostEl) this.hostEl.classList.toggle('hr-kb', open);

        if (open) {
          // если печатают в нашем же поиске, структуру оставляем — он сам вызвал клавиатуру
          const typingInSearch = this.searchInput && document.activeElement === this.searchInput;
          if (this.isOpen && !typingInSearch) {
            this.isOpen = false;
            this.applyPanelState();
          }
        } else {
          // высота вернулась — пересобираем под полный экран
          this.refresh(true);
        }
      });
    }
  }

  pointInside(el, x, y) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }


  // Общее начало касания: заводим таймер удержания и следим за сдвигом пальца.
  // Сдвиг больше порога означает, что человек тянет, а не удерживает.
  touchStart(e, onLongPress) {
    const t = e.touches && e.touches[0];
    if (!t) return;

    this.suppressTap = false;
    this.touchY = t.clientY;
    this.touchX = t.clientX;
    this.touchMoved = false;
    this.longPressFired = false;

    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    this.longPressTimer = window.setTimeout(() => {
      this.longPressTimer = null;
      if (this.touchMoved) return;
      this.longPressFired = true;
      this.suppressTap = true;
      if (onLongPress) onLongPress();
    }, LONG_PRESS_MS);
  }

  touchMove(e, allowScrub) {
    const t = e.touches && e.touches[0];
    if (!t) return;

    if (!this.touchMoved &&
        (Math.abs(t.clientY - this.touchY) > TOUCH_SLOP ||
         Math.abs(t.clientX - this.touchX) > TOUCH_SLOP)) {
      this.touchMoved = true;
      if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
    }

    if (this.touchMoved && allowScrub && !this.longPressFired) {
      this.suppressTap = true;
      if (e.cancelable) e.preventDefault();   // иначе страница поедет вместе с протяжкой

      // События касания приходят чаще, чем экран успевает перерисоваться:
      // копим последнюю точку и обрабатываем раз в кадр, иначе заметно подлагивает
      this.pendingPointer = { x: t.clientX, y: t.clientY };
      if (this.touchRaf) return;
      this.touchRaf = requestAnimationFrame(() => {
        this.touchRaf = null;
        if (!this.pendingPointer) return;
        this.applyWave();
        this.scrubTo(this.pendingPointer.y, this.pendingPointer.x);
      });
    }
  }

  touchEnd() {
    if (this.longPressTimer) { clearTimeout(this.longPressTimer); this.longPressTimer = null; }
    if (this.touchRaf) { cancelAnimationFrame(this.touchRaf); this.touchRaf = null; }
    if (this.touchMoved) {
      this.endScrub();
      this.resetWave();
    }
    // снимаем запрет на обычный тап уже после того, как браузер отдаст click
    window.setTimeout(() => { this.suppressTap = false; }, 0);
  }

  // Всплывающие действия слева от пункта
  showItemMenu(idx) {
    if (!this.menuEl || !this.selected.size) return;
    this.menuIdx = idx;
    this.menuEl.empty();
    this.menuEl.removeClass('is-ghost');
    this.menuEl.style.removeProperty('width');
    this.menuEl.style.removeProperty('height');

    const copy = this.menuEl.createEl('button', { cls: 'hr-mi' });
    copy.setText(this.selected.size > 1 ? t('copyN', this.selected.size) : t('copy'));
    copy.addEventListener('click', (e) => {
      e.stopPropagation();
      this.holdOpen = true;
      this.ghostItemMenu();
      this.copySelected();
    });

    const del = this.menuEl.createEl('button', { cls: 'hr-mi hr-mi-danger' });
    del.setText(this.selected.size > 1 ? t('deleteN', this.selected.size) : t('delete'));
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      this.holdOpen = true;
      this.ghostItemMenu();
      this.deleteSelected(true);
    });

    const cancel = this.menuEl.createEl('button', { cls: 'hr-mi', text: t('cancel') });
    cancel.addEventListener('click', (e) => {
      e.stopPropagation();
      this.holdOpen = true;
      this.clearSelection();
      this.ghostItemMenu();
    });

    this.menuEl.addClass('is-shown');
    this.positionItemMenu();
  }

  positionItemMenu() {
    if (!this.menuEl || !this.menuEl.classList.contains('is-shown')) return;
    // На телефоне меню стоит полосой по низу блока: положение задаётся
    // стилями, а не кодом, иначе стилям пришлось бы перебивать эту строку
    if (this.isMobile) {
      this.menuEl.style.removeProperty('top');
      return;
    }
    const item = this.panelItems[this.menuIdx];
    const panel = this.panelEl;
    if (!item || !panel) { this.hideItemMenu(); return; }

    const pr = panel.getBoundingClientRect();
    const ir = item.getBoundingClientRect();

    // пункт мог уехать за пределы видимой части списка
    if (ir.bottom < pr.top || ir.top > pr.bottom) { this.hideItemMenu(); return; }

    const y = ir.top - pr.top + ir.height / 2;
    this.menuEl.style.top = Math.max(10, Math.min(pr.height - 10, y)) + 'px';
  }

  // После нажатия кнопка исчезает из-под курсора, и браузер справедливо решает,
  // что мышь ушла с виджета. Вместо вычислений координат оставляем на том же месте
  // невидимую заглушку того же размера: курсор по-прежнему над элементом плагина,
  // и уход засчитается только когда мышь действительно с неё сойдёт.
  ghostItemMenu() {
    if (!this.menuEl || !this.menuEl.classList.contains('is-shown')) return;
    const w = this.menuEl.offsetWidth;
    const h = this.menuEl.offsetHeight;
    this.menuEl.empty();
    this.menuEl.style.width = w + 'px';
    this.menuEl.style.height = h + 'px';
    this.menuEl.addClass('is-ghost');
  }

  hideItemMenu() {
    if (!this.menuEl) return;
    this.menuEl.removeClass('is-shown');
    this.menuEl.removeClass('is-ghost');
    this.menuEl.style.removeProperty('width');
    this.menuEl.style.removeProperty('height');
    this.menuIdx = null;
  }

  clearSelection() {
    this.selected.clear();
    this.anchorIdx = null;
    this.hideItemMenu();
    this.renderSelection();
  }

  setPanelHover(idx) {
    this.panelItems.forEach((it, i) => it.classList.toggle('is-hover', i === idx));
  }

  setRailHover(idx) {
    for (const stop of this.stops) {
      stop.el.classList.toggle('is-mirror', stop.kind === 'h' && stop.hIdx === idx);
    }
  }

  // Положения пунктов при прокрутке не меняются, поэтому замеряем их один раз.
  // Раньше бегунок на каждом кадре опрашивал все пункты, и на длинном списке
  // панель заметно отставала от курсора.
  // Кэш мог устареть: сменилась тема, шрифт или список пунктов.
  // Одна сверка вместо полного перезамера на каждом кадре.
  ensureMetrics() {
    const n = this.panelItems.length;
    if (!this.itemTop || this.itemTop.length !== n) { this.cacheItemMetrics(); return; }
    if (!n) return;
    if (this.panelItems[n - 1].offsetTop !== this.itemTop[n - 1]) this.cacheItemMetrics();
  }

  cacheItemMetrics() {
    this.itemTop = [];
    this.itemH = [];
    for (let i = 0; i < this.panelItems.length; i++) {
      this.itemTop.push(this.panelItems[i].offsetTop);
      this.itemH.push(this.panelItems[i].offsetHeight || 1);
    }
  }

  // Какому пункту структуры соответствует точка её прокрутки (дробно)
  fracAt(y) {
    const tops = this.itemTop;
    if (!tops || !tops.length) return 0;
    for (let i = 0; i < tops.length; i++) {
      const top = tops[i];
      const h = this.itemH[i];
      if (y < top) return i;
      if (y < top + h) return i + (y - top) / h;
    }
    return tops.length - 1;
  }

  // Положение на рельсе для дробного номера пункта
  railYAt(frac) {
    const last = this.panelItems.length - 1;
    const f = Math.max(0, Math.min(last, frac));
    const lo = Math.floor(f);
    const hi = Math.min(last, Math.ceil(f));
    const a = this.stopCenter(this.stopOfHeading(lo));
    const b = this.stopCenter(this.stopOfHeading(hi));
    return a + (b - a) * (f - lo);
  }

  // Видимая зона структуры, разложенная по столбцам: если она попадает
  // на границу, отрезок уходит вниз в одном столбце и появляется сверху в следующем
  updateMarker() {
    if (!this.markerEls || !this.panelListEl || !this.panelItems.length) return;
    const list = this.panelListEl;

    // при активном фильтре список не соответствует полоскам — бегунки прячем
    if (this.filterActive) {
      this.markerEls.forEach((m) => m.style.opacity = '0');
      return;
    }

    this.ensureMetrics();
    const fTop = this.fracAt(list.scrollTop);
    const fBottom = this.fracAt(list.scrollTop + list.clientHeight);

    for (let c = 0; c < this.markerEls.length; c++) {
      const m = this.markerEls[c];
      const inCol = this.stops.filter((st) => st.kind === 'h' && st.col === c);
      if (!inCol.length) { m.style.opacity = '0'; continue; }

      const a = inCol[0].hIdx;
      const b = inCol[inCol.length - 1].hIdx;
      const from = Math.max(fTop, a);
      const to = Math.min(fBottom, b);

      if (to < from) { m.style.opacity = '0'; continue; }

      const yTop = this.railYAt(from);
      const yBottom = this.railYAt(to);
      m.style.removeProperty('opacity');
      m.style.height = Math.max(MARKER_MIN_H, yBottom - yTop) + 'px';
      m.style.transform = 'translateY(' + yTop + 'px)';
    }
  }

  // Фильтрация списка структуры строкой поиска
  applyFilter(query) {
    const q = (query || '').trim().toLowerCase();
    this.filterActive = q.length > 0;

    this.panelItems.forEach((item, i) => {
      const hit = !this.filterActive || this.headings[i].heading.toLowerCase().includes(q);
      item.classList.toggle('hr-hidden', !hit);
    });

    this.cacheItemMetrics();
    this.updateEdges();
    this.updateMarker();
  }

  // Активное место вне видимой зоны структуры? Показать указатель у нужного края.
  updateEdges() {
    if (!this.edgeTop || !this.edgeBottom || !this.panelListEl) return;

    const visible = this.isPanelVisible();
    const item = this.panelItems[this.activeIndex];
    // при фильтре активного пункта может не быть в списке — указывать не на что
    if (this.filterActive || !visible || !item || item.classList.contains('hr-hidden')) {
      this.edgeTop.removeClass('is-shown');
      this.edgeBottom.removeClass('is-shown');
      return;
    }

    this.ensureMetrics();
    const list = this.panelListEl;
    const top = (this.itemTop && this.itemTop[this.activeIndex]) || 0;
    const bottom = top + ((this.itemH && this.itemH[this.activeIndex]) || 1);
    const viewTop = list.scrollTop;
    const viewBottom = viewTop + list.clientHeight;

    this.edgeTop.classList.toggle('is-shown', bottom <= viewTop + 1);
    this.edgeBottom.classList.toggle('is-shown', top >= viewBottom - 1);
  }

  // Раскрыть структуру, показав именно эту часть (ПКМ или Ctrl+клик по полоске)
  togglePanelAt(hIdx) {
    if (this.isOpen) {
      this.isOpen = false;
      this.applyPanelState();
      return;
    }
    this.isOpen = true;
    this.pendingCenterIdx = hIdx;
    this.applyPanelState();
  }

  applyPanelState() {
    if (!this.hostEl) return;
    const visible = this.isPanelVisible();
    const wasVisible = this.hostEl.classList.contains('hr-panel-visible');

    this.hostEl.classList.toggle('hr-panel-visible', visible);
    // в режиме удержания Ctrl набирать в поиске всё равно нельзя — прячем его
    this.hostEl.classList.toggle('hr-ctrl-peek', visible && !this.isOpen);
    this.hostEl.classList.toggle('hr-no-wave', this.isOpen);
    if (this.isOpen) this.resetWave();
    if (!visible) { this.setPanelHover(-1); this.setRailHover(-1); }

    document.querySelectorAll('.hr-action-btn').forEach((b) =>
      b.classList.toggle('is-active', this.isOpen)
    );

    if (visible && !wasVisible) {
      const idx = this.pendingCenterIdx !== null ? this.pendingCenterIdx : this.activeIndex;
      this.syncPanelTo(idx, true);
    }
    this.pendingCenterIdx = null;
    if (visible) window.setTimeout(() => { this.updateMarker(); this.updateEdges(); }, 20);
    else this.updateEdges();
  }

  syncPanelTo(idx, force) {
    if (!this.isPanelVisible() || !this.panelListEl) return;
    if (!force && idx === this.lastSyncedIdx) return;
    this.lastSyncedIdx = idx;

    this.ensureMetrics();
    if (!this.itemTop || this.itemTop[idx] === undefined) return;

    const list = this.panelListEl;
    const target = this.itemTop[idx] - list.clientHeight / 2 + this.itemH[idx] / 2;
    const top = Math.max(0, Math.min(list.scrollHeight - list.clientHeight, target));
    this.panelScrollTo(top);
  }

  /* ------------------------------ клавиатура ------------------------------ */

  onKeyDown(e) {
    if (this.isMobile) return;
    if ((e.key === 'Control' || e.ctrlKey || e.metaKey) && !this.ctrlTemp) this.setCtrlTemp(true);

    // пробел работает как протяжка, но только пока курсор на виджете —
    // иначе он остаётся обычным пробелом в тексте
    // Стрелки: при наведении на рельс — только когда структура раскрыта
    // (иначе они перехватывались бы во время обычного набора текста).
    // С Ctrl — всегда, независимо от положения курсора.
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const byHover = this.overRail && this.isOpen;
      const byCtrl = e.ctrlKey || e.metaKey;
      if ((byHover || byCtrl) && this.headings.length) {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const next = Math.max(0, Math.min(this.headings.length - 1, this.activeIndex + delta));
        this.animateScrollTo(this.stopOfHeading(next));
        return;
      }
    }

    // Delete удаляет выбранное — только при раскрытой структуре и курсоре на ней,
    // иначе клавиша перехватывалась бы во время обычного редактирования текста
    if ((e.key === 'Delete' || e.key === 'Backspace') &&
        this.isOpen && this.overRail && this.selected.size) {
      e.preventDefault();
      e.stopPropagation();
      this.deleteSelected();
      return;
    }
    if (e.key === 'Escape' && this.selected.size) {
      this.clearSelection();
      return;
    }

    if ((e.code === 'Space' || e.key === ' ') && this.overRail && !this.spaceHeld) {
      e.preventDefault();
      this.spaceHeld = true;
      if (this.pendingPointer) this.scrubTo(this.pendingPointer.y, this.pendingPointer.x);
    }
  }

  onKeyUp(e) {
    if (this.isMobile) return;
    if (e.key === 'Control' || e.key === 'Meta' || (!e.ctrlKey && !e.metaKey)) this.setCtrlTemp(false);
    if (e.code === 'Space' || e.key === ' ') {
      if (this.spaceHeld) { this.spaceHeld = false; this.endScrub(); }
    }
  }

  setCtrlTemp(val) {
    if (this.ctrlTemp === val) return;
    this.ctrlTemp = val;
    if (!val) this.holdOpen = false;
    this.applyPanelState();
  }

  /* --------------------- координаты заголовков --------------------- */

  // В режиме чтения список заголовков документа искался заново для каждого замера.
  // Держим его на время одной серии замеров.
  beginMeasure() {
    if (!this.scrollTarget) return;
    // геометрия контейнера одинакова для всей серии замеров — незачем
    // запрашивать её заново на каждый заголовок
    this.measureRect = this.scrollTarget.getBoundingClientRect();
    if (this.currentMode === 'preview') {
      this.buildPreviewTops();
    } else {
      const view = this.getView();
      const cm = view && view.editor && view.editor.cm;
      if (cm) {
        let docTop = cm.documentTop;
        if (typeof docTop !== 'number' && cm.contentDOM) {
          docTop = cm.contentDOM.getBoundingClientRect().top;
        }
        this.measureBase = docTop - this.measureRect.top + this.scrollTarget.scrollTop;
        this.measureCm = cm;
      }
    }
  }

  // В режиме чтения Obsidian держит в разметке только видимую часть документа,
  // поэтому отрисованные заголовки — лишь подмножество всех. Сопоставлять их
  // по порядковому номеру нельзя: третий отрисованный не равен третьему в файле.
  // Выстраиваем соответствие по уровню и тексту, а положения недостающих
  // достраиваем по номерам строк — по мере отрисовки они уточняются сами.
  buildPreviewTops() {
    const n = this.headings.length;
    const tops = new Array(n).fill(null);
    const els = this.scrollTarget.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const sTop = this.measureRect.top;
    const scrollTop = this.scrollTarget.scrollTop;

    // Приводим к общему виду: в отрисованном заголовке разметки уже нет,
    // а в исходном она есть — без этого ссылка или выделение в заголовке
    // ломали сравнение, и не совпадал вообще ни один заголовок.
    const norm = (v) => String(v || '')
      .replace(/!?\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (m, a, b) => b || a)
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~=]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Obsidian кладёт исходный текст заголовка в атрибут — это надёжнее,
    // чем сравнивать видимый текст, и не зависит от разметки внутри
    const keyOf = (el) => {
      const raw = el.getAttribute ? el.getAttribute('data-heading') : null;
      return norm(raw === null || raw === undefined ? el.textContent : raw);
    };

    let hi = 0;
    for (const el of els) {
      const lvl = Number(el.tagName.slice(1));
      const text = keyOf(el);
      let j = hi;
      while (j < n && !(this.headings[j].level === lvl && norm(this.headings[j].heading) === text)) j++;
      if (j < n) {
        tops[j] = el.getBoundingClientRect().top - sTop + scrollTop;
        hi = j + 1;
      }
    }

    // опорные точки для достройки пропусков
    const known = [];
    for (let i = 0; i < n; i++) {
      if (tops[i] !== null) known.push({ i, line: this.headings[i].position.start.line, top: tops[i] });
    }

    if (!known.length && n) {
      // Ни один заголовок сопоставить не удалось. Раньше в этом случае
      // возвращались одни пустые значения и отслеживание переставало работать
      // совсем. Теперь раскладываем по номерам строк — приблизительно, но живо.
      const maxScroll = Math.max(1, this.scrollTarget.scrollHeight - this.scrollTarget.clientHeight);
      const lastLine = Math.max(1, this.headings[n - 1].position.start.line + 40);
      for (let i = 0; i < n; i++) {
        tops[i] = (this.headings[i].position.start.line / lastLine) * maxScroll;
      }
    }

    if (known.length) {
      const first = known[0];
      const last = known[known.length - 1];
      const perLine = (last.line > first.line)
        ? (last.top - first.top) / (last.line - first.line)
        : 24;

      for (let i = 0; i < n; i++) {
        if (tops[i] !== null) continue;
        const line = this.headings[i].position.start.line;
        let lo = null, up = null;
        for (const k of known) {
          if (k.i < i) lo = k;
          else if (k.i > i) { up = k; break; }
        }
        if (lo && up && up.line !== lo.line) {
          tops[i] = lo.top + (up.top - lo.top) * ((line - lo.line) / (up.line - lo.line));
        } else if (lo) {
          tops[i] = lo.top + (line - lo.line) * perLine;
        } else if (up) {
          tops[i] = up.top - (up.line - line) * perLine;
        }
      }
    }

    this.previewTops = tops;
  }

  endMeasure() {
    this.previewTops = null;
    this.measureRect = null;
    this.measureBase = null;
    this.measureCm = null;
  }

  headingTop(idx) {
    if (!this.scrollTarget) return null;

    const sRect = this.measureRect || this.scrollTarget.getBoundingClientRect();

    if (this.currentMode === 'preview') {
      if (!this.previewTops) this.buildPreviewTops();
      const v = this.previewTops ? this.previewTops[idx] : null;
      return (v === null || v === undefined) ? null : v;
    }

    let cm = this.measureCm;
    if (!cm) {
      const view = this.getView();
      cm = view && view.editor && view.editor.cm;
    }
    if (!cm) return null;

    const h = this.headings[idx];
    if (!h) return null;

    const lineNo = Math.min(h.position.start.line + 1, cm.state.doc.lines);
    const line = cm.state.doc.line(lineNo);
    const block = cm.lineBlockAt(line.from);

    let offsetBase = this.measureBase;
    if (offsetBase === null || offsetBase === undefined) {
      let docTopScreen = cm.documentTop;
      if (typeof docTopScreen !== 'number' && cm.contentDOM) {
        docTopScreen = cm.contentDOM.getBoundingClientRect().top;
      }
      offsetBase = docTopScreen - sRect.top + this.scrollTarget.scrollTop;
    }
    return block.top + offsetBase;
  }

  /* ------------------------------- прокрутка ------------------------------- */

  attachScroll(view) {
    const mode = typeof view.getMode === 'function' ? view.getMode() : 'source';
    this.currentMode = mode;

    let scroller = null;
    if (mode === 'preview') {
      scroller =
        view.containerEl.querySelector('.markdown-preview-view') ||
        view.containerEl.querySelector('.markdown-reading-view');
    } else if (view.editor && view.editor.cm && view.editor.cm.scrollDOM) {
      scroller = view.editor.cm.scrollDOM;
    }
    if (!scroller) return;

    this.scrollTarget = scroller;
    scroller.addEventListener('scroll', this.onScroll, { passive: true });

    // ручная прокрутка пользователем отменяет наш переход
    this.userInterrupt = () => { this.cancelAnim(); this.pinnedIdx = null; };
    scroller.addEventListener('wheel', this.userInterrupt, { passive: true });
    scroller.addEventListener('touchstart', this.userInterrupt, { passive: true });
    scroller.addEventListener('mousedown', this.userInterrupt, { passive: true });
  }

  detachScroll() {
    if (this.scrollTarget) {
      this.scrollTarget.removeEventListener('scroll', this.onScroll);
      if (this.userInterrupt) {
        this.scrollTarget.removeEventListener('wheel', this.userInterrupt);
        this.scrollTarget.removeEventListener('touchstart', this.userInterrupt);
        this.scrollTarget.removeEventListener('mousedown', this.userInterrupt);
      }
      this.scrollTarget = null;
    }
  }

  onScroll() {
    if (this.rafScroll) return;
    this.rafScroll = true;
    requestAnimationFrame(() => {
      this.rafScroll = false;
      this.updateActive();
    });
  }

  setActive(idx) {
    // Раньше при каждом кадре прокрутки перебирались все полоски и все пункты
    // структуры, даже когда активный блок не менялся: на длинной заметке это
    // сотни обращений к разметке в секунду впустую.
    if (idx === this.activeIndex && this.activeApplied) return;
    this.activeIndex = idx;
    this.activeApplied = true;

    if (this.prevActiveEls) {
      this.prevActiveEls.forEach((el) => el.classList.remove('is-active'));
    }
    const nowActive = [];
    const st = this.stops[this.stopOfHeading(idx)];
    if (st && st.kind === 'h') nowActive.push(st.el);
    if (this.panelItems[idx]) nowActive.push(this.panelItems[idx]);
    nowActive.forEach((el) => el.classList.add('is-active'));
    this.prevActiveEls = nowActive;

    this.updateEdges();
  }

  updateActive() {
    if (!this.railEl || !this.headings.length || !this.scrollTarget) return;
    if (this.animId || this.dragging || this.spaceHeld || this.scrubRaf) return;

    if (this.pinnedIdx !== null) {
      const target = this.targetScrollFor(this.stopOfHeading(this.pinnedIdx));
      if (target !== null && Math.abs(this.scrollTarget.scrollTop - target) < 8) {
        this.setActive(this.pinnedIdx);
        return;
      }
      this.pinnedIdx = null;
    }

    let idx = 0;
    try {
      const edge = this.scrollTarget.scrollTop + this.scrollTarget.clientHeight * CENTER_RATIO;
      // заголовки идут по возрастанию, поэтому ищем делением пополам:
      // на длинных заметках это единицы замеров вместо сотен на каждый кадр
      this.beginMeasure();
      let lo = 0, hi = this.headings.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const top = this.headingTop(mid);
        if (top === null) break;
        if (top <= edge) { idx = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      this.endMeasure();
    } catch (e) {
      this.endMeasure();
      return;
    }

    this.setActive(idx);
    // структура следует за документом: пока курсор не на виджете,
    // текущий раздел подводится к центру списка
    if (!this.overRail) this.syncPanelTo(idx);
  }
}

class HeadingRailTrashModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    this.render();
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('hr-trash-modal');
    contentEl.createEl('h3', { text: t('historyTitle') });

    this.plugin.pruneTrash();
    const del = this.plugin.undoStack;
    const cop = this.plugin.copyStack;

    // Оба раздела показываются всегда: пустой пишет об этом сам,
    // чтобы блоки не исчезали и место не «прыгало»
    contentEl.createEl('h4', { cls: 'hr-trash-head', text: t('trashCopiedHead') });
    if (!cop.length) {
      contentEl.createEl('p', { cls: 'hr-trash-empty', text: t('trashCopiedEmpty') });
    } else {
      for (let i = cop.length - 1; i >= 0; i--) {
        const row = this.makeRow(contentEl, cop[i]);

        const btn = row.createEl('button', { cls: 'hr-btn', text: t('copyAgain') });
        btn.addEventListener('click', () => this.plugin.copyAgain(i));

        const drop = row.createEl('button', { cls: 'hr-btn', text: t('forget') });
        drop.addEventListener('click', () => {
          this.plugin.copyStack.splice(i, 1);
          this.render();
        });
      }
    }

    contentEl.createEl('h4', { cls: 'hr-trash-head', text: t('trashDeletedHead') });
    if (!del.length) {
      contentEl.createEl('p', { cls: 'hr-trash-empty', text: t('trashDeletedEmpty') });
    } else {
      contentEl.createEl('p', { cls: 'hr-trash-hint', text: t('trashHint') });
      for (let i = del.length - 1; i >= 0; i--) {
        const row = this.makeRow(contentEl, del[i]);

        const btn = row.createEl('button', { cls: 'hr-btn', text: t('restore') });
        btn.addEventListener('click', async () => {
          const ok = await this.plugin.restoreAt(i);
          if (ok) this.render();
        });

        const drop = row.createEl('button', { cls: 'hr-btn', text: t('forget') });
        drop.addEventListener('click', () => {
          this.plugin.undoStack.splice(i, 1);
          this.render();
        });
      }
    }
  }

  makeRow(parent, e) {
    const row = parent.createDiv({ cls: 'hr-trash-row' });
    const info = row.createDiv({ cls: 'hr-trash-info' });
    info.createDiv({ cls: 'hr-trash-title', text: e.titles.join(', ') || t('trashNoTitle') });

    const when = new Date(e.time);
    const whenStr = when.toLocaleDateString() + ' ' +
      when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    info.createDiv({ cls: 'hr-trash-meta', text: t('trashMeta', e.lines, e.path, whenStr) });
    return row;
  }

  onClose() {
    this.contentEl.empty();
  }
}

class HeadingRailSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName(t('settingSearchName'))
      .setDesc(t('settingSearchDesc'))
      .addToggle((t) => t
        .setValue(this.plugin.settings.showSearch)
        .onChange(async (v) => {
          this.plugin.settings.showSearch = v;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh(true);
        }));

    new Setting(containerEl)
      .setName(t('settingTrashMaxName'))
      .setDesc(t('settingTrashMaxDesc'))
      .addText((t) => t
        .setValue(String(this.plugin.settings.trashMax))
        .onChange(async (v) => {
          const n = parseInt(v, 10);
          this.plugin.settings.trashMax = isNaN(n) ? 20 : Math.max(1, n);
          await this.plugin.saveData(this.plugin.settings);
        }));

    new Setting(containerEl)
      .setName(t('settingSearchBottomName'))
      .setDesc(t('settingSearchBottomDesc'))
      .addToggle((t) => t
        .setValue(this.plugin.settings.searchAtBottom)
        .onChange(async (v) => {
          this.plugin.settings.searchAtBottom = v;
          await this.plugin.saveData(this.plugin.settings);
          this.plugin.refresh(true);
        }));
  }
}

module.exports = HeadingRailPlugin;
