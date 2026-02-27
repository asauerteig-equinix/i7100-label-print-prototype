// ==UserScript==
// @name         i7100 Label Prototype Button
// @namespace    https://local.i7100.prototype
// @version      0.1.0
// @description  Adds a test print button and sends fixed data to local print prototype API.
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    apiUrl: 'http://127.0.0.1:3000/api/prototype/print',
    simulate: true,
    primaryPrinterIp: '10.10.10.120',
    fallbackPrinterIp: '10.10.10.130',
    printerPort: 9100
  };

  const TEST_DATA = {
    line1: '21304050',
    ibx: 'FR2',
    floor: '0G',
    cabinet: '0101',
    number: '123456',
    portA: '11',
    portB: '12'
  };

  const BUTTON_ID = 'i7100-prototype-print-btn';

  function showMessage(msg) {
    window.alert(msg);
  }

  function setBusy(button, busy) {
    button.disabled = busy;
    button.style.opacity = busy ? '0.7' : '1';
    button.style.cursor = busy ? 'wait' : 'pointer';
    button.textContent = busy ? 'Sende Label…' : 'Test-Label drucken';
  }

  function printTestLabel(button) {
    const payload = {
      simulate: CONFIG.simulate,
      primaryPrinterIp: CONFIG.primaryPrinterIp,
      fallbackPrinterIp: CONFIG.fallbackPrinterIp,
      printerPort: CONFIG.printerPort,
      data: TEST_DATA
    };

    setBusy(button, true);

    GM_xmlhttpRequest({
      method: 'POST',
      url: CONFIG.apiUrl,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(payload),
      timeout: 12000,
      onload(response) {
        setBusy(button, false);

        let body = null;
        try {
          body = JSON.parse(response.responseText || '{}');
        } catch {
          body = null;
        }

        if (response.status >= 200 && response.status < 300 && body?.success) {
          const mode = body.data?.mode || (CONFIG.simulate ? 'simulate' : 'print');
          const target = body.data?.target || CONFIG.primaryPrinterIp;
          showMessage(`OK: ${mode} auf ${target}`);
          return;
        }

        const err = body?.error?.message || `HTTP ${response.status}`;
        showMessage(`Fehler: ${err}`);
      },
      onerror() {
        setBusy(button, false);
        showMessage('Netzwerkfehler beim API-Call');
      },
      ontimeout() {
        setBusy(button, false);
        showMessage('Timeout beim API-Call');
      }
    });
  }

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Test-Label drucken';

    Object.assign(button.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '2147483647',
      backgroundColor: '#0f62fe',
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      padding: '10px 14px',
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      cursor: 'pointer'
    });

    button.addEventListener('click', () => printTestLabel(button));

    document.body.appendChild(button);
  }

  function start() {
    if (!document.body) {
      return;
    }
    injectButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
