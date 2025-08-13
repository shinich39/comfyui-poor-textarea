// src/index.ts
function inRange(value, min, max) {
  return value >= min && value <= max;
}
function isUndo(e) {
  const { key } = e;
  const ctrlKey = e.ctrlKey || e.metaKey;
  return key.toLowerCase() === "z" && ctrlKey;
}
function isRedo(e) {
  const { key, shiftKey } = e;
  const ctrlKey = e.ctrlKey || e.metaKey;
  return key.toLowerCase() === "z" && ctrlKey && shiftKey;
}
function isIndentation(e) {
  const { key } = e;
  const ctrlKey = e.ctrlKey || e.metaKey;
  return key.toLowerCase() === "tab" && !ctrlKey;
}
function isCommentify(e) {
  const { key } = e;
  const ctrlKey = e.ctrlKey || e.metaKey;
  return key === "/" && ctrlKey;
}
var init = function(element, options) {
  const MAX_HISTORY_COUNT = options?.maxHistoryCount || 500;
  const pairs = options?.pairs || {
    "(": ")",
    "[": "]",
    "{": "}",
    "<": ">",
    "'": "'",
    '"': '"',
    "`": "`"
  };
  const callbacks = {
    onUndo: null,
    onRedo: null,
    onKeydown: null,
    onKeyup: null,
    onMouseup: null,
    onBeforeinput: null,
    onInput: null
  };
  let histories = [], historyIndex = 1;
  const isBracket = function(e) {
    const { key } = e;
    return Object.keys(pairs).includes(key);
  };
  const isRangeSelection = function() {
    return element.selectionStart !== element.selectionEnd;
  };
  const getCursor = function() {
    const cursorStart = Math.min(element.selectionStart, element.selectionEnd);
    const cursorEnd = Math.max(element.selectionStart, element.selectionEnd);
    const isReversed = element.selectionStart > element.selectionEnd;
    return {
      cursorStart,
      cursorEnd,
      isReversed
    };
  };
  const setCursor = function(start, end, isReversed = false) {
    if (!isReversed) {
      element.setSelectionRange(start, end);
    } else {
      element.setSelectionRange(end, start);
    }
    element.focus();
  };
  const getPrevHistory = function() {
    if (historyIndex < histories.length) {
      historyIndex += 1;
      return histories[histories.length - historyIndex];
    }
  };
  const getNextHistory = function() {
    if (historyIndex > 1) {
      historyIndex -= 1;
      return histories[histories.length - historyIndex];
    }
  };
  const pruneHistories = function() {
    if (historyIndex > 1) {
      histories = histories.slice(0, histories.length - (historyIndex - 1));
      historyIndex = 1;
    }
  };
  const addHistory = function(shouldPrune = true) {
    if (shouldPrune) {
      pruneHistories();
    }
    histories.push({
      value: element.value,
      start: element.selectionStart,
      end: element.selectionEnd
    });
    if (histories.length > MAX_HISTORY_COUNT) {
      histories.shift();
    }
  };
  const loadHistory = function(h) {
    element.value = h.value;
    setCursor(h.start, h.end);
  };
  const getRows = function() {
    const { cursorStart, cursorEnd } = getCursor();
    const rows = element.value.split(/\n/);
    const result = [];
    let offset = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const startIndex = offset;
      const endIndex = offset + r.length;
      const isSelected = !(startIndex > cursorEnd || endIndex < cursorStart);
      result.push({
        isSelected,
        rowIndex: i,
        startIndex,
        endIndex,
        value: r
      });
      offset = endIndex + 1;
    }
    return result;
  };
  const editSelectedRows = function(rows, callback) {
    const { cursorStart, cursorEnd, isReversed } = getCursor();
    const isRange = cursorStart !== cursorEnd;
    let newCursorStart = cursorStart, newCursorEnd = cursorEnd;
    const rowValues = [];
    for (const r of rows) {
      const { isSelected, startIndex, endIndex } = r;
      if (!isSelected) {
        rowValues.push(r.value);
        continue;
      }
      const origValue = r.value;
      const newValue = callback(r);
      const diff = newValue.length - origValue.length;
      if (inRange(cursorStart, startIndex, endIndex)) {
        if (diff >= 0) {
          newCursorStart += diff;
        } else {
          newCursorStart += Math.max(diff, startIndex - cursorStart);
        }
        if (diff >= 0) {
          newCursorEnd += diff;
        } else {
          newCursorEnd += Math.max(diff, startIndex - cursorEnd);
        }
      } else if (inRange(cursorEnd, startIndex, endIndex)) {
        if (diff >= 0) {
          newCursorEnd += diff;
        } else {
          newCursorEnd += Math.max(diff, startIndex - cursorEnd);
        }
      } else {
        newCursorEnd += diff;
      }
      rowValues.push(newValue);
    }
    element.value = rowValues.join("\n");
    setCursor(newCursorStart, newCursorEnd, isReversed);
  };
  const closeBracket = function(e) {
    const opening = e.key;
    const closing = pairs[opening];
    const { cursorStart, cursorEnd, isReversed } = getCursor();
    const left = element.value.substring(0, cursorStart);
    const center = element.value.substring(cursorStart, cursorEnd);
    const right = element.value.substring(cursorEnd);
    if (cursorStart === cursorEnd) {
      element.value = left + opening + closing + right;
      const start = (left + opening).length;
      setCursor(start, start);
    } else {
      element.value = left + opening + center + closing + right;
      const start = (left + opening).length;
      const end = (left + opening + center).length;
      setCursor(start, end, isReversed);
    }
  };
  const keydownHandler = (e) => {
    if (isRedo(e)) {
      e.preventDefault();
      const h = getNextHistory();
      if (h) {
        loadHistory(h);
      }
      callbacks.onRedo?.(e, histories);
    } else if (isUndo(e)) {
      e.preventDefault();
      const h = getPrevHistory();
      if (h) {
        loadHistory(h);
      }
      callbacks.onUndo?.(e, histories);
    } else if (isCommentify(e)) {
      e.preventDefault();
      const rows = getRows();
      let isComment = false;
      for (const r of rows) {
        if (r.isSelected && r.value.startsWith("//")) {
          isComment = true;
          break;
        }
      }
      editSelectedRows(
        rows,
        (row) => isComment ? row.value.replace(/^\/\/\s?/, "") : row.value.trim() || !isRangeSelection() ? "// " + row.value : row.value
      );
      addHistory();
    } else if (isIndentation(e)) {
      e.preventDefault();
      const rows = getRows();
      editSelectedRows(
        rows,
        (row) => e.shiftKey ? row.value.replace(/^\s{1,2}/, "") : row.value.trim() || !isRangeSelection() ? "  " + row.value : row.value
      );
      addHistory();
    } else if (isBracket(e)) {
      e.preventDefault();
      if (historyIndex !== 1) {
        addHistory();
      }
      closeBracket(e);
      addHistory();
    }
    callbacks.onKeydown?.(e, histories);
  };
  const keyupHandler = (e) => {
    if ([
      "arrowleft",
      "arrowright",
      "arrowup",
      "arrowdown",
      "home",
      "end",
      "pageup",
      "pagedown",
      "escape"
      // 'tab'
    ].includes(e.key.toLowerCase())) {
      if (historyIndex === 1) {
        addHistory();
      }
      callbacks.onKeyup?.(e, histories);
    }
  };
  const mouseupHandler = (e) => {
    if (historyIndex === 1) {
      addHistory();
    }
    callbacks.onMouseup?.(e, histories);
  };
  const beforeinputHandler = (e) => {
    if (historyIndex !== 1) {
      addHistory();
    }
    callbacks.onBeforeinput?.(e, histories);
  };
  const inputHandler = (e) => {
    addHistory();
    callbacks.onInput?.(e, histories);
  };
  element.addEventListener("keydown", keydownHandler);
  element.addEventListener("keyup", keyupHandler);
  element.addEventListener("mouseup", mouseupHandler);
  element.addEventListener("beforeinput", beforeinputHandler);
  element.addEventListener("input", inputHandler);
  return callbacks;
};
export {
  init
};
