(function () {
  'use strict';

  function decodeRuns(pairs) {
    var out = [];
    for (var i = 0; i < pairs.length; i += 2) out.push([pairs[i], pairs[i + 1]]);
    return out;
  }

  function decodeChars(pairs, ramp, cols) {
    var chars = [];
    for (var i = 0; i < pairs.length; i += 2) {
      var ch = ramp[pairs[i + 1]];
      for (var n = 0; n < pairs[i]; n++) chars.push(ch);
    }
    var rows = [];
    for (var r = 0; r < chars.length; r += cols) rows.push(chars.slice(r, r + cols).join(''));
    return rows.join('\n');
  }

  function frameHtml(charPairs, colorPairs, ramp, cols, palette) {
    // Expand chars, then emit spans per color run (split at row boundaries).
    var chars = [];
    for (var i = 0; i < charPairs.length; i += 2) {
      var ch = ramp[charPairs[i + 1]];
      for (var n = 0; n < charPairs[i]; n++) chars.push(ch);
    }
    var runs = decodeRuns(colorPairs);
    var html = '';
    var pos = 0;
    for (var r = 0; r < runs.length; r++) {
      var len = runs[r][0], color = palette[runs[r][1]];
      var text = '';
      for (var k = 0; k < len; k++) {
        if (pos > 0 && pos % cols === 0) text += '\n';
        text += chars[pos++];
      }
      text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      html += '<span style="color:' + color + '">' + text + '</span>';
    }
    return html;
  }

  function AsciiPlayer(el, data) {
    var colored = !!(data.palette && data.colorFrames);
    var frames = [];
    for (var i = 0; i < data.frames.length; i++) {
      frames.push(
        colored
          ? frameHtml(data.frames[i], data.colorFrames[i], data.ramp, data.cols, data.palette)
          : decodeChars(data.frames[i], data.ramp, data.cols)
      );
    }
    var wrap = document.createElement('div');
    wrap.style.cssText = 'background:' + data.bg + ';display:inline-block;';
    var pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;padding:0;font-family:ui-monospace,Menlo,Consolas,monospace;line-height:1;white-space:pre;user-select:none;';
    if (colored) {
      // spans carry their own colors
    } else if (data.colorMode === 'gradient') {
      pre.style.backgroundImage = 'linear-gradient(' + data.fg + ',' + data.fg2 + ')';
      pre.style.webkitBackgroundClip = 'text';
      pre.style.backgroundClip = 'text';
      pre.style.color = 'transparent';
    } else {
      pre.style.color = data.fg;
    }
    wrap.appendChild(pre);
    el.appendChild(wrap);

    var show = colored
      ? function (i) { pre.innerHTML = frames[i]; }
      : function (i) { pre.textContent = frames[i]; };

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    show(0);
    if (reduced || frames.length < 2) return;

    var start = null, lastIdx = -1;
    function tick(now) {
      if (start === null) start = now;
      var idx = Math.floor(((now - start) / 1000) * data.fps) % frames.length;
      if (idx !== lastIdx) { show(idx); lastIdx = idx; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  window.AsciiPlayer = AsciiPlayer;
  document.addEventListener('DOMContentLoaded', function () {
    if (window.ASCII_DATA) {
      var el = document.querySelector('[data-ascii-player]');
      if (el) AsciiPlayer(el, window.ASCII_DATA);
    }
  });
})();
