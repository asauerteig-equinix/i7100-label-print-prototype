const MM_PER_INCH = 25.4;
const DEFAULT_DPI = 300;

function mmToDots(mm, dpi = DEFAULT_DPI) {
  return Math.round((Number(mm) / MM_PER_INCH) * Number(dpi));
}

function normalize(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function escapeJScript(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
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

  // Keep payload parser-safe for the printer-side JScript interpreter.
  const jscript = [
    'var printer = new ActiveXObject("SAT_PPL.Application");',
    `printer.SetLabelWidth(${widthMm});`,
    `printer.SetLabelHeight(${printAreaHeightMm});`,
    `printer.SetPrintDensity(${DEFAULT_DPI});`,
    'printer.SetOrientation("Portrait");',
    'printer.SetCharacterSet("UTF-8");',
    `printer.PrintText(0, 2, "${escapeJScript(data.line1)}", 36, 36, "center", ${widthMm});`,
    `printer.PrintText(0, 7, "${escapeJScript(data.line2)}", 22, 22, "center", ${widthMm});`,
    `printer.PrintText(0, 10, "${escapeJScript(data.line3)}", 22, 22, "center", ${widthMm});`,
    `printer.DrawLine(2, ${foldHalfHeightMm}, ${widthMm - 4}, ${foldHalfHeightMm}, 0.5);`,
    `printer.PrintQRCode(${widthMm / 2 - 7}, ${foldHalfHeightMm + 2}, "LA,${escapeJScript(data.qrPayload)}", 5, "M");`,
    'printer.Print();'
  ].join('\r\n');

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

  const jscript = [
    'var printer = new ActiveXObject("SAT_PPL.Application");',
    `printer.SetLabelWidth(${widthMm});`,
    `printer.SetLabelHeight(${heightMm});`,
    `printer.SetPrintDensity(${DEFAULT_DPI});`,
    'printer.SetCharacterSet("UTF-8");',
    `printer.PrintText(0, ${heightMm / 2 - 2}, "${escapeJScript(serial)}", 28, 28, "center", ${widthMm});`,
    'printer.Print();'
  ].join('\r\n');

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
