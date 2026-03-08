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

function resolveQrPayload(source, line1, line2, line3) {
  const explicit = normalize(source.qrPayload, '');
  const fallback = line1 || line2 || line3 || 'NO-DATA';
  const raw = explicit || fallback;
  const firstSegment = String(raw).split(';')[0].trim();
  return firstSegment || 'NO-DATA';
}

function calcPointSize(text, basePt, minPt, maxCharsAtBase) {
  const length = String(text ?? '').length;
  if (!length || length <= maxCharsAtBase) {
    return basePt;
  }

  const ratio = maxCharsAtBase / length;
  const scaled = Math.floor(basePt * ratio);
  return Math.max(minPt, scaled);
}

function buildJob(commands) {
  return `${commands.join('\r\n')}\r\n`;
}

function buildLabelData(input) {
  const source = input && typeof input === 'object' ? input : {};
  const line1 = normalize(source.line1, '');
  const line2 = normalize(source.line2, '');
  const line3 = normalize(source.line3, '');
  const qrPayload = resolveQrPayload(source, line1, line2, line3);

  return {
    line1,
    line2,
    line3,
    qrPayload
  };
}

function buildI7100JScript(input) {
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
  const safeSerial = safeLine1;
  const line1Pt = calcPointSize(safeLine1, 14, 8, 18);
  const line2Pt = calcPointSize(safeLine2, 10, 7, 24);
  const line3Pt = calcPointSize(safeLine3, 10, 7, 24);
  const qrModuleSize = 1.3;

  // The cab printer expects its line-oriented JScript command set, not JavaScript-like function calls.
  const jscript = buildJob([
    'm m',
    'J',
    `S l1;0,0,${heightMm},${heightMm},${widthMm}`,
    `B ${widthMm / 2 - 11},3.2,0,QRCODE+MODEL2+WS1,${qrModuleSize};${safeQrPayload}`,
    `T 0,20.2,0,3,pt8;${safeSerial}[J:c${widthMm}]`,
    `G 2,${foldHalfHeightMm},0;L:${widthMm - 4},0.5`,
    `T 0,29.2,0,3,pt${line1Pt};${safeLine1}[J:c${widthMm}]`,
    `T 0,36.2,0,3,pt${line2Pt};${safeLine2}[J:c${widthMm}]`,
    `T 0,42.8,0,3,pt${line3Pt};${safeLine3}[J:c${widthMm}]`,
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
  buildI7100JScript,
  buildPatchPanelJScript
};
