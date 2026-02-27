const net = require('net');

function sendRawZpl({ printerIp, printerPort = 9100, zpl, timeoutMs = 5000 }) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;
    const startedAt = Date.now();

    function finish(error) {
      if (done) {
        return;
      }
      done = true;
      socket.destroy();

      if (error) {
        reject(error);
        return;
      }

      resolve({
        printerIp,
        printerPort,
        durationMs: Date.now() - startedAt
      });
    }

    socket.setTimeout(timeoutMs);

    socket.once('error', (error) => finish(error));
    socket.once('timeout', () => finish(new Error(`Printer timeout after ${timeoutMs}ms`)));

    socket.connect(printerPort, printerIp, () => {
      socket.write(zpl, (error) => {
        if (error) {
          finish(error);
          return;
        }
        socket.end();
      });
    });

    socket.once('close', (hadError) => {
      if (!hadError) {
        finish();
      }
    });
  });
}

async function sendWithFallback({ zpl, primaryPrinterIp, fallbackPrinterIp, printerPort = 9100 }) {
  const primary = await sendRawZpl({
    printerIp: primaryPrinterIp,
    printerPort,
    zpl
  }).catch((error) => ({ error }));

  if (!primary.error) {
    return {
      printed: true,
      usedFallback: false,
      target: primaryPrinterIp,
      dispatch: primary
    };
  }

  const fallbackUsable =
    Boolean(fallbackPrinterIp) && String(fallbackPrinterIp).trim() !== String(primaryPrinterIp).trim();

  if (!fallbackUsable) {
    throw Object.assign(new Error(primary.error.message || 'Primary printer failed'), {
      code: 'PRIMARY_PRINTER_FAILED',
      primaryError: primary.error
    });
  }

  const fallback = await sendRawZpl({
    printerIp: fallbackPrinterIp,
    printerPort,
    zpl
  }).catch((error) => ({ error }));

  if (fallback.error) {
    throw Object.assign(new Error(fallback.error.message || 'Fallback printer failed'), {
      code: 'ALL_PRINTERS_FAILED',
      primaryError: primary.error,
      fallbackError: fallback.error
    });
  }

  return {
    printed: true,
    usedFallback: true,
    target: fallbackPrinterIp,
    dispatch: fallback
  };
}

module.exports = {
  sendRawZpl,
  sendWithFallback
};
