/* app.js
   Gestor de tesorería OBC
   - Firebase Config
   - Solo cuentas permitidas
   - Firestore compat (no modular)
*/

/////////////////////
// CONFIG: editar //
///////////////////

const firebaseConfig = {
  apiKey: "AIzaSyBSCbec9RrWUWod6Sh1MXYrBBH94gf48GY",
  authDomain: "gestortesoreria-obc.firebaseapp.com",
  projectId: "gestortesoreria-obc",
};

const allowedEmails = [
  "rodriguezjavier11g@gmail.com",
  "sehilasanchez@gmail.com"
];

// Inicializar Firebase compat
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/////////////////////
// SELECTORES
/////////////////////
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnRegister = document.getElementById('btn-register');
const btnLogout = document.getElementById('btn-logout');
const userEmailSpan = document.getElementById('user-email');

const entryForm = document.getElementById('entry-form');
const entriesBody = document.getElementById('entries-body');

const filterFrom = document.getElementById('filter-from');
const filterTo = document.getElementById('filter-to');
const filterSection = document.getElementById('filter-section');
const filterType = document.getElementById('filter-type');
const btnFilter = document.getElementById('btn-filter');
const btnExport = document.getElementById('btn-export');

const totalsEls = {
  ingresos: document.getElementById('total-ingresos'),
  gastos: document.getElementById('total-gastos'),
  donaciones: document.getElementById('total-donaciones'),
  balance: document.getElementById('total-balance'),
};

/////////////////////
// Estado local
/////////////////////
let currentUser = null;
let entriesCache = [];
let unsubscribeListener = null;

/////////////////////
// AUTH
/////////////////////
auth.onAuthStateChanged(async user => {
  currentUser = user;
  if (user) {
    const email = user.email || '';
    if (!allowedEmails.includes(email)) {
      await auth.signOut();
      alert("Cuenta no autorizada. Contacta al administrador.");
      showAuth();
      return;
    }
    userEmailSpan.textContent = email;
    showApp();
    startListeningEntries(); // carga los datos existentes
  } else {
    showAuth();
    stopListeningEntries();
  }
});

function showAuth(){
  authSection.classList.remove('hidden');
  appSection.classList.add('hidden');
  userEmailSpan.textContent = '';
}

function showApp(){
  authSection.classList.add('hidden');
  appSection.classList.remove('hidden');
}

btnLogout.addEventListener('click', async () => {
  await auth.signOut();
});

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const pass = passwordInput.value;
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (err) {
    alert("Error al iniciar sesión: " + err.message);
  }
});

/*/ Opcional: registrar (solo cuentas permitidas)
btnRegister.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const pass = passwordInput.value;
  if (!allowedEmails.includes(email)) {
    if (!confirm("La cuenta que intentas crear no está en la lista de permitidos. ¿Deseas crearla de todas formas?")) return;
  }
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    alert("Cuenta creada. Notifica al administrador si corresponde añadirla a allowedEmails.");
  } catch (err) {
    alert("Error al crear cuenta: " + err.message);
  }
});/*/

/////////////////////
// FIRESTORE CRUD + LISTENER
/////////////////////
function startListeningEntries() {
  if (unsubscribeListener) unsubscribeListener();

  const q = db.collection('transactions').orderBy('date', 'desc');
  unsubscribeListener = q.onSnapshot(snapshot => {
    const data = [];
    snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
    entriesCache = data;
    renderEntriesWithFilter();
  }, err => console.error("Error listener:", err));
}

function stopListeningEntries(){
  if (unsubscribeListener) {
    unsubscribeListener();
    unsubscribeListener = null;
  }
  entriesCache = [];
  entriesBody.innerHTML = '';
}

// Guardar nuevo registro
entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = document.getElementById('type').value;
  const section = document.getElementById('section').value;
  const activityName = document.getElementById('activityName').value.trim();
  const date = document.getElementById('date').value;
  const amount = parseFloat(document.getElementById('amount').value || 0);
  const notes = document.getElementById('notes').value || '';

  if (!date || !activityName || isNaN(amount)) {
    alert('Completa los campos obligatorios correctamente.');
    return;
  }

  const payload = {
    type,
    section,
    activityName,
    date,
    amount,
    notes,
    createdBy: currentUser ? currentUser.uid : null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('transactions').add(payload);
    entryForm.reset();
    alert('Registro guardado.');
  } catch (err) {
    console.error(err);
    alert('Error al guardar: ' + err.message);
  }
});

document.getElementById('btn-clear').addEventListener('click', () => entryForm.reset());

/////////////////////
// Render, filtros, totales
/////////////////////
btnFilter.addEventListener('click', renderEntriesWithFilter);

function renderEntriesWithFilter() {
  const from = filterFrom.value;
  const to = filterTo.value;
  const fSection = filterSection.value;
  const fType = filterType.value;

  const filtered = entriesCache.filter(e => {
    if (from && e.date < from) return false;
    if (to && e.date > to) return false;
    if (fSection && e.section !== fSection) return false;
    if (fType && e.type !== fType) return false;
    return true;
  });

  // Totales
  let ingresos = 0, gastos = 0, donaciones = 0;
  filtered.forEach(r => {
    if (r.type === 'ingreso') ingresos += Number(r.amount) || 0;
    if (r.type === 'gasto') gastos += Number(r.amount) || 0;
    if (r.type === 'donacion') donaciones += Number(r.amount) || 0;
  });
  totalsEls.ingresos.textContent = ingresos.toFixed(2);
  totalsEls.gastos.textContent = gastos.toFixed(2);
  totalsEls.donaciones.textContent = donaciones.toFixed(2);
  totalsEls.balance.textContent = (ingresos + donaciones - gastos).toFixed(2);

  // Llenar tabla
  entriesBody.innerHTML = '';
  if (filtered.length === 0) {
    entriesBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#6b7280;padding:18px">No hay registros</td></tr>`;
    return;
  }

  filtered.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${capitalize(r.type)}</td>
      <td>${humanSection(r.section)}</td>
      <td>${escapeHtml(r.activityName)}</td>
      <td style="color:${r.type==='gasto'?'var(--danger)':'var(--success)'}">${Number(r.amount).toFixed(2)}</td>
      <td>${escapeHtml(r.notes || '')}</td>
      <td class="actions">
        <button class="btn" data-id="${r.id}" data-action="export">Exportar</button>
        <button class="btn ghost" data-id="${r.id}" data-action="delete">Eliminar</button>
      </td>
    `;
    entriesBody.appendChild(tr);
  });

  // acciones botones
  entriesBody.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      if (action === 'delete') {
        if (!confirm("¿Eliminar este registro? Esta acción es irreversible.")) return;
        try {
          await db.collection('transactions').doc(id).delete();
          alert('Registro eliminado.');
        } catch (err) {
          alert('Error al eliminar: ' + err.message);
        }
      } else if (action === 'export') {
        const item = entriesCache.find(x => x.id === id);
        if (item) exportSingleToPDF(item);
      }
    });
  });
}

function capitalize(s){ return s ? (s.charAt(0).toUpperCase() + s.slice(1)) : '';}
function humanSection(key){
  const map = {
    actividades: 'Actividades',
    recaudacion_socios: 'Recaudación anual de socios',
    otros_ingresos: 'Otros ingresos',
    gastos_totales: 'Gastos'
  };
  return map[key] || key;
}
function escapeHtml(text){
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/////////////////////
// Exportar PDF
/////////////////////
btnExport.addEventListener('click', () => {
  const from = filterFrom.value;
  const to = filterTo.value;
  const fSection = filterSection.value;
  const fType = filterType.value;

  const filtered = entriesCache.filter(e => {
    if (from && e.date < from) return false;
    if (to && e.date > to) return false;
    if (fSection && e.section !== fSection) return false;
    if (fType && e.type !== fType) return false;
    return true;
  });

  if (filtered.length === 0) {
    alert("No hay registros para exportar con el filtro actual.");
    return;
  }
  exportListToPDF(filtered, {from, to, fSection, fType});
});

async function exportSingleToPDF(item) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','mm','a4');

  doc.setFontSize(18);
  doc.text("Informe de Movimiento", 14, 20);
  doc.setFontSize(12);
  doc.text(`Fecha: ${item.date}`, 14, 32);
  doc.text(`Tipo: ${capitalize(item.type)}`, 14, 40);
  doc.text(`Sección: ${humanSection(item.section)}`, 14, 48);
  doc.text(`Actividad: ${item.activityName}`, 14, 56);
  doc.text(`Monto: ${Number(item.amount).toFixed(2)}`, 14, 64);
  if (item.notes) doc.text(`Notas: ${item.notes}`, 14, 72);

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generado por ${currentUser ? currentUser.email : 'Usuario'} - ${new Date().toLocaleString()}`, 14, 285);

  doc.save(`registro-${item.id}.pdf`);
}

function exportListToPDF(list, meta = {}) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p','mm','a4');
  doc.setFontSize(16);
  doc.text("Informe de Tesorería", 14, 18);

  doc.setFontSize(10);
  const metaLines = [
    `Generado por: ${currentUser ? currentUser.email : 'Usuario'}`,
    `Fecha: ${new Date().toLocaleString()}`,
    `Filtro desde: ${meta.from || '—'} hasta: ${meta.to || '—'}`,
    `Sección: ${meta.fSection || 'Todas'}  Tipo: ${meta.fType || 'Todos'}`
  ];
  metaLines.forEach((ln, idx) => doc.text(ln, 14, 26 + idx*6));

  const rows = list.map(r => [
    r.date,
    capitalize(r.type),
    humanSection(r.section),
    r.activityName,
    Number(r.amount).toFixed(2),
    r.notes || ''
  ]);

  doc.autoTable({
    startY: 52,
    head: [['Fecha','Tipo','Sección','Actividad','Monto','Notas']],
    body: rows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [37,99,235], textColor: 255 },
    theme: 'striped',
    didDrawPage: function (data) {
      if (data.pageNumber === doc.internal.getNumberOfPages()) {
        const ingresos = list.filter(x=>x.type==='ingreso').reduce((s,a)=>s+Number(a.amount||0),0);
        const gastos = list.filter(x=>x.type==='gasto').reduce((s,a)=>s+Number(a.amount||0),0);
        const donaciones = list.filter(x=>x.type==='donacion').reduce((s,a)=>s+Number(a.amount||0),0);
        const balance = ingresos + donaciones - gastos;
        const y = doc.internal.pageSize.height - 30;
        doc.setFontSize(10);
        doc.text(`Ingresos: ${ingresos.toFixed(2)}   Gastos: ${gastos.toFixed(2)}   Donaciones: ${donaciones.toFixed(2)}   Balance: ${balance.toFixed(2)}`, 14, y);
      }
    }
  });

  doc.save(`informe_tesoreria_${new Date().toISOString().slice(0,10)}.pdf`);
}

/////////////////////
// Utilidades
/////////////////////
function isAllowedEmail(email){
  return allowedEmails.includes(email);
}
