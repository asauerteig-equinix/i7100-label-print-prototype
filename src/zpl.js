const MM_PER_INCH = 25.4;
const DEFAULT_DPI = 300;

function mmToDots(mm, dpi = DEFAULT_DPI) {
  return Math.round((Number(mm) / MM_PER_INCH) * Number(dpi));
}

function normalize(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
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

function buildPrototypeZpl(input) {
  const data = buildLabelData(input);

  const widthDots = mmToDots(38.1);
  const labelHeightDots = mmToDots(101.6);
  const printAreaDots = mmToDots(50.8);
  const halfAreaDots = Math.floor(printAreaDots / 2);
  const qrTop = halfAreaDots + 20;

  const zpl = [
    '^XA',
    '^CI28',
    `^PW${widthDots}`,
    `^LL${printAreaDots}`,
    '^LH0,0',
    `^FO0,20^A0N,36,36^FB${widthDots},1,0,C,0^FD${data.line1}^FS`,
    `^FO0,70^A0N,22,22^FB${widthDots},1,0,C,0^FD${data.line2}^FS`,
    `^FO0,100^A0N,22,22^FB${widthDots},1,0,C,0^FD${data.line3}^FS`,
    `^FO20,${halfAreaDots}^GB${Math.max(widthDots - 40, 10)},2,2^FS`,
    `^FO95,${qrTop}^BQN,2,5^FDLA,${data.qrPayload}^FS`,
    '^XZ'
  ].join('\n');

  return {
    zpl,
    data,
    layout: {
      widthMm: 38.1,
      heightMm: 101.6,
      printAreaHeightMm: 50.8,
      foldHalfHeightMm: 25.4,
      widthDots,
      labelHeightDots,
      printAreaDots,
      halfAreaDots,
      dpi: DEFAULT_DPI
    }
  };
}

function buildPatchPanelZpl(input) {
  const source = input && typeof input === 'object' ? input : {};
  const serial = normalize(source.line1 || source.serial || source.value, '');

  const widthMm = 42;
  const heightMm = 9;
  const widthDots = mmToDots(widthMm);
  const heightDots = mmToDots(heightMm);

  const fontHeight = 28;
  const fontWidth = 28;
  const topOffset = Math.max(Math.floor((heightDots - fontHeight) / 2), 0);

  const zpl = [
    '^XA',
    '^CI28',
    `^PW${widthDots}`,
    `^LL${heightDots}`,
    '^LH0,0',
    `^FO0,${topOffset}^A0N,${fontHeight},${fontWidth}^FB${widthDots},1,0,C,0^FD${serial}^FS`,
    '^XZ'
  ].join('\n');

  return {
    zpl,
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
  buildPrototypeZpl,
  buildPatchPanelZpl
};
