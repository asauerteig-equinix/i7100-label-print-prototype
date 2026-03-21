// ==UserScript==
// @name         i7100 Label Print Button
// @namespace    https://local.i7100.label
// @version      0.1.17
// @description  Adds different buttons to Jarvis activity pages for label printing and audit creation
// @match        https://jarvis-emea.equinix.com/*
// @downloadURL  http://fr2lxcops01.corp.equinix.com:5100/scripts/i7100-tampermonkey.user.js
// @updateURL    http://fr2lxcops01.corp.equinix.com:5100/scripts/i7100-tampermonkey.user.js
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @connect      fr2lxcops01
// @connect      fr2lxcops01.corp.equinix.com
// ==/UserScript==

(function () {
  'use strict';

  // =========================
  // USER UPDATE AREA
  // =========================
  // Keep all frequently changing values in this block.
  // If Jarvis changes labels, keywords, or CSS classes, update them here first.
  const USER_CONFIG = {
    activation: {
      // Runtime hostname guard in addition to Tampermonkey @match.
      allowedHostPatterns: [/jarvis-emea\.equinix\.com$/i],
      pageTitleSelector: '.ttFrameTitleTxt',
      connectKeywords: ['connect'],
      patchPanelKeywords: ['patch panel'],
      physicalAuditKeywords: ['physical audit']
    },
    selectors: {
      currentIbxValue: ['.ttFrameIBX'],
      serialNumberValue: ['.SHSerialNum'],
      serialFieldContainer: ['.ttFrameFieldItem.CopyBtnSH'],
      serialFieldLabel: ['label'],
      serialCopyButton: ['button.btn.mx-button'],
      attributeItems: ['.extd-AttributeItem.installActivityAttribute'],
      attributeLabel: ['.extd-AttributeLbl'],
      attributeValue: ['.extd-AttributeValue'],
      fullPathRows: ['.extd-activityPortGridRow'],
      fullPathActivityBlocks: ['.extd-activityPortAct'],
      fullPathSideLabel: ['.extd-activityPortSide.fullPath'],
      fullPathSystemName: ['.extd-activityPortSysname h6.extd-activityPortActNumber'],
      patchPanelCode: ['.extd-FullPatchPanCol h6.extd-activityPortActNumber.text-bold'],
      portsGroup: ['.extd-portsAB-FullPath'],
      portLabel: ['.lbl'],
      portValue: ['h6.extd-activityPortActNumber'],
      labeledFieldContainers: [
        '.extd-AttributeItem.installActivityAttribute',
        '.ttFrameFieldItem',
        '[class*="FieldItem"]',
        '[class*="field-item"]',
        '.mx-field',
        '.form-group'
      ],
      labeledFieldLabel: [
        '.extd-AttributeLbl',
        'label',
        '.lbl',
        '[class*="FieldLabel"]',
        '[class*="field-label"]',
        'strong'
      ],
      labeledFieldValue: [
        '.extd-AttributeValue',
        '[class*="FieldValue"]',
        '[class*="field-value"]',
        '.value',
        '.mx-text'
      ],
      sectionHeading: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'legend',
        '.card-title',
        '.panel-title',
        '[class*="card-title"]',
        '[class*="panel-title"]',
        '[class*="CardTitle"]',
        '[class*="PanelTitle"]',
        'div',
        'span'
      ],
      sectionContainers: [
        '.card',
        '.panel',
        '.ttFrameCard',
        '[class*="card"]',
        '[class*="Card"]',
        '[class*="panel"]',
        '[class*="Panel"]',
        'section',
        'article'
      ]
    },
    labels: {
      serialFieldLabels: ['Serial No.', 'Serial Number'],
      finalASystemNameLabels: ['Final A-side System Name'],
      finalZSystemNameLabels: ['Final Z-side System Name'],
      sideAValues: ['A'],
      sideZValues: ['Z'],
      portAValues: ['Port A', 'A Port'],
      portBValues: ['Port B', 'B Port'],
      customerContactCardTitles: ['Customer contact information'],
      customerContactButtonTitles: ['Customer Contact Information'],
      auditSiteLabels: ['Site', 'Site Name', 'IBX', 'IBX Name'],
      auditRoomLabels: ['Room', 'Room Name', 'MMR', 'Meet-Me Room'],
      auditSalesOrderLabels: ['Sales Order No.', 'Sales Order', 'Sales Order Number', 'Order Number'],
      auditCustomerLabels: ['Customer', 'Customer Name', 'Company', 'Company Name', 'Account Name'],
      auditRackLabels: ['Cabinet No.', 'Rack', 'Rack Name', 'Cabinet', 'Cabinet Name', 'Initial Rack'],
      auditRackUnitsLabels: ['Rack Units', 'Rack Unit', 'RU', 'Initial Rack Units', 'Units']
    },
    behavior: {
      checkIntervalMs: 2000,
      defaultConnectLabelCount: 2,
      minConnectLabelCount: 1,
      maxConnectLabelCount: 50
    }
  };

  // Single toggle to control whether API calls should print or only simulate.
  const SIMULATE_MODE = false;

  const CONFIG = {
    apiUrl: 'http://fr2lxcops01:5100/api/label/print',
    auditApiUrl: 'http://fr2lxcops01.corp.equinix.com:5500/api/integrations/audits',
    simulate: SIMULATE_MODE,
    primaryPrinterIp: '10.145.162.22',
    fallbackPrinterIp: '10.145.162.32',
    patchPanelPrinterIp: '10.145.162.23',
    printerPort: 9100
  };

  const BUTTON_ID = 'i7100-label-print-btn';
  const PATCH_PANEL_BUTTON_ID = 'i7100-ptp950-print-btn';
  const AUDIT_BUTTON_ID = 'aethercad-audit-create-btn';
  const AUDIT_BUTTON_ROW_ID = 'aethercad-audit-button-row';
  const AUDIT_BUTTON_SLOT_ID = 'aethercad-audit-button-slot';
  const PATCH_PANEL_LABEL = {
    widthMm: 42,
    heightMm: 9,
    previewScale: 4
  };
  let connectBatchInFlight = false;
  let auditRequestInFlight = false;

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function equalsAny(value, candidates) {
    const normalized = normalizeText(value);
    return (candidates || []).some((candidate) => normalizeText(candidate) === normalized);
  }

  function includesAny(value, keywords) {
    const normalized = normalizeText(value);
    return (keywords || []).some((keyword) => normalized.includes(normalizeText(keyword)));
  }

  function queryFirst(selectors, root = document) {
    for (const selector of selectors || []) {
      const match = root.querySelector(selector);
      if (match) {
        return match;
      }
    }
    return null;
  }

  function queryAll(selectors, root = document) {
    const results = [];
    for (const selector of selectors || []) {
      const matches = root.querySelectorAll(selector);
      for (const node of matches) {
        results.push(node);
      }
    }
    return results;
  }

  function getPageTitleText() {
    const title = queryFirst([USER_CONFIG.activation.pageTitleSelector]);
    return title ? title.textContent.trim() : '';
  }

  function isHostAllowed() {
    const host = window.location.hostname;
    return USER_CONFIG.activation.allowedHostPatterns.some((pattern) => pattern.test(host));
  }

  function showMessage(msg) {
    window.alert(msg);
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function safeParseJson(text) {
    try {
      return JSON.parse(text || '{}');
    } catch {
      return null;
    }
  }

  function showConnectLabelPreview(data, onPrimaryPrint, onSecondaryPrint) {
    const line1 = String(data?.line1 || '').trim();
    const line2a = String(data?.line2a || data?.line2 || '').trim();
    const line2b = String(data?.line2b || '').trim();
    const line3a = String(data?.line3a || data?.line3 || '').trim();
    const line3b = String(data?.line3b || '').trim();
    const existing = document.getElementById('i7100-connect-label-preview');
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'i7100-connect-label-preview';

    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      backgroundColor: '#fff',
      padding: '20px',
      borderRadius: '10px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
      minWidth: '320px',
      fontFamily: 'Arial, sans-serif'
    });

    const title = document.createElement('div');
    title.textContent = 'i7100 Label Vorschau';
    Object.assign(title.style, {
      fontSize: '16px',
      fontWeight: '600',
      marginBottom: '14px',
      textAlign: 'center'
    });

    const labelContainer = document.createElement('div');
    Object.assign(labelContainer.style, {
      border: '2px solid #222',
      backgroundColor: '#fff',
      borderRadius: '4px',
      padding: '12px',
      marginBottom: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    });

    const createLine = (text, size) => {
      const line = document.createElement('div');
      line.textContent = text;
      Object.assign(line.style, {
        fontSize: size,
        fontWeight: '600',
        textAlign: 'center',
        wordBreak: 'break-word'
      });
      return line;
    };

    const qrPlaceholder = document.createElement('div');
    qrPlaceholder.textContent = '[QR Code]';
    Object.assign(qrPlaceholder.style, {
      fontSize: '10px',
      color: '#666',
      textAlign: 'center',
      padding: '12px',
      border: '1px dashed #999'
    });
    labelContainer.appendChild(qrPlaceholder);

    labelContainer.appendChild(createLine(line1, '11px'));

    const separator = document.createElement('div');
    Object.assign(separator.style, {
      height: '2px',
      backgroundColor: '#333',
      margin: '6px 0'
    });
    labelContainer.appendChild(separator);

    labelContainer.appendChild(createLine(line1, '14px'));
    labelContainer.appendChild(createLine(line2a, '11px'));
    labelContainer.appendChild(createLine(line2b, '11px'));

    const spacer = document.createElement('div');
    Object.assign(spacer.style, {
      height: '6px'
    });
    labelContainer.appendChild(spacer);

    labelContainer.appendChild(createLine(line3a, '11px'));
    labelContainer.appendChild(createLine(line3b, '11px'));

    const hint = document.createElement('div');
    hint.textContent = '38.1 x 101.6mm (Druckbereich: 50.8mm)';
    Object.assign(hint.style, {
      fontSize: '12px',
      color: '#555',
      marginBottom: '14px',
      textAlign: 'center'
    });

    const countRow = document.createElement('div');
    Object.assign(countRow.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '10px',
      marginBottom: '12px'
    });

    const countLabel = document.createElement('label');
    countLabel.textContent = 'Anzahl Labels';
    Object.assign(countLabel.style, {
      fontSize: '13px',
      fontWeight: '600',
      color: '#333'
    });

    const countInput = document.createElement('input');
    countInput.type = 'number';
    countInput.min = String(USER_CONFIG.behavior.minConnectLabelCount);
    countInput.max = String(USER_CONFIG.behavior.maxConnectLabelCount);
    countInput.step = '1';
    countInput.value = String(USER_CONFIG.behavior.defaultConnectLabelCount);
    Object.assign(countInput.style, {
      width: '90px',
      padding: '6px 8px',
      border: '1px solid #c6c6c6',
      borderRadius: '6px',
      fontSize: '13px'
    });

    const countControls = document.createElement('div');
    Object.assign(countControls.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    });

    const minusButton = document.createElement('button');
    minusButton.type = 'button';
    minusButton.textContent = '-';
    Object.assign(minusButton.style, {
      border: '1px solid #9e9e9e',
      backgroundColor: '#f4f4f4',
      color: '#111',
      width: '28px',
      height: '28px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '700',
      lineHeight: '1'
    });

    const plusButton = document.createElement('button');
    plusButton.type = 'button';
    plusButton.textContent = '+';
    Object.assign(plusButton.style, {
      border: '1px solid #9e9e9e',
      backgroundColor: '#f4f4f4',
      color: '#111',
      width: '28px',
      height: '28px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: '700',
      lineHeight: '1'
    });

    function sanitizeCountValue() {
      const raw = Number.parseInt(String(countInput.value || '').trim(), 10);
      const fallback = USER_CONFIG.behavior.defaultConnectLabelCount;
      const min = USER_CONFIG.behavior.minConnectLabelCount;
      const max = USER_CONFIG.behavior.maxConnectLabelCount;
      const parsed = Number.isFinite(raw) ? raw : fallback;
      const clamped = Math.max(min, Math.min(max, parsed));
      countInput.value = String(clamped);
      return clamped;
    }

    minusButton.addEventListener('click', () => {
      const current = sanitizeCountValue();
      const min = USER_CONFIG.behavior.minConnectLabelCount;
      countInput.value = String(Math.max(min, current - 1));
    });

    plusButton.addEventListener('click', () => {
      const current = sanitizeCountValue();
      const max = USER_CONFIG.behavior.maxConnectLabelCount;
      countInput.value = String(Math.min(max, current + 1));
    });

    countInput.addEventListener('blur', sanitizeCountValue);
    countInput.addEventListener('change', sanitizeCountValue);

    countRow.appendChild(countLabel);
    countControls.appendChild(minusButton);
    countControls.appendChild(countInput);
    countControls.appendChild(plusButton);
    countRow.appendChild(countControls);

    const buttonRow = document.createElement('div');
    Object.assign(buttonRow.style, {
      display: 'flex',
      gap: '8px',
      marginBottom: '10px'
    });

    const primaryPrint = document.createElement('button');
    primaryPrint.type = 'button';
    primaryPrint.textContent = 'Primary i7100';
    Object.assign(primaryPrint.style, {
      border: 'none',
      backgroundColor: '#0f62fe',
      color: '#fff',
      padding: '10px 12px',
      borderRadius: '6px',
      cursor: 'pointer',
      width: '50%',
      fontSize: '13px'
    });

    const secondaryPrint = document.createElement('button');
    secondaryPrint.type = 'button';
    secondaryPrint.textContent = 'Secondary i7100';
    Object.assign(secondaryPrint.style, {
      border: 'none',
      backgroundColor: '#393939',
      color: '#fff',
      padding: '10px 12px',
      borderRadius: '6px',
      cursor: 'pointer',
      width: '50%',
      fontSize: '13px'
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Schließen';
    Object.assign(close.style, {
      border: 'none',
      backgroundColor: '#6f6f6f',
      color: '#fff',
      padding: '10px 16px',
      borderRadius: '6px',
      cursor: 'pointer',
      width: '100%',
      fontSize: '14px'
    });

    function setPreviewBusy(busy) {
      primaryPrint.disabled = busy;
      secondaryPrint.disabled = busy;
      close.disabled = busy;
      countInput.disabled = busy;
      minusButton.disabled = busy;
      plusButton.disabled = busy;
      primaryPrint.style.opacity = busy ? '0.7' : '1';
      secondaryPrint.style.opacity = busy ? '0.7' : '1';
      close.style.opacity = busy ? '0.7' : '1';
      countInput.style.opacity = busy ? '0.8' : '1';
      minusButton.style.opacity = busy ? '0.7' : '1';
      plusButton.style.opacity = busy ? '0.7' : '1';
      primaryPrint.style.cursor = busy ? 'wait' : 'pointer';
      secondaryPrint.style.cursor = busy ? 'wait' : 'pointer';
      close.style.cursor = busy ? 'wait' : 'pointer';
      minusButton.style.cursor = busy ? 'wait' : 'pointer';
      plusButton.style.cursor = busy ? 'wait' : 'pointer';
    }

    function getSelectedLabelCount() {
      const raw = Number.parseInt(String(countInput.value || '').trim(), 10);
      const fallback = USER_CONFIG.behavior.defaultConnectLabelCount;
      const min = USER_CONFIG.behavior.minConnectLabelCount;
      const max = USER_CONFIG.behavior.maxConnectLabelCount;
      const parsed = Number.isFinite(raw) ? raw : fallback;
      return Math.max(min, Math.min(max, parsed));
    }

    let previewRequestInFlight = false;

    primaryPrint.addEventListener('click', async () => {
      if (typeof onPrimaryPrint !== 'function') {
        overlay.remove();
        return;
      }
      if (previewRequestInFlight) {
        return;
      }
      previewRequestInFlight = true;
      setPreviewBusy(true);
      try {
        await onPrimaryPrint(getSelectedLabelCount());
      } finally {
        setPreviewBusy(false);
        previewRequestInFlight = false;
      }
    });

    secondaryPrint.addEventListener('click', async () => {
      if (typeof onSecondaryPrint !== 'function') {
        overlay.remove();
        return;
      }
      if (previewRequestInFlight) {
        return;
      }
      previewRequestInFlight = true;
      setPreviewBusy(true);
      try {
        await onSecondaryPrint(getSelectedLabelCount());
      } finally {
        setPreviewBusy(false);
        previewRequestInFlight = false;
      }
    });

    close.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });

    panel.appendChild(title);
    panel.appendChild(labelContainer);
    panel.appendChild(hint);
    panel.appendChild(countRow);
    buttonRow.appendChild(primaryPrint);
    buttonRow.appendChild(secondaryPrint);
    panel.appendChild(buttonRow);
    panel.appendChild(close);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  function showPatchPanelPreview(serialNumber) {
    const existing = document.getElementById('i7100-patch-panel-preview');
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = 'i7100-patch-panel-preview';

    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      backgroundColor: '#fff',
      padding: '16px',
      borderRadius: '10px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
      minWidth: '260px',
      fontFamily: 'Arial, sans-serif'
    });

    const title = document.createElement('div');
    title.textContent = 'Patch-Panel Label Vorschau';
    Object.assign(title.style, {
      fontSize: '14px',
      fontWeight: '600',
      marginBottom: '10px'
    });

    const label = document.createElement('div');
    const widthPx = Math.round(PATCH_PANEL_LABEL.widthMm * PATCH_PANEL_LABEL.previewScale);
    const heightPx = Math.round(PATCH_PANEL_LABEL.heightMm * PATCH_PANEL_LABEL.previewScale);

    Object.assign(label.style, {
      width: `${widthPx}px`,
      height: `${heightPx}px`,
      border: '1px solid #111',
      backgroundColor: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      fontWeight: '600',
      letterSpacing: '0.3px',
      marginBottom: '12px',
      padding: '0 4px',
      boxSizing: 'border-box'
    });
    label.textContent = serialNumber;

    const hint = document.createElement('div');
    hint.textContent = `${PATCH_PANEL_LABEL.widthMm}x${PATCH_PANEL_LABEL.heightMm}mm`;
    Object.assign(hint.style, {
      fontSize: '12px',
      color: '#555',
      marginBottom: '12px'
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Schliessen';
    Object.assign(close.style, {
      border: 'none',
      backgroundColor: '#0f62fe',
      color: '#fff',
      padding: '8px 12px',
      borderRadius: '6px',
      cursor: 'pointer'
    });

    close.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });

    panel.appendChild(title);
    panel.appendChild(label);
    panel.appendChild(hint);
    panel.appendChild(close);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  function setConnectBusy(button, busy) {
    button.disabled = busy;
    button.style.opacity = busy ? '0.7' : '1';
    button.style.cursor = busy ? 'wait' : 'pointer';
  }

  function isConnectPage() {
    const text = getPageTitleText();
    if (!text) {
      console.log('[i7100] isConnectPage: title not found');
      return false;
    }
    const match = includesAny(text, USER_CONFIG.activation.connectKeywords);
    console.log('[i7100] isConnectPage:', text, '->', match);
    return match;
  }

  function getSerialNumber() {
    const serial = queryFirst(USER_CONFIG.selectors.serialNumberValue);
    if (!serial) {
      return '';
    }
    return serial.textContent.trim();
  }

  function getAttributeValue(labelCandidates) {
    const items = queryAll(USER_CONFIG.selectors.attributeItems);
    for (const item of items) {
      const label = queryFirst(USER_CONFIG.selectors.attributeLabel, item);
      if (!label) {
        continue;
      }
      if (!equalsAny(label.textContent, labelCandidates)) {
        continue;
      }
      const value = queryFirst(USER_CONFIG.selectors.attributeValue, item);
      if (value) {
        return value.textContent.trim();
      }
    }
    return '';
  }

  function extractTextAfterLabel(text, labelText) {
    const source = cleanText(text);
    const label = cleanText(labelText);
    if (!source || !label) {
      return '';
    }

    const lowerSource = source.toLowerCase();
    const lowerLabel = label.toLowerCase();
    const index = lowerSource.indexOf(lowerLabel);
    if (index < 0) {
      return '';
    }

    const tail = source.slice(index + label.length).replace(/^[:\-\s]+/, '').trim();
    if (!tail || normalizeText(tail) === lowerLabel) {
      return '';
    }
    return tail;
  }

  function getValueFromFieldContainer(container, labelNode) {
    const directValue = queryFirst(USER_CONFIG.selectors.labeledFieldValue, container);
    if (directValue) {
      const directText = cleanText(directValue.textContent);
      if (directText) {
        return directText;
      }
    }

    const labelText = cleanText(labelNode?.textContent || '');
    if (!labelText) {
      return '';
    }

    const siblingCandidates = [];
    let sibling = labelNode.nextElementSibling;
    while (sibling) {
      siblingCandidates.push(sibling);
      sibling = sibling.nextElementSibling;
    }

    for (const candidate of siblingCandidates) {
      const text = cleanText(candidate.textContent);
      if (text && !equalsAny(text, [labelText])) {
        return text;
      }
    }

    const containerText = cleanText(container?.textContent || '');
    return extractTextAfterLabel(containerText, labelText);
  }

  function getFieldValue(labelCandidates, root = document) {
    const attributeValue = getAttributeValue(labelCandidates);
    if (attributeValue) {
      return attributeValue;
    }

    const containers = queryAll(USER_CONFIG.selectors.labeledFieldContainers, root);
    for (const container of containers) {
      const labels = queryAll(USER_CONFIG.selectors.labeledFieldLabel, container);
      for (const labelNode of labels) {
        if (!equalsAny(labelNode.textContent, labelCandidates)) {
          continue;
        }
        const value = getValueFromFieldContainer(container, labelNode);
        if (value) {
          return value;
        }
      }
    }

    const headings = queryAll(USER_CONFIG.selectors.sectionHeading, root);
    for (const labelNode of headings) {
      if (!equalsAny(labelNode.textContent, labelCandidates)) {
        continue;
      }
      const parent = labelNode.parentElement;
      if (!parent) {
        continue;
      }
      const value = getValueFromFieldContainer(parent, labelNode);
      if (value) {
        return value;
      }
    }

    return '';
  }

  function parseFirstInteger(value) {
    const match = cleanText(value).match(/-?\d+/);
    if (!match) {
      return null;
    }
    const parsed = Number.parseInt(match[0], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function findHeadingByText(candidates, root = document) {
    const headings = queryAll(USER_CONFIG.selectors.sectionHeading, root);
    for (const heading of headings) {
      if (equalsAny(heading.textContent, candidates)) {
        return heading;
      }
    }
    return null;
  }

  function findSectionContainerByHeading(candidates, root = document) {
    const heading = findHeadingByText(candidates, root);
    if (!heading) {
      return null;
    }

    for (const selector of USER_CONFIG.selectors.sectionContainers) {
      const container = heading.closest(selector);
      if (container) {
        return container;
      }
    }

    let current = heading.parentElement;
    while (current && current !== document.body) {
      if ((current.children?.length || 0) > 1) {
        return current;
      }
      current = current.parentElement;
    }

    return heading.parentElement;
  }

  function findCustomerContactCard() {
    return findSectionContainerByHeading(USER_CONFIG.labels.customerContactCardTitles);
  }

  function findCustomerContactButton() {
    const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
    for (const button of buttons) {
      const title = button.getAttribute('title') || button.getAttribute('aria-label') || button.textContent || '';
      if (equalsAny(title, USER_CONFIG.labels.customerContactButtonTitles)) {
        return button;
      }
    }
    return null;
  }

  function getAuditHeaderText() {
    const candidates = Array.from(document.querySelectorAll('.ttFrameTitleDetailsTxt, [data-tip]'));
    for (const candidate of candidates) {
      const raw = cleanText(candidate.getAttribute?.('data-tip') || candidate.textContent || '');
      if (!raw) {
        continue;
      }
      const parts = raw.split(':').map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 4) {
        return raw;
      }
    }
    return '';
  }

  function parseAuditHeaderText(value) {
    const raw = cleanText(value);
    if (!raw) {
      return {
        raw: '',
        siteName: '',
        roomName: '',
        auditName: ''
      };
    }

    const parts = raw.split(':').map((part) => part.trim());
    return {
      raw,
      siteName: parts[0] || '',
      roomName: parts[2] || '',
      auditName: parts.slice(3).join(':').trim()
    };
  }

  function trimSystemName(value) {
    const parts = String(value || '').split(':').map((part) => part.trim()).filter(Boolean);
    return parts.slice(0, 3).join(':');
  }

  function getFullPathRow(sideCandidates) {
    const rows = queryAll(USER_CONFIG.selectors.fullPathRows);
    for (const row of rows) {
      const sideLabel = queryFirst(USER_CONFIG.selectors.fullPathSideLabel, row);
      if (!sideLabel) {
        continue;
      }
      if (equalsAny(sideLabel.textContent, sideCandidates)) {
        return row;
      }
    }
    return null;
  }

  function getSerialSuffixLetter(serial) {
    const match = String(serial || '').trim().toUpperCase().match(/-([A-Z])$/);
    return match ? match[1] : '';
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getFullPathContextRootForSerial(serial) {
    const needle = String(serial || '').trim();
    if (!needle) {
      return null;
    }

    const blocks = queryAll(USER_CONFIG.selectors.fullPathActivityBlocks);
    if (!blocks.length) {
      return null;
    }

    const strictMatch = new RegExp(`\\b${escapeRegExp(needle)}\\b`, 'i');
    for (const block of blocks) {
      const text = String(block.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) {
        continue;
      }
      if (strictMatch.test(text)) {
        return block;
      }
    }

    return null;
  }

  function getCurrentIbxCode() {
    const node = queryFirst(USER_CONFIG.selectors.currentIbxValue);
    const raw = node ? node.textContent : '';
    const match = String(raw || '').trim().toUpperCase().match(/^([A-Z]{2}\d+[A-Z]*)/);
    return match ? match[1] : '';
  }

  function getSystemIbxCode(systemName) {
    const first = String(systemName || '').split(':')[0] || '';
    const match = String(first).trim().toUpperCase().match(/^([A-Z]{2}\d+[A-Z]*)/);
    return match ? match[1] : '';
  }

  function getFullPathRowsMeta(root = document) {
    const rows = queryAll(USER_CONFIG.selectors.fullPathRows, root);
    const meta = [];
    for (const row of rows) {
      const sideLabel = queryFirst(USER_CONFIG.selectors.fullPathSideLabel, row);
      const rawSide = sideLabel ? sideLabel.textContent : '';
      const side = String(rawSide || '').trim().toUpperCase();
      const systemName = getFullPathSystemName(row);
      meta.push({
        row,
        side,
        systemName,
        systemKey: trimSystemName(systemName),
        ibxCode: getSystemIbxCode(systemName)
      });
    }
    return meta;
  }

  function isMetroFullPath(rowsMeta) {
    if (!Array.isArray(rowsMeta) || rowsMeta.length === 0) {
      return false;
    }
    if (rowsMeta.length > 2) {
      return true;
    }
    return rowsMeta.some((entry) => entry.side && entry.side !== 'A' && entry.side !== 'Z');
  }

  function pickLocalIbxSideRow(rowsMeta, localIbxCode, sideLetter) {
    const ibx = String(localIbxCode || '').trim().toUpperCase();
    const side = String(sideLetter || '').trim().toUpperCase();
    if (!ibx || !side) {
      return null;
    }
    const hit = rowsMeta.find((entry) => entry.ibxCode === ibx && entry.side === side);
    return hit ? hit.row : null;
  }

  function pickRowBySideFromMeta(rowsMeta, sideCandidates) {
    const candidates = (sideCandidates || []).map((value) => String(value || '').trim().toUpperCase());
    const hit = (rowsMeta || []).find((entry) => candidates.includes(entry.side));
    return hit ? hit.row : null;
  }

  function pickFullPathRowForSystem(rowsMeta, targetSystemName, fallbackSideCandidates, preferredSide) {
    const targetKey = trimSystemName(targetSystemName);
    const normalizedPreferredSide = String(preferredSide || '').trim().toUpperCase();

    if (targetKey) {
      const bySystem = rowsMeta.filter((entry) => entry.systemKey === targetKey);
      if (bySystem.length === 1) {
        return bySystem[0].row;
      }
      if (bySystem.length > 1 && normalizedPreferredSide) {
        const preferred = bySystem.find((entry) => entry.side === normalizedPreferredSide);
        if (preferred) {
          return preferred.row;
        }
      }
      if (bySystem.length > 0) {
        return bySystem[0].row;
      }
    }

    return pickRowBySideFromMeta(rowsMeta, fallbackSideCandidates) || getFullPathRow(fallbackSideCandidates);
  }

  function getFullPathSystemName(row) {
    if (!row) {
      return '';
    }
    const name = queryFirst(USER_CONFIG.selectors.fullPathSystemName, row);
    return name ? name.textContent.trim() : '';
  }

  function getPatchPanelCode(row) {
    if (!row) {
      return '';
    }
    const patch = queryFirst(USER_CONFIG.selectors.patchPanelCode, row);
    return patch ? patch.textContent.trim() : '';
  }

  function getPortValue(row, labelCandidates) {
    if (!row) {
      return '';
    }
    const ports = queryAll(USER_CONFIG.selectors.portsGroup, row);
    for (const portGroup of ports) {
      const labels = queryAll(USER_CONFIG.selectors.portLabel, portGroup);
      for (const label of labels) {
        if (!equalsAny(label.textContent, labelCandidates)) {
          continue;
        }
        const value = label.closest('div') ? queryFirst(USER_CONFIG.selectors.portValue, label.closest('div')) : null;
        if (value) {
          return value.textContent.trim();
        }
      }
    }
    return '';
  }

  function normalizePort(value) {
    const text = String(value || '').trim();
    if (!text || text === '-' || text === '0') {
      return '';
    }
    return text;
  }

  function formatPorts(portA, portB) {
    const a = normalizePort(portA);
    const b = normalizePort(portB);
    if (!a && !b) {
      return '';
    }
    if (!b) {
      return a;
    }
    if (!a) {
      return b;
    }
    return `${a}+${b}`;
  }

  function splitPatchPanel(value) {
    const raw = String(value || '').trim();
    if (!raw) {
      return {
        prefix: '',
        cabinet: '',
        panel: ''
      };
    }

    const compact = raw.replace(/\s*:\s*/g, ':').trim();
    const prefixMatch = compact.match(/^([A-Za-z]{2,}):(.*)$/);
    const prefix = prefixMatch ? prefixMatch[1].toUpperCase() : '';
    const payload = prefixMatch ? prefixMatch[2].trim() : compact;
    const match = payload.match(/^(.*?):([^:]+)$/);
    if (!match) {
      return {
        prefix,
        cabinet: payload,
        panel: ''
      };
    }

    return {
      prefix,
      cabinet: match[1].trim(),
      panel: match[2].trim()
    };
  }

  function ensurePanelPrefix(text, fallbackPrefix = 'PP') {
    const value = String(text || '').trim();
    if (!value) {
      return '';
    }
    const normalizedPrefix = String(fallbackPrefix || '').trim().toUpperCase() || 'PP';
    const existingPrefix = value.match(/^([A-Za-z]{2,}):(.*)$/);
    if (existingPrefix) {
      return `${existingPrefix[1].toUpperCase()}:${existingPrefix[2].trim()}`;
    }
    return `${normalizedPrefix}:${value}`;
  }

  function buildConnectLabelData() {
    const serial = getSerialNumber();
    if (!serial) {
      showMessage('Keine Serial No. gefunden');
      return null;
    }

    const contextRoot = getFullPathContextRootForSerial(serial) || document;
    const rowsMeta = getFullPathRowsMeta(contextRoot);
    const fallbackRowA = pickRowBySideFromMeta(rowsMeta, USER_CONFIG.labels.sideAValues);
    const fallbackRowZ = pickRowBySideFromMeta(rowsMeta, USER_CONFIG.labels.sideZValues);

    const finalARaw =
      getAttributeValue(USER_CONFIG.labels.finalASystemNameLabels) ||
      getFullPathSystemName(fallbackRowA || getFullPathRow(USER_CONFIG.labels.sideAValues));
    const finalZRaw =
      getAttributeValue(USER_CONFIG.labels.finalZSystemNameLabels) ||
      getFullPathSystemName(fallbackRowZ || getFullPathRow(USER_CONFIG.labels.sideZValues));

    const finalA = trimSystemName(finalARaw);
    const finalZ = trimSystemName(finalZRaw);
    const serialSuffixSide = getSerialSuffixLetter(serial);
    const localIbxCode = getCurrentIbxCode();
    const metroMode = isMetroFullPath(rowsMeta);

    let rowA = pickFullPathRowForSystem(
      rowsMeta,
      finalA,
      USER_CONFIG.labels.sideAValues,
      serialSuffixSide
    );
    let rowZ = pickFullPathRowForSystem(
      rowsMeta,
      finalZ,
      USER_CONFIG.labels.sideZValues,
      serialSuffixSide
    );

    if (metroMode && localIbxCode) {
      const localRowA = pickLocalIbxSideRow(rowsMeta, localIbxCode, 'A');
      const localRowZ = pickLocalIbxSideRow(rowsMeta, localIbxCode, 'Z');
      if (localRowA && localRowZ) {
        rowA = localRowA;
        rowZ = localRowZ;
      }
    }

    const patchA = splitPatchPanel(getPatchPanelCode(rowA));
    const patchZ = splitPatchPanel(getPatchPanelCode(rowZ));

    const portA = getPortValue(rowA, USER_CONFIG.labels.portAValues);
    const portB = getPortValue(rowA, USER_CONFIG.labels.portBValues);
    const portZ = getPortValue(rowZ, USER_CONFIG.labels.portAValues);
    const portZb = getPortValue(rowZ, USER_CONFIG.labels.portBValues);

    if (!finalA || !finalZ || !patchA.cabinet || !patchA.panel || !patchZ.cabinet || !patchZ.panel) {
      showMessage('Klicke zuerst auf Details sonst wird das nichts ;) Keine Daten keine Vorschau.');
      return null;
    }

    const finalAResolved = trimSystemName(getFullPathSystemName(rowA) || finalARaw);
    const finalZResolved = trimSystemName(getFullPathSystemName(rowZ) || finalZRaw);

    const portsA = formatPorts(portA, portB);
    const portsZ = formatPorts(portZ, portZb);
    const line2 = portsA
      ? `${finalAResolved}:${patchA.cabinet}:${patchA.panel}:${portsA}`
      : `${finalAResolved}:${patchA.cabinet}:${patchA.panel}`;
    const line3 = portsZ
      ? `${finalZResolved}:${patchZ.cabinet}:${patchZ.panel}:${portsZ}`
      : `${finalZResolved}:${patchZ.cabinet}:${patchZ.panel}`;
    const line2a = finalAResolved;
    const line2b = ensurePanelPrefix(
      portsA ? `${patchA.cabinet}:${patchA.panel}:${portsA}` : `${patchA.cabinet}:${patchA.panel}`,
      patchA.prefix
    );
    const line3a = finalZResolved;
    const line3b = ensurePanelPrefix(
      portsZ ? `${patchZ.cabinet}:${patchZ.panel}:${portsZ}` : `${patchZ.cabinet}:${patchZ.panel}`,
      patchZ.prefix
    );
    const qrPayload = String(serial).split(';')[0].trim() || serial;

    return {
      line1: serial,
      line2,
      line3,
      line2a,
      line2b,
      line3a,
      line3b,
      qrPayload
    };
  }

  function createConnectButton() {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'btn mx-button undefined btn-default';
    button.title = 'i7100 Label drucken';
    button.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M6 7V3h12v4" fill="none" stroke="#0f62fe" stroke-width="2"/>' +
      '<rect x="4" y="9" width="16" height="6" fill="none" stroke="#0f62fe" stroke-width="2"/>' +
      '<rect x="7" y="15" width="10" height="6" fill="none" stroke="#0f62fe" stroke-width="2"/>' +
      '</svg>';
    Object.assign(button.style, {
      marginLeft: '6px',
      border: '1px solid #0f62fe',
      borderRadius: '4px',
      padding: '4px 6px',
      backgroundColor: '#f0f8ff',
      cursor: 'pointer'
    });
    return button;
  }

  function printConnectLabel(button) {
    const data = buildConnectLabelData();
    if (!data) {
      return;
    }

    function sendConnectToPrinter(primaryIp, fallbackIp, copies) {
      return new Promise((resolve) => {
        const payload = {
          labelType: 'i7100',
          simulate: CONFIG.simulate,
          primaryPrinterIp: primaryIp,
          fallbackPrinterIp: fallbackIp,
          printerPort: CONFIG.printerPort,
          copies: Math.max(1, Number.parseInt(String(copies || 1), 10) || 1),
          data
        };

        GM_xmlhttpRequest({
          method: 'POST',
          url: CONFIG.apiUrl,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify(payload),
          timeout: 12000,
          onload(response) {
            let body = null;
            try {
              body = JSON.parse(response.responseText || '{}');
            } catch {
              body = null;
            }

            if (response.status >= 200 && response.status < 300 && body?.success) {
              const target = body.data?.target || primaryIp;
              const mode = body.data?.mode || (CONFIG.simulate ? 'simulate' : 'print');
              const printedCopies = Number.parseInt(String(body.data?.data?.copies || payload.copies), 10) || payload.copies;
              resolve({ ok: true, target, mode, printedCopies });
              return;
            }

            const err = body?.error?.message || `HTTP ${response.status}`;
            resolve({ ok: false, error: err });
          },
          onerror() {
            resolve({ ok: false, error: 'Netzwerkfehler beim API-Call' });
          },
          ontimeout() {
            resolve({ ok: false, error: 'Timeout beim API-Call' });
          }
        });
      });
    }

    async function sendConnectBatch(primaryIp, fallbackIp, labelCount) {
      if (connectBatchInFlight) {
        return;
      }

      const count = Math.max(1, Number.parseInt(String(labelCount || 1), 10) || 1);

      connectBatchInFlight = true;
      setConnectBusy(button, true);
      let result = null;
      try {
        result = await sendConnectToPrinter(primaryIp, fallbackIp, count);
      } finally {
        connectBatchInFlight = false;
        setConnectBusy(button, false);
      }

      if (!result?.ok) {
        const err = result?.error || 'Unbekannter Fehler';
        showMessage(`Fehler beim Druckauftrag (${count} Labels): ${err}`);
        return;
      }

      const mode = result.mode || (CONFIG.simulate ? 'simulate' : 'print');
      const target = result.target || primaryIp;
      const printedCopies = result.printedCopies || count;
      showMessage(`OK (${mode}): ${printedCopies} Labels auf ${target}`);
    }

    showConnectLabelPreview(
      data,
      (labelCount) => sendConnectBatch(CONFIG.primaryPrinterIp, CONFIG.fallbackPrinterIp, labelCount),
      (labelCount) => sendConnectBatch(CONFIG.fallbackPrinterIp, CONFIG.fallbackPrinterIp, labelCount)
    );
  }

  function isPatchPanelPage() {
    const text = getPageTitleText();
    if (!text) {
      console.log('[i7100] isPatchPanelPage: title not found');
      return false;
    }
    const match = includesAny(text, USER_CONFIG.activation.patchPanelKeywords);
    console.log('[i7100] isPatchPanelPage:', text, '->', match);
    return match;
  }

  function isPhysicalAuditPage() {
    const text = getPageTitleText();
    if (!text) {
      console.log('[i7100] isPhysicalAuditPage: title not found');
      return false;
    }
    const match = includesAny(text, USER_CONFIG.activation.physicalAuditKeywords);
    console.log('[i7100] isPhysicalAuditPage:', text, '->', match);
    return match;
  }

  function getPatchPanelSerialNumber() {
    const serial = queryFirst(USER_CONFIG.selectors.serialNumberValue);
    if (!serial) {
      return '';
    }
    return serial.textContent.trim();
  }

  function createPatchPanelButton() {
    const button = document.createElement('button');
    button.id = PATCH_PANEL_BUTTON_ID;
    button.type = 'button';
    button.className = 'btn mx-button undefined btn-default';
    button.title = 'Patch-Panel-Label drucken';
    button.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M6 7V3h12v4" fill="none" stroke="#0f62fe" stroke-width="2"/>' +
      '<rect x="4" y="9" width="16" height="6" fill="none" stroke="#0f62fe" stroke-width="2"/>' +
      '<rect x="7" y="15" width="10" height="6" fill="none" stroke="#0f62fe" stroke-width="2"/>' +
      '</svg>';
    Object.assign(button.style, {
      marginLeft: '6px',
      border: '1px solid #0f62fe',
      borderRadius: '4px',
      padding: '4px 6px',
      backgroundColor: '#f0f8ff',
      cursor: 'pointer'
    });
    return button;
  }

  function createAuditButton() {
    const button = document.createElement('button');
    button.id = AUDIT_BUTTON_ID;
    button.type = 'button';
    button.className = 'btn mx-button undefined btn-default';
    button.title = 'Create Audit in AetherCad';
    button.textContent = 'Create Audit in AetherCad';
    Object.assign(button.style, {
      border: '1px solid #0f62fe',
      borderRadius: '4px',
      padding: '10px 12px',
      backgroundColor: '#0f62fe',
      color: '#fff',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      fontWeight: '600',
      minHeight: '42px'
    });
    return button;
  }

  function setPatchPanelBusy(button, busy) {
    button.disabled = busy;
    button.style.opacity = busy ? '0.7' : '1';
    button.style.cursor = busy ? 'wait' : 'pointer';
  }

  function setAuditBusy(button, busy) {
    button.disabled = busy;
    button.style.opacity = busy ? '0.7' : '1';
    button.style.cursor = busy ? 'wait' : 'pointer';
  }

  function buildAuditPayload() {
    const headerData = parseAuditHeaderText(getAuditHeaderText());
    const siteName =
      cleanText(headerData.siteName) ||
      getCurrentIbxCode() ||
      getFieldValue(USER_CONFIG.labels.auditSiteLabels);
    const roomName =
      cleanText(headerData.roomName) ||
      getFieldValue(USER_CONFIG.labels.auditRoomLabels);
    const auditName =
      cleanText(headerData.auditName) ||
      getFieldValue(USER_CONFIG.labels.auditCustomerLabels, findCustomerContactCard() || document);
    const salesOrder = getFieldValue(USER_CONFIG.labels.auditSalesOrderLabels);
    const rackName = getFieldValue(USER_CONFIG.labels.auditRackLabels);
    const initialRackUnits = 47;

    const payload = {
      siteName: cleanText(siteName),
      roomName: cleanText(roomName),
      auditName: cleanText(auditName),
      salesOrder: cleanText(salesOrder)
    };

    if (cleanText(rackName)) {
      payload.initialRackName = cleanText(rackName);
    }
    payload.initialRackUnits = initialRackUnits;

    payload.notes = 'Erstellt per Tampermonkey';

    const missing = [];
    if (!payload.siteName) {
      missing.push('siteName');
    }
    if (!payload.roomName) {
      missing.push('roomName');
    }
    if (!payload.salesOrder) {
      missing.push('salesOrder');
    }
    if (!payload.auditName) {
      missing.push('auditName');
    }

    return {
      payload,
      missing
    };
  }

  function createAudit(button) {
    const audit = buildAuditPayload();
    if (audit.missing.length > 0) {
      showMessage(
        `Audit-Daten unvollstaendig: ${audit.missing.join(', ')}. Wenn du magst, schick mir einen Jarvis-Element-Block der Seite, dann mappen wir die Felder gezielt.`
      );
      return;
    }

    if (auditRequestInFlight) {
      return;
    }

    auditRequestInFlight = true;
    setAuditBusy(button, true);

    GM_xmlhttpRequest({
      method: 'POST',
      url: CONFIG.auditApiUrl,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(audit.payload),
      timeout: 15000,
      onload(response) {
        auditRequestInFlight = false;
        setAuditBusy(button, false);

        const body = safeParseJson(response.responseText);
        if (response.status >= 200 && response.status < 300) {
          if (body?.openUrl) {
            window.open(body.openUrl, '_blank');
            return;
          }
          showMessage(`Audit erstellt${body?.auditId ? `: ${body.auditId}` : ''}`);
          return;
        }

        const err = body?.error || body?.message || `HTTP ${response.status}`;
        showMessage(`Audit konnte nicht erstellt werden: ${err}`);
      },
      onerror() {
        auditRequestInFlight = false;
        setAuditBusy(button, false);
        showMessage('Netzwerkfehler beim Audit-Request');
      },
      ontimeout() {
        auditRequestInFlight = false;
        setAuditBusy(button, false);
        showMessage('Timeout beim Audit-Request');
      }
    });
  }

  function printPatchPanelLabel(button) {
    const serialNumber = getPatchPanelSerialNumber();
    if (!serialNumber) {
      showMessage('Keine Patch-Panel-Nummer gefunden');
      return;
    }

    // In simulate mode, show preview directly without API call
    if (CONFIG.simulate) {
      showPatchPanelPreview(serialNumber);
      return;
    }

    const payload = {
      labelType: 'patch-panel',
      simulate: CONFIG.simulate,
      primaryPrinterIp: CONFIG.patchPanelPrinterIp,
      fallbackPrinterIp: CONFIG.patchPanelPrinterIp,
      printerPort: CONFIG.printerPort,
      data: { line1: serialNumber }
    };

    setPatchPanelBusy(button, true);

    GM_xmlhttpRequest({
      method: 'POST',
      url: CONFIG.apiUrl,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(payload),
      timeout: 12000,
      onload(response) {
        setPatchPanelBusy(button, false);

        let body = null;
        try {
          body = JSON.parse(response.responseText || '{}');
        } catch {
          body = null;
        }

        if (response.status >= 200 && response.status < 300 && body?.success) {
          const target = body.data?.target || CONFIG.patchPanelPrinterIp;
          showMessage(`OK: print auf ${target}`);
          return;
        }

        const err = body?.error?.message || `HTTP ${response.status}`;
        showMessage(`Fehler: ${err}`);
      },
      onerror() {
        setPatchPanelBusy(button, false);
        showMessage('Netzwerkfehler beim API-Call');
      },
      ontimeout() {
        setPatchPanelBusy(button, false);
        showMessage('Timeout beim API-Call');
      }
    });
  }

  function ensureAuditButtonPlacement(button, card) {
    if (!button || !card || !card.parentElement) {
      return false;
    }

    let row = document.getElementById(AUDIT_BUTTON_ROW_ID);
    let slot = document.getElementById(AUDIT_BUTTON_SLOT_ID);

    if (!row || !slot || !row.contains(card)) {
      row = document.createElement('div');
      row.id = AUDIT_BUTTON_ROW_ID;
      Object.assign(row.style, {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        width: '100%'
      });

      slot = document.createElement('div');
      slot.id = AUDIT_BUTTON_SLOT_ID;
      Object.assign(slot.style, {
        display: 'flex',
        alignItems: 'flex-start',
        flex: '0 0 auto',
        paddingTop: '4px'
      });

      card.parentElement.insertBefore(row, card);
      row.appendChild(slot);
      row.appendChild(card);
    }

    if (button.parentElement !== slot) {
      slot.replaceChildren(button);
    }

    return true;
  }

  function ensureAuditButtonNextToContactButton(button, contactButton) {
    if (!button || !contactButton || !contactButton.parentElement) {
      return false;
    }

    const parent = contactButton.parentElement;
    if (button.parentElement !== parent) {
      parent.insertBefore(button, contactButton);
    } else if (button.nextSibling !== contactButton) {
      parent.insertBefore(button, contactButton);
    }

    Object.assign(button.style, {
      marginRight: '6px'
    });
    return true;
  }

  function removeAuditButton() {
    const button = document.getElementById(AUDIT_BUTTON_ID);
    if (button) {
      button.remove();
    }

    const row = document.getElementById(AUDIT_BUTTON_ROW_ID);
    const slot = document.getElementById(AUDIT_BUTTON_SLOT_ID);
    if (!row || !slot || !row.parentElement) {
      return;
    }

    const card = Array.from(row.children).find((child) => child !== slot);
    if (card) {
      row.parentElement.insertBefore(card, row);
    }
    row.remove();
  }

  function ensurePatchPanelButton() {
    const existing = document.getElementById(PATCH_PANEL_BUTTON_ID);
    if (!isPatchPanelPage()) {
      if (existing) {
        console.log('[i7100] Removing patch panel button');
        existing.remove();
      }
      return;
    }

    if (existing) {
      console.log('[i7100] Patch panel button already exists');
      return;
    }

    // Find Serial Number copy button as anchor point
    const copyButton = findSerialCopyButton();
    if (!copyButton || !copyButton.parentElement) {
      console.log('[i7100] Copy button not found for patch panel');
      return;
    }

    console.log('[i7100] Adding patch panel button');
    const button = createPatchPanelButton();
    button.addEventListener('click', () => printPatchPanelLabel(button));
    copyButton.parentElement.insertBefore(button, copyButton.nextSibling);
  }

  function ensureAuditButton() {
    const existing = document.getElementById(AUDIT_BUTTON_ID);
    if (!isPhysicalAuditPage()) {
      if (existing || document.getElementById(AUDIT_BUTTON_ROW_ID)) {
        console.log('[i7100] Removing audit button');
        removeAuditButton();
      }
      return;
    }

    const contactButton = findCustomerContactButton();
    const card = findCustomerContactCard();

    if (existing) {
      if (contactButton && ensureAuditButtonNextToContactButton(existing, contactButton)) {
        return;
      }
      if (card) {
        ensureAuditButtonPlacement(existing, card);
        return;
      }
      console.log('[i7100] Customer contact information anchor not found for audit button');
      return;
    }

    console.log('[i7100] Adding audit button');
    const button = createAuditButton();
    button.addEventListener('click', () => createAudit(button));
    if (contactButton && ensureAuditButtonNextToContactButton(button, contactButton)) {
      return;
    }
    if (card) {
      ensureAuditButtonPlacement(button, card);
      return;
    }
    console.log('[i7100] Customer contact information anchor not found for audit button');
  }

  function findSerialCopyButton() {
    const fields = queryAll(USER_CONFIG.selectors.serialFieldContainer);
    for (const field of fields) {
      const label = queryFirst(USER_CONFIG.selectors.serialFieldLabel, field);
      if (!label) {
        continue;
      }
      if (!equalsAny(label.textContent, USER_CONFIG.labels.serialFieldLabels)) {
        continue;
      }
      return queryFirst(USER_CONFIG.selectors.serialCopyButton, field);
    }
    return null;
  }

  function ensureConnectButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (!isConnectPage()) {
      if (existing) {
        console.log('[i7100] Removing connect button');
        existing.remove();
      }
      return;
    }

    if (existing) {
      console.log('[i7100] Connect button already exists');
      return;
    }

    const copyButton = findSerialCopyButton();
    if (!copyButton || !copyButton.parentElement) {
      console.log('[i7100] Copy button not found for connect page');
      return;
    }

    console.log('[i7100] Adding connect button');
    const button = createConnectButton();
    button.addEventListener('click', () => printConnectLabel(button));
    copyButton.parentElement.insertBefore(button, copyButton.nextSibling);
  }

  function checkButtons() {
    ensureConnectButton();
    ensurePatchPanelButton();
    ensureAuditButton();
  }

  function start() {
    if (!isHostAllowed()) {
      console.log('[i7100] Host not allowed:', window.location.hostname);
      return;
    }

    if (!document.body) {
      console.log('[i7100] Waiting for body...');
      return;
    }

    console.log('[i7100] Script started on', window.location.href);
    checkButtons();

    const observer = new MutationObserver(() => {
      checkButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(checkButtons, USER_CONFIG.behavior.checkIntervalMs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
