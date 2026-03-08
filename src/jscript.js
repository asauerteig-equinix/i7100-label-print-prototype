const MM_PER_INCH = 25.4;
const DEFAULT_DPI = 300;

function mmToDots(mm, dpi = DEFAULT_DPI) {
  return Math.round((Number(mm) / MM_PER_INCH) * Number(dpi));
}

function normalize(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeCopies(value, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(parsed, 500);
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
  const copies = normalizeCopies(source.copies, 1);

  return {
    line1,
    line2,
    line3,
    qrPayload,
    copies
  };
}

function buildI7100JScript(input) {
  const data = buildLabelData(input);

  const widthMm = 38.1;
  const heightMm = 101.6;
  const printAreaHeightMm = 50.8;
  const foldHalfHeightMm = 25.4;
  const printAreaOffsetYMm = heightMm - printAreaHeightMm;
  
  const widthDots = mmToDots(widthMm);
  const labelHeightDots = mmToDots(heightMm);
  const printAreaDots = mmToDots(printAreaHeightMm);
  const halfAreaDots = Math.floor(printAreaDots / 2);

  const safeLine1 = sanitizeJScriptText(data.line1);
  const safeLine2 = sanitizeJScriptText(data.line2);
  const safeLine3 = sanitizeJScriptText(data.line3);
  const safeQrPayload = sanitizeJScriptText(data.qrPayload);
  const safeSerial = safeLine1;
  const copies = normalizeCopies(data.copies, 1);
  const line1Pt = calcPointSize(safeLine1, 14, 8, 18);
  const line2Pt = calcPointSize(safeLine2, 7, 5, 32);
  const line3Pt = calcPointSize(safeLine3, 7, 5, 32);
  const contentRotation = 0;
  const qrModuleSize = 0.85;
  const xOffsetMm = 2.0;
  const qrX = widthMm / 2 - 8.5 + xOffsetMm;
  const yOffsetMm = -printAreaHeightMm;
  const foldLineY = printAreaOffsetYMm + foldHalfHeightMm;
  const cutLineY = foldLineY + yOffsetMm;
  const qrY = printAreaOffsetYMm + 2.6 + yOffsetMm;
  const serialUnderQrY = cutLineY - 1.4;
  const textSerialY = foldLineY + 4.4 + yOffsetMm;
  const textLine2Y = foldLineY + 11.1 + yOffsetMm;
  const textLine3Y = foldLineY + 17.4 + yOffsetMm;
  const serialTextPt = Math.max(Math.min(line1Pt, 12), 11);
  const textLine2Pt = Math.min(line2Pt, 6);
  const textLine3Pt = Math.min(line3Pt, 6);

  // The cab printer expects its line-oriented JScript command set, not JavaScript-like function calls.
  const jscript = buildJob([
    'm m',
    'J',
    `S l1;0,0,${heightMm},${heightMm},${widthMm}`,
    'O R',
    'C e',
    `B ${qrX},${qrY},${contentRotation},QRCODE+MODEL2+WS1,${qrModuleSize};${safeQrPayload}`,
    `T ${xOffsetMm},${serialUnderQrY},${contentRotation},3,pt8;${safeSerial}[J:c${widthMm}]`,
    `G ${2 + xOffsetMm},${cutLineY},0;L:${widthMm - 4},0.5`,
    `T ${xOffsetMm},${textSerialY},${contentRotation},3,pt${serialTextPt};${safeLine1}[J:c${widthMm}]`,
    `T ${xOffsetMm},${textLine2Y},${contentRotation},3,pt${textLine2Pt};${safeLine2}[J:c${widthMm}]`,
    `T ${xOffsetMm},${textLine3Y},${contentRotation},3,pt${textLine3Pt};${safeLine3}[J:c${widthMm}]`,
    `A ${copies}`
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
