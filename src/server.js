const express = require('express');
const cors = require('cors');
const { buildPrototypeZpl, DEFAULT_TEST_DATA } = require('./zpl');
const { sendWithFallback } = require('./printerClient');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const DEFAULT_PRIMARY_PRINTER_IP = process.env.PRIMARY_PRINTER_IP || '10.10.10.120';
const DEFAULT_FALLBACK_PRINTER_IP = process.env.FALLBACK_PRINTER_IP || '10.10.10.130';
const DEFAULT_PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);

app.disable('x-powered-by');
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN }));
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'i7100-label-print-prototype'
  });
});

app.get('/api/prototype/default-data', (_req, res) => {
  res.json({
    success: true,
    data: {
      testData: DEFAULT_TEST_DATA,
      printer: {
        primaryPrinterIp: DEFAULT_PRIMARY_PRINTER_IP,
        fallbackPrinterIp: DEFAULT_FALLBACK_PRINTER_IP,
        printerPort: DEFAULT_PRINTER_PORT
      }
    }
  });
});

app.post('/api/prototype/print', async (req, res) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};

    const simulate = payload.simulate !== false;
    const primaryPrinterIp = String(payload.primaryPrinterIp || DEFAULT_PRIMARY_PRINTER_IP).trim();
    const fallbackPrinterIp = String(payload.fallbackPrinterIp || DEFAULT_FALLBACK_PRINTER_IP).trim();

    const rawPort = Number(payload.printerPort || DEFAULT_PRINTER_PORT);
    const printerPort = Number.isInteger(rawPort) && rawPort > 0 ? rawPort : DEFAULT_PRINTER_PORT;

    if (!primaryPrinterIp) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PRINTER_IP',
          message: 'primaryPrinterIp is required'
        }
      });
    }

    const result = buildPrototypeZpl(payload.data);

    if (simulate) {
      return res.json({
        success: true,
        data: {
          mode: 'simulate',
          printed: false,
          target: primaryPrinterIp,
          fallbackTarget: fallbackPrinterIp,
          printerPort,
          ...result
        }
      });
    }

    const dispatch = await sendWithFallback({
      zpl: result.zpl,
      primaryPrinterIp,
      fallbackPrinterIp,
      printerPort
    });

    return res.json({
      success: true,
      data: {
        mode: 'print',
        printerPort,
        ...result,
        ...dispatch
      }
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      error: {
        code: error.code || 'PRINTER_DISPATCH_FAILED',
        message: error.message || 'Dispatch to printer failed',
        details: {
          primaryError: error?.primaryError?.message,
          fallbackError: error?.fallbackError?.message
        }
      }
    });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`[prototype] Listening on http://${HOST}:${PORT}`);
});
