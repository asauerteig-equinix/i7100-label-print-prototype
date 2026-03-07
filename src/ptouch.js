function normalize(value) {
  return String(value ?? '').trim();
}

function sanitizeEscpText(value) {
  // Strip control characters that could break command framing.
  return String(value || '').replace(/[\x00-\x1F\x7F]/g, ' ').trim();
}

function buildPatchPanelEscp(input) {
  const source = input && typeof input === 'object' ? input : {};
  const serial = normalize(source.line1 || source.serial || source.value);
  const text = sanitizeEscpText(serial);

  const ESC = 0x1b;
  const CR = 0x0d;
  const LF = 0x0a;
  const FF = 0x0c;

  const payload = Buffer.concat([
    Buffer.from([ESC, 0x40]),
    Buffer.from(text, 'ascii'),
    Buffer.from([CR, LF, FF])
  ]);

  return {
    protocol: 'escp',
    rawPayload: payload,
    rawPreviewHex: payload.toString('hex'),
    data: {
      line1: serial
    },
    layout: {
      widthMm: 42,
      heightMm: 9,
      dpi: 300
    }
  };
}

module.exports = {
  buildPatchPanelEscp
};
