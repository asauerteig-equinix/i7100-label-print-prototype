const MM_PER_INCH = 25.4;
const DEFAULT_DPI = 300;

function mmToDots(mm, dpi = DEFAULT_DPI) {
  return Math.round((Number(mm) / MM_PER_INCH) * Number(dpi));
}

function normalize(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function sanitizeJScriptText(text) {
  return String(text ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .trim();
}

function buildJob(commands) {
  return `${commands.join('\r\n')}\r\n`;
}

function buildLabelData(input) {
  const source = input && typeof input === 'object' ? input : {};
  const line1 = normalize(source.line1, '');
  const line2 = normalize(source.line2, '');
  const line3 = normalize(source.line3, '');
  const qrPayload = normalize(source.qrPayload, line2);

  return {
    line1,
    line2,
    line3,
    qrPayload
  };
}

function buildPrototypeJScript(input) {
  const data = buildLabelData(input);

  const widthMm = 38.1;
  const heightMm = 101.6;
  const printAreaHeightMm = 50.8;
  const foldHalfHeightMm = 25.4;
  
  const widthDots = mmToDots(widthMm);
  const labelHeightDots = mmToDots(heightMm);
  const printAreaDots = mmToDots(printAreaHeightMm);
  const halfAreaDots = Math.floor(printAreaDots / 2);

  const safeLine1 = sanitizeJScriptText(data.line1);
  const safeLine2 = sanitizeJScriptText(data.line2);
  const safeLine3 = sanitizeJScriptText(data.line3);
  const safeQrPayload = sanitizeJScriptText(data.qrPayload);

  // The cab printer expects its line-oriented JScript command set, not JavaScript-like function calls.
  const jscript = buildJob([
    'm m',
    'J',
    `S l1;0,0,${printAreaHeightMm},${printAreaHeightMm},${widthMm}`,
    `T 0,3.5,0,5,pt16;${safeLine1}[J:c${widthMm}]`,
    `T 0,10.5,0,3,pt9;${safeLine2}[J:c${widthMm}]`,
    `T 0,15.5,0,3,pt9;${safeLine3}[J:c${widthMm}]`,
    `G 2,${foldHalfHeightMm},0;L:${widthMm - 4},0.5`,
    `B ${widthMm / 2 - 8},${foldHalfHeightMm + 2.5},0,QRCODE+ELM+MODEL2+WS1,0.8;${safeQrPayload}`,
    'A 1'
  ]);

  return {
    jscript,
    data,
    layout: {
      widthMm,
      heightMm,
      printAreaHeightMm,
      foldHalfHeightMm,
      widthDots,
      labelHeightDots,
      printAreaDots,
      halfAreaDots,
      dpi: DEFAULT_DPI
    }
  };
}

function buildPatchPanelJScript(input) {
  const source = input && typeof input === 'object' ? input : {};
  const serial = normalize(source.line1 || source.serial || source.value, '');

  const widthMm = 42;
  const heightMm = 9;
  const widthDots = mmToDots(widthMm);
  const heightDots = mmToDots(heightMm);

  const safeSerial = sanitizeJScriptText(serial);
  const jscript = buildJob([
    'm m',
    'J',
    `S l1;0,0,${heightMm},${heightMm},${widthMm}`,
    `T 0,5.8,0,5,pt11;${safeSerial}[J:c${widthMm}]`,
    'A 1'
  ]);

  return {
    jscript,
    data: {
      line1: serial
    },
    layout: {
      widthMm,
      heightMm,
      widthDots,
      heightDots,
      dpi: DEFAULT_DPI
    }
  };
}

module.exports = {
  buildPrototypeJScript,
  buildPatchPanelJScript
};
