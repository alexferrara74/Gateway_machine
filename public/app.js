const STORAGE_KEY = 'sana-breakfast-rental-demo-v1';
const CATEGORY_LABELS = {
  caffe: 'Caffè in grani',
  solubili: 'Solubili',
  cioccolata: 'Cioccolata'
};

const initialRentals = [
  {
    id: 'r-1001',
    customerId: 'c-01',
    customer: 'Hotel Aurora',
    initials: 'HA',
    avatarColor: '#edf3ec',
    customerCode: 'CL-00482',
    email: 'acquisti@hotelaurora.it',
    equipment: 'Macchina caffè automatica',
    model: 'WMF 1500 S+',
    serial: 'SN · 1500-8821',
    rentalStart: '12 mar 2025',
    lastPurchase: '18 ott 2026',
    lastProduct: 'Caffè in grani',
    consumptions: { caffe: 18, solubili: 6, cioccolata: 2 },
    ordinaryCount: 2,
    thresholds: { caffe: 20, solubili: 12, cioccolata: 5 },
    ordinaryLimit: 4,
    lastOrdinary: '04 ago 2026',
    lastMaintenance: '04 ago 2026'
  },
  {
    id: 'r-1002',
    customerId: 'c-02',
    customer: 'Bistrot dei Tigli',
    initials: 'BT',
    avatarColor: '#f4eee6',
    customerCode: 'CL-00176',
    email: 'info@bistrottigli.it',
    equipment: 'Distributore bevande calde',
    model: 'Necta Krea Touch',
    serial: 'SN · KRE-7049',
    rentalStart: '06 giu 2024',
    lastPurchase: '22 ott 2026',
    lastProduct: 'Caffè in grani',
    consumptions: { caffe: 24, solubili: 8, cioccolata: 3 },
    ordinaryCount: 4,
    thresholds: { caffe: 25, solubili: 15, cioccolata: 6 },
    ordinaryLimit: 4,
    lastOrdinary: '28 lug 2026',
    lastMaintenance: '28 lug 2026'
  },
  {
    id: 'r-1003',
    customerId: 'c-03',
    customer: 'Studio Medico San Luca',
    initials: 'SL',
    avatarColor: '#eaf0f5',
    customerCode: 'CL-00913',
    email: 'segreteria@studiosanluca.it',
    equipment: 'Macchina bevande solubili',
    model: 'Necta Brio Up',
    serial: 'SN · BRU-2215',
    rentalStart: '19 gen 2026',
    lastPurchase: '14 ott 2026',
    lastProduct: 'Solubili',
    consumptions: { caffe: 4, solubili: 9, cioccolata: 4 },
    ordinaryCount: 1,
    thresholds: { caffe: 12, solubili: 12, cioccolata: 8 },
    ordinaryLimit: 3,
    lastOrdinary: '12 mag 2026',
    lastMaintenance: '12 mag 2026'
  }
];

function loadRentals() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : structuredClone(initialRentals);
  } catch (error) {
    console.error('Impossibile caricare i dati dimostrativi salvati:', error);
    return structuredClone(initialRentals);
  }
}

let rentals = loadRentals();
let selectedId = rentals[0]?.id ?? null;
let showDueOnly = false;
let searchTerm = '';
let toastTimer;

const rowsElement = document.getElementById('rental-rows');
const detailElement = document.getElementById('detail-panel');
const settingsDialog = document.getElementById('settings-dialog');
const settingsForm = document.getElementById('settings-form');
const customerSelect = document.getElementById('customer-select');
const thresholdFields = document.getElementById('threshold-fields');

function saveRentals() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rentals));
}

function statusFor(rental) {
  if (rental.ordinaryCount >= rental.ordinaryLimit) {
    return { kind: 'extra', label: 'Straordinaria da pianificare' };
  }
  if (Object.entries(rental.consumptions).some(([key, quantity]) => quantity >= rental.thresholds[key])) {
    return { kind: 'due', label: 'Ordinaria da pianificare' };
  }
  return { kind: 'ok', label: 'Manutenzione in regola' };
}

function getVisibleRentals() {
  return rentals.filter((rental) => {
    const matchesSearch = `${rental.customer} ${rental.equipment} ${rental.model}`
      .toLocaleLowerCase('it')
      .includes(searchTerm);
    return matchesSearch && (!showDueOnly || statusFor(rental).kind !== 'ok');
  });
}

function renderRows() {
  const visibleRentals = getVisibleRentals();
  if (!visibleRentals.some((rental) => rental.id === selectedId)) {
    selectedId = visibleRentals[0]?.id ?? null;
  }

  if (visibleRentals.length === 0) {
    rowsElement.innerHTML = '<div class="row-empty">Nessun noleggio corrisponde alla ricerca.</div>';
  } else {
    rowsElement.innerHTML = visibleRentals.map((rental) => {
      const status = statusFor(rental);
      const selected = rental.id === selectedId ? ' selected' : '';
      return `
        <button type="button" class="rental-row${selected}" data-rental-id="${rental.id}" aria-pressed="${rental.id === selectedId}">
          <span class="client-cell">
            <span class="mini-avatar" style="background:${rental.avatarColor};color:#55685a">${rental.initials}</span>
            <span class="client-copy"><strong>${rental.customer}</strong><small>${rental.equipment}</small></span>
          </span>
          <span class="last-purchase"><strong>${rental.lastPurchase}</strong><small>${rental.lastProduct}</small></span>
          <span class="status-pill status-${status.kind}">${status.label}</span>
        </button>`;
    }).join('');
  }

  rowsElement.querySelectorAll('[data-rental-id]').forEach((row) => {
    row.addEventListener('click', () => {
      selectedId = row.dataset.rentalId;
      render();
    });
  });
  document.getElementById('results-count').textContent = `${visibleRentals.length} ${visibleRentals.length === 1 ? 'noleggio' : 'noleggi'} recenti`;
  renderDetails();
  updateSummary();
}

function renderDetails() {
  const rental = rentals.find((item) => item.id === selectedId);
  if (!rental) {
    detailElement.innerHTML = '<div class="no-detail"><div><span>⌕</span>Seleziona un noleggio per vedere i dettagli.</div></div>';
    return;
  }

  const status = statusFor(rental);
  const details = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
    const quantity = rental.consumptions[key] ?? 0;
    const threshold = rental.thresholds[key] ?? 0;
    const percentage = threshold > 0 ? Math.min(100, Math.round(quantity / threshold * 100)) : 0;
    return `
      <div class="consumption-item">
        <div class="consumption-label"><span>${label}</span><strong>${quantity} / ${threshold} kg</strong></div>
        <div class="progress-track"><div class="progress-fill${percentage >= 80 ? ' warning' : ''}" style="width:${percentage}%"></div></div>
      </div>`;
  }).join('');

  let notice;
  if (status.kind === 'extra') {
    notice = `<div class="maintenance-notice extra-notice"><span class="notice-icon">!</span><div><strong>Manutenzione straordinaria da pianificare</strong><p>Completate ${rental.ordinaryCount} di ${rental.ordinaryLimit} manutenzioni ordinarie previste.</p></div></div>`;
  } else if (status.kind === 'due') {
    notice = '<div class="maintenance-notice"><span class="notice-icon">!</span><div><strong>Manutenzione ordinaria da pianificare</strong><p>Una o più soglie di consumo sono state raggiunte dall’ultimo intervento.</p></div></div>';
  } else {
    notice = `<div class="maintenance-notice" style="border-color:#e3eee5;background:#f8fbf8"><span class="notice-icon" style="background:#e5f0e7;color:#54805c">✓</span><div><strong style="color:#507258">Manutenzione in regola</strong><p>Ordinarie completate: ${rental.ordinaryCount} di ${rental.ordinaryLimit} prima della straordinaria.</p></div></div>`;
  }

  const action = status.kind === 'extra'
    ? '<button class="button button-primary" data-maintenance="extra">Registra straordinaria</button>'
    : status.kind === 'due'
      ? '<button class="button button-primary" data-maintenance="ordinary">Registra ordinaria</button>'
      : '';

  detailElement.innerHTML = `
    <div class="detail-topline">
      <div class="detail-client">
        <span class="mini-avatar" style="width:31px;height:31px;background:${rental.avatarColor};color:#55685a">${rental.initials}</span>
        <span><strong>${rental.customer}</strong><small>${rental.customerCode} · ${rental.email}</small></span>
      </div>
      <button class="more-button" type="button" aria-label="Altre opzioni">···</button>
    </div>
    <div class="detail-divider"></div>
    <div class="detail-section-title"><span>Attrezzatura noleggiata</span><button class="inline-link" data-edit-customer>Modifica soglie</button></div>
    <div class="equipment-card"><span class="machine-icon">▣</span><span><strong>${rental.equipment}</strong><small>${rental.model} · ${rental.serial}</small></span></div>
    <div class="detail-meta"><span>INIZIO NOLEGGIO<strong>${rental.rentalStart}</strong></span><span>ULTIMA MANUTENZIONE<strong>${rental.lastMaintenance}</strong></span></div>
    <div class="detail-divider"></div>
    <div class="detail-section-title"><span>Consumi dall’ultima ordinaria</span><button class="inline-link" data-edit-customer>Configura</button></div>
    <div class="consumption-heading"><span>Prodotti acquistati per categoria</span><strong>Quantità / soglia</strong></div>
    ${details}
    ${notice}
    <div class="maintenance-actions">${action}<button class="button button-secondary" data-edit-customer>Configura cliente</button></div>`;

  detailElement.querySelectorAll('[data-edit-customer]').forEach((button) => {
    button.addEventListener('click', () => openSettings(rental.customerId));
  });
  detailElement.querySelector('[data-maintenance]')?.addEventListener('click', (event) => {
    completeMaintenance(event.currentTarget.dataset.maintenance, rental.id);
  });
}

function updateSummary() {
  const dueCount = rentals.filter((rental) => statusFor(rental).kind !== 'ok').length;
  const extraCount = rentals.filter((rental) => statusFor(rental).kind === 'extra').length;
  document.getElementById('stat-due-count').textContent = dueCount;
  document.getElementById('tab-due-count').textContent = dueCount;
  document.getElementById('sidebar-due-count').textContent = dueCount;
  document.getElementById('stat-extra-count').textContent = extraCount;
}

function render() {
  renderRows();
}

function openSettings(customerId = rentals.find((rental) => rental.id === selectedId)?.customerId) {
  customerSelect.innerHTML = rentals.map((rental) =>
    `<option value="${rental.customerId}">${rental.customer}</option>`
  ).filter((option, index, options) => options.indexOf(option) === index).join('');
  customerSelect.value = customerId ?? rentals[0]?.customerId ?? '';
  renderThresholdInputs();
  settingsDialog.showModal();
}

function renderThresholdInputs() {
  const rental = rentals.find((item) => item.customerId === customerSelect.value);
  if (!rental) {
    thresholdFields.innerHTML = '';
    return;
  }
  thresholdFields.innerHTML = Object.entries(CATEGORY_LABELS).map(([key, label]) => `
    <label class="threshold-row">
      <span><strong>${label}</strong><small>Somma degli acquisti del cliente</small></span>
      <span class="threshold-input-wrap"><input class="form-control" type="number" min="1" max="9999" name="${key}" value="${rental.thresholds[key]}" required aria-label="Soglia ${label}"><span>kg</span></span>
    </label>`).join('');
  document.getElementById('ordinary-limit').value = rental.ordinaryLimit;
}

function completeMaintenance(type, rentalId) {
  const rental = rentals.find((item) => item.id === rentalId);
  if (!rental) return;

  const today = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());
  if (type === 'ordinary') {
    rental.ordinaryCount += 1;
    rental.consumptions = Object.fromEntries(Object.keys(CATEGORY_LABELS).map((key) => [key, 0]));
    rental.lastOrdinary = today;
    rental.lastMaintenance = today;
    showToast(`Manutenzione ordinaria registrata per ${rental.customer}.`);
  } else {
    rental.ordinaryCount = 0;
    rental.consumptions = Object.fromEntries(Object.keys(CATEGORY_LABELS).map((key) => [key, 0]));
    rental.lastMaintenance = today;
    showToast(`Manutenzione straordinaria registrata per ${rental.customer}.`);
  }
  saveRentals();
  render();
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 3000);
}

document.getElementById('open-customer-settings').addEventListener('click', () => openSettings());
document.getElementById('close-settings').addEventListener('click', () => settingsDialog.close());
document.getElementById('cancel-settings').addEventListener('click', () => settingsDialog.close());
customerSelect.addEventListener('change', renderThresholdInputs);
document.getElementById('search-input').addEventListener('input', (event) => {
  searchTerm = event.target.value.trim().toLocaleLowerCase('it');
  render();
});
document.getElementById('tab-history').addEventListener('click', () => {
  showDueOnly = false;
  document.getElementById('tab-history').classList.add('active');
  document.getElementById('tab-history').setAttribute('aria-selected', 'true');
  document.getElementById('tab-maintenance').classList.remove('active');
  document.getElementById('tab-maintenance').setAttribute('aria-selected', 'false');
  render();
});
document.getElementById('tab-maintenance').addEventListener('click', () => {
  showDueOnly = true;
  document.getElementById('tab-maintenance').classList.add('active');
  document.getElementById('tab-maintenance').setAttribute('aria-selected', 'true');
  document.getElementById('tab-history').classList.remove('active');
  document.getElementById('tab-history').setAttribute('aria-selected', 'false');
  render();
});
settingsForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const rental = rentals.find((item) => item.customerId === customerSelect.value);
  if (!rental) return;

  const formData = new FormData(settingsForm);
  const thresholds = Object.fromEntries(Object.keys(CATEGORY_LABELS).map((key) => [key, Number(formData.get(key))]));
  const ordinaryLimit = Number(document.getElementById('ordinary-limit').value);
  if (Object.values(thresholds).some((value) => !Number.isInteger(value) || value < 1) ||
      !Number.isInteger(ordinaryLimit) || ordinaryLimit < 1) {
    showToast('Inserisci soglie valide, maggiori di zero.');
    return;
  }

  rental.thresholds = thresholds;
  rental.ordinaryLimit = ordinaryLimit;
  saveRentals();
  settingsDialog.close();
  selectedId = rental.id;
  render();
  showToast(`Soglie aggiornate per ${rental.customer}.`);
});

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.getElementById('search-input').focus();
  }
});

render();
