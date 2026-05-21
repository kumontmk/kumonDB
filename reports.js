import { requireAuth, db } from './auth.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

if (!requireAuth()) {}

const centerId = sessionStorage.getItem('selectedCenter');
const studentsRef = ref(db, `centers/${centerId}/students`);

// ✅ Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.report-section').forEach(s => s.classList.add('hidden'));
    
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.remove('hidden');
  });
});

// ✅ Timetable Logic
const daySelect = document.getElementById('timetableDay');
const dayGrid = document.getElementById('timetableGrid');

async function loadTimetable() {
  const loader = document.getElementById('loadingOverlay');
  loader.classList.remove('hidden');
  
  try {
    const snapshot = await get(studentsRef);
    dayGrid.innerHTML = '';
    const selectedDay = daySelect.value;
    
    const studentsBySlot = {}; // { "4:00 PM": [Student 1, Student 2] }
    
    snapshot.forEach(child => {
      const student = child.val();
      student.subjects.forEach(sub => {
        if (sub.status === 'drop') return;
        
        // Simple parser: looks for "Mon", "Tue" etc. in timeslot string
        if (sub.timeslot && sub.timeslot.includes(selectedDay)) {
          const slot = sub.timeslot.split(' ')[1] || sub.timeslot; // Extracts time part roughly
          if (!studentsBySlot[slot]) studentsBySlot[slot] = [];
          studentsBySlot[slot].push(`${student.nameEn} (${sub.name})`);
        }
      });
    });

    // Render Grid
    Object.keys(studentsBySlot).sort().forEach(slot => {
      const card = document.createElement('div');
      card.className = 'timeslot-card';
      card.innerHTML = `<h3>⏰ ${slot}</h3><ul>${studentsBySlot[slot].map(s => `<li>${s}</li>`).join('')}</ul>`;
      dayGrid.appendChild(card);
    });

    if (Object.keys(studentsBySlot).length === 0) {
      dayGrid.innerHTML = '<p class="hint">No classes found for this day.</p>';
    }
  } catch (err) { console.error(err); }
  finally { loader.classList.add('hidden'); }
}

daySelect.addEventListener('change', loadTimetable);
loadTimetable();

// ✅ Monthly Report Logic
document.getElementById('generateReport').addEventListener('click', async () => {
  const subject = document.getElementById('reportSubject').value;
  const month = document.getElementById('reportMonth').value;
  const tbody = document.getElementById('reportBody');
  const tableContainer = document.getElementById('monthlyReport');
  const loader = document.getElementById('loadingOverlay');
  
  if (!month) return alert('Please select a month');
  
  loader.classList.remove('hidden');
  tbody.innerHTML = '';

  try {
    const snapshot = await get(studentsRef);
    
    snapshot.forEach(child => {
      const s = child.val();
      s.subjects.forEach(sub => {
        if (subject !== 'all' && sub.name !== subject) return;
        
        // Find progress entry for the selected month
        const prog = sub.progress?.find(p => p.month === month);
        
        if (prog) {
          const row = document.createElement('tr');
          const t = prog.test || {};
          row.innerHTML = `
            <td>${s.studentNumber}</td>
            <td>${s.nameCn}</td>
            <td>${s.nameEn}</td>
            <td>${s.grade}</td>
            <td>${prog.prevLevel}</td>
            <td>${prog.prevWS}</td>
            <td>${prog.currLevel}</td>
            <td>${prog.currWS}</td>
            <td>${t.level || '-'}</td>
            <td>${t.score || '-'}</td>
            <td>${t.time || '-'}</td>
            <td>${t.group || '-'}</td>
          `;
          tbody.appendChild(row);
        }
      });
    });

    if (tbody.innerHTML === '') {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align:center">No data for this period</td></tr>';
    }
    tableContainer.classList.remove('hidden');
  } catch (err) { console.error(err); }
  finally { loader.classList.add('hidden'); }
});

// ✅ Print Handlers
document.getElementById('printTimetable').onclick = () => window.print();
document.getElementById('printReport').onclick = () => window.print();