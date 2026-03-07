const express = require('express');
const cors = require('cors');
const { buildPrototypeZpl } = require('./zpl');
const { buildPatchPanelEscp } = require('./ptouch');
const { sendWithFallback } = require('./printerClient');

const app = express();

const PORT = Number(process.env.PORT || 5100);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const DEFAULT_PRIMARY_PRINTER_IP = process.env.PRIMARY_PRINTER_IP || '10.145.162.22';
const DEFAULT_FALLBACK_PRINTER_IP = process.env.FALLBACK_PRINTER_IP || '10.145.162.32';
const DEFAULT_PRINTER_PORT = Number(process.env.PRINTER_PORT || 9100);

const LABEL_TYPE_I7100 = 'i7100';
const LABEL_TYPE_PATCH_PANEL = 'patch-panel';
const PROTOCOL_ZPL = 'zpl';
const PROTOCOL_ESCP = 'escp';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function parseLabelType(value) {
  return normalizeText(value || LABEL_TYPE_I7100).toLowerCase().replace(/_/g, '-');
}

function parseProtocol(value) {
  return normalizeText(value).toLowerCase().replace(/_/g, '-');
}

function expectedProtocolFor(labelType) {
  if (labelType === LABEL_TYPE_I7100) {
    return PROTOCOL_ZPL;
  }
  if (labelType === LABEL_TYPE_PATCH_PANEL) {
    return PROTOCOL_ESCP;
  }
  return '';
}

function sendValidationError(res, message, fields = [], status = 422) {
  return res.status(status).json({
    success: false,
    error: {
      code: 'VALIDATION_FAILED',
      message,
      fields
    }
  });
}

function validateI7100Data(data) {
  const source = data && typeof data === 'object' ? data : {};
  const required = ['line1', 'line2', 'line3'];
  const missing = required.filter((field) => !normalizeText(source[field]));

  if (missing.length > 0) {
    return {
      ok: false,
      message: 'Cross-Connect Daten unvollstaendig: bitte Details laden und erneut drucken.',
      fields: missing.map((name) => `data.${name}`)
    };
  }

  return { ok: true };
}

function validatePatchPanelData(data) {
  const source = data && typeof data === 'object' ? data : {};
  const serial = normalizeText(source.line1 || source.serial || source.value);

  if (!serial) {
    return {
      ok: false,
      message: 'Patch-Panel Daten unvollstaendig: Seriennummer fehlt.',
      fields: ['data.line1']
    };
  }

  return { ok: true };
}

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
      supportedLabelTypes: [LABEL_TYPE_I7100, LABEL_TYPE_PATCH_PANEL],
      supportedProtocols: [PROTOCOL_ZPL, PROTOCOL_ESCP],
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
    const data = payload.data && typeof payload.data === 'object' ? payload.data : {};

    const simulate = payload.simulate !== false;
    const primaryPrinterIp = normalizeText(payload.primaryPrinterIp || DEFAULT_PRIMARY_PRINTER_IP);
    const fallbackPrinterIp = normalizeText(payload.fallbackPrinterIp || DEFAULT_FALLBACK_PRINTER_IP);

    const rawPort = Number(payload.printerPort || DEFAULT_PRINTER_PORT);
    const printerPort = Number.isInteger(rawPort) && rawPort > 0 ? rawPort : DEFAULT_PRINTER_PORT;

    if (!primaryPrinterIp) {
      return sendValidationError(res, 'Drucker nicht konfiguriert: primaryPrinterIp fehlt.', ['primaryPrinterIp']);
    }

    const labelType = parseLabelType(payload.labelType);
    const expectedProtocol = expectedProtocolFor(labelType);

    if (!expectedProtocol) {
      return sendValidationError(
        res,
        `Ungueltiger labelType: ${labelType}. Erlaubt sind i7100 oder patch-panel.`,
        ['labelType']
      );
    }

    const printerProtocol = parseProtocol(payload.printerProtocol || expectedProtocol);
    if (printerProtocol !== expectedProtocol) {
      return sendValidationError(
        res,
        `Falsches Protokoll fuer ${labelType}: erwartet ${expectedProtocol}, erhalten ${printerProtocol || 'leer'}.`,
        ['printerProtocol']
      );
    }

    let result = null;
    let printPayload = null;

    if (labelType === LABEL_TYPE_I7100) {
      const validation = validateI7100Data(data);
      if (!validation.ok) {
        return sendValidationError(res, validation.message, validation.fields);
      }

      result = buildPrototypeZpl(data);
      printPayload = result.zpl;
    } else if (labelType === LABEL_TYPE_PATCH_PANEL) {
      const validation = validatePatchPanelData(data);
      if (!validation.ok) {
        return sendValidationError(res, validation.message, validation.fields);
      }

      result = buildPatchPanelEscp(data);
      printPayload = result.rawPayload;
    }

    const responseResult = { ...result };
    delete responseResult.rawPayload;
    delete responseResult.protocol;

    if (simulate) {
      return res.json({
        success: true,
        data: {
          mode: 'simulate',
          printed: false,
          target: primaryPrinterIp,
          fallbackTarget: fallbackPrinterIp,
          printerPort,
          labelType,
          printerProtocol,
          ...responseResult
        }
      });
    }

    const dispatch = await sendWithFallback({
      payload: printPayload,
      protocol: printerProtocol,
      primaryPrinterIp,
      fallbackPrinterIp,
      printerPort
    });

    return res.json({
      success: true,
      data: {
        mode: 'print',
        printerPort,
        labelType,
        printerProtocol,
        ...responseResult,
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

app.use((error, _req, res, next) => {
  if (error && error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Ungueltiger JSON-Body. Bitte Request-Format pruefen.'
      }
    });
  }
  return next(error);
});

app.listen(PORT, HOST, () => {
  console.log(`[prototype] Listening on http://${HOST}:${PORT}`);
});
