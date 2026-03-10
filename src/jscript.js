const MM_PER_INCH = 25.4;
const DEFAULT_DPI = 300;
const DEFAULT_HARDWARE_X_ORIGIN_MM = 2.5;

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

function normalizeMillimeters(value, fallback = 0) {
  const raw = String(value ?? fallback).trim().replace(',', '.');
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function sanitizeJScriptText(text) {
  return String(text ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .trim();
}

function splitLegacyConnectLine(value) {
  const text = String(value || '').trim();
  if (!text) {
    return { system: '', detail: '' };
  }

  const parts = text.split(':').map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 3) {
    return { system: text, detail: '' };
  }

  const system = parts.slice(0, 3).join(':');
  const tail = parts.slice(3).join(':');
  return {
    system,
    detail: tail ? `PP:${tail}` : ''
  };
}

function buildDashedLineCommands(startX, y, totalLength, dashLength = 1.2, gapLength = 0.9, lineWidth = 0.2) {
  const commands = [];
  const maxX = startX + totalLength;
  let currentX = startX;

  while (currentX < maxX) {
    const remaining = maxX - currentX;
    const segment = Math.min(dashLength, remaining);
    if (segment > 0) {
      commands.push(`G ${currentX.toFixed(2)},${y},0;L:${segment.toFixed(2)},${lineWidth}`);
    }
    currentX += dashLength + gapLength;
  }

  return commands;
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

function resolveHardwareXOriginMm() {
  return normalizeMillimeters(
    process.env.HARDWARE_X_ORIGIN_MM,
    DEFAULT_HARDWARE_X_ORIGIN_MM
  );
}

function buildLabelData(input) {
  const source = input && typeof input === 'object' ? input : {};
  const line1 = normalize(source.line1, '');
  const line2 = normalize(source.line2, '');
  const line3 = normalize(source.line3, '');
  const line2aRaw = normalize(source.line2a, '');
  const line2bRaw = normalize(source.line2b, '');
  const line3aRaw = normalize(source.line3a, '');
  const line3bRaw = normalize(source.line3b, '');
  const parsedLine2 = splitLegacyConnectLine(line2);
  const parsedLine3 = splitLegacyConnectLine(line3);
  const qrPayload = resolveQrPayload(source, line1, line2, line3);
  const copies = normalizeCopies(source.copies, 1);

  return {
    line1,
    line2,
    line3,
    line2a: line2aRaw || parsedLine2.system,
    line2b: line2bRaw || parsedLine2.detail,
    line3a: line3aRaw || parsedLine3.system,
    line3b: line3bRaw || parsedLine3.detail,
    qrPayload,
    copies
  };
}

function buildI7100JScript(input) {
  const data = buildLabelData(input);

  const widthMm = 38.1;
  const heightMm = 101.6;
  const hardwareXOriginMm = resolveHardwareXOriginMm();
  const printAreaHeightMm = 50.8;
  const foldHalfHeightMm = 25.4;
  const printAreaOffsetYMm = heightMm - printAreaHeightMm;
  
  const widthDots = mmToDots(widthMm);
  const labelHeightDots = mmToDots(heightMm);
  const printAreaDots = mmToDots(printAreaHeightMm);
  const halfAreaDots = Math.floor(printAreaDots / 2);

  const safeLine1 = sanitizeJScriptText(data.line1);
  const safeLine2a = sanitizeJScriptText(data.line2a);
  const safeLine2b = sanitizeJScriptText(data.line2b);
  const safeLine3a = sanitizeJScriptText(data.line3a);
  const safeLine3b = sanitizeJScriptText(data.line3b);
  const safeQrPayload = sanitizeJScriptText(data.qrPayload);
  const safeSerial = safeLine1;
  const copies = normalizeCopies(data.copies, 1);
  const line1Pt = calcPointSize(safeLine1, 14, 8, 18);
  const line2aPt = calcPointSize(safeLine2a, 8, 6, 18);
  const line2bPt = calcPointSize(safeLine2b, 8, 6, 24);
  const line3aPt = calcPointSize(safeLine3a, 8, 6, 18);
  const line3bPt = calcPointSize(safeLine3b, 8, 6, 24);
  const contentRotation = 0;
  const qrModuleSize = 0.85;
  const contentStartXMm = 0;
  const usableWidthMm = widthMm;
  const qrX = usableWidthMm / 2 - 8.5;
  const yOffsetMm = -printAreaHeightMm;
  const foldLineY = printAreaOffsetYMm + foldHalfHeightMm;
  const cutLineY = foldLineY + yOffsetMm;
  const qrY = printAreaOffsetYMm + 2.6 + yOffsetMm;
  const serialUnderQrY = cutLineY - 1.4;
  const textBlockYOffset = 2.0;
  const textSerialY = foldLineY + 2.8 + yOffsetMm + textBlockYOffset;
  const textLine2aY = foldLineY + 7.8 + yOffsetMm + textBlockYOffset;
  const textLine2bY = foldLineY + 11.4 + yOffsetMm + textBlockYOffset;
  const textLine3aY = foldLineY + 17.8 + yOffsetMm + textBlockYOffset;
  const textLine3bY = foldLineY + 21.4 + yOffsetMm + textBlockYOffset;
  const serialTextPt = Math.max(Math.min(line1Pt, 11), 10);
  const textLine2aPt = Math.min(line2aPt, 8);
  const detailLineOverflowThreshold = 23;
  const detailLineLegacyPt = 6;
  const textLine2bPt =
    safeLine2b.length > detailLineOverflowThreshold ? detailLineLegacyPt : Math.min(line2bPt, 8);
  const textLine3aPt = Math.min(line3aPt, 8);
  const textLine3bPt =
    safeLine3b.length > detailLineOverflowThreshold ? detailLineLegacyPt : Math.min(line3bPt, 8);
  const cutLineStartX = 2;
  const cutLineLength = usableWidthMm - 4;
  const cutLineYOffset = 1.2;
  const cutLineCommands = buildDashedLineCommands(cutLineStartX, cutLineY + cutLineYOffset, cutLineLength);

  // The cab printer expects its line-oriented JScript command set, not JavaScript-like function calls.
  const jscript = buildJob([
    'm m',
    'J',
    `S l1;${hardwareXOriginMm.toFixed(2)},0,${heightMm},${heightMm},${widthMm}`,
    'O R',
    'C e',
    `B ${qrX},${qrY},${contentRotation},QRCODE+MODEL2+WS1,${qrModuleSize};${safeQrPayload}`,
    `T ${contentStartXMm},${serialUnderQrY},${contentRotation},3,pt8;${safeSerial}[J:c${usableWidthMm}]`,
    ...cutLineCommands,
    `T ${contentStartXMm},${textSerialY},${contentRotation},3,pt${serialTextPt};${safeLine1}[J:c${usableWidthMm}]`,
    `T ${contentStartXMm},${textLine2aY},${contentRotation},3,pt${textLine2aPt};${safeLine2a}[J:c${usableWidthMm}]`,
    `T ${contentStartXMm},${textLine2bY},${contentRotation},3,pt${textLine2bPt};${safeLine2b}[J:c${usableWidthMm}]`,
    `T ${contentStartXMm},${textLine3aY},${contentRotation},3,pt${textLine3aPt};${safeLine3a}[J:c${usableWidthMm}]`,
    `T ${contentStartXMm},${textLine3bY},${contentRotation},3,pt${textLine3bPt};${safeLine3b}[J:c${usableWidthMm}]`,
    `A ${copies}`
  ]);

  return {
    jscript,
    data,
    layout: {
      widthMm,
      heightMm,
      hardwareXOriginMm,
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
