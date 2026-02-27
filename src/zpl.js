const MM_PER_INCH = 25.4;
const DEFAULT_DPI = 300;

const DEFAULT_TEST_DATA = {
  line1: '21304050',
  ibx: 'FR2',
  floor: '0G',
  cabinet: '0101',
  number: '123456',
  portA: '11',
  portB: '12'
};

function mmToDots(mm, dpi = DEFAULT_DPI) {
  return Math.round((Number(mm) / MM_PER_INCH) * Number(dpi));
}

function normalize(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function buildLabelData(input) {
  const source = input && typeof input === 'object' ? input : {};
  const merged = { ...DEFAULT_TEST_DATA, ...source };

  const line1 = normalize(merged.line1, DEFAULT_TEST_DATA.line1);
  const ibx = normalize(merged.ibx, DEFAULT_TEST_DATA.ibx);
  const floor = normalize(merged.floor, DEFAULT_TEST_DATA.floor);
  const cabinet = normalize(merged.cabinet, DEFAULT_TEST_DATA.cabinet);
  const number = normalize(merged.number, DEFAULT_TEST_DATA.number);
  const portA = normalize(merged.portA, DEFAULT_TEST_DATA.portA);
  const portB = normalize(merged.portB, DEFAULT_TEST_DATA.portB);

  const codeLine = `IBX:${ibx}:${floor}:${cabinet}:${number}:${portA}+${portB}`;

  return {
    line1,
    line2: codeLine,
    line3: codeLine,
    qrPayload: codeLine,
    fields: { ibx, floor, cabinet, number, portA, portB }
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
    `^FO0,30^A0N,42,42^FB${widthDots},1,0,C,0^FDLine#1 ${data.line1}^FS`,
    `^FO0,90^A0N,26,26^FB${widthDots},1,0,C,0^FDLine#2 ${data.line2}^FS`,
    `^FO0,126^A0N,26,26^FB${widthDots},1,0,C,0^FDLine#3 ${data.line3}^FS`,
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

module.exports = {
  buildPrototypeZpl,
  DEFAULT_TEST_DATA
};
