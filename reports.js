// reports.js
import { requireAuth, db } from './auth.js';
import { ref, get, onValue, off } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

if (!requireAuth()) {}

const centerId = sessionStorage.getItem('selectedCenter');
if (!centerId) {
  console.error('❌ No centerId found in sessionStorage!');
  alert('No center selected. Redirecting...');
  window.location.href = 'centers.html';
}

const studentsRef = ref(db, `centers/${centerId}/students`);
console.log('📡 Listening to Firebase path:', studentsRef.toString());

const SUBJECT_COLORS = {
  'Math': 'subj-Math',
  'Chinese': 'subj-Chinese',
  'English ERP': 'subj-ERP',
  'English EFL': 'subj-EFL'
};

// ✅ Map to handle "Mon" vs "Monday" mismatches between HTML dropdown and DB
const DAY_MAP = {
  'Mon': 'Monday', 'Monday': 'Monday',
  'Tue': 'Tuesday', 'Tuesday': 'Tuesday',
  'Wed': 'Wednesday', 'Wednesday': 'Wednesday',
  'Thu': 'Thursday', 'Thursday': 'Thursday',
  'Fri': 'Friday', 'Friday': 'Friday',
  'Sat': 'Saturday', 'Saturday': 'Saturday',
  'Sun': 'Sunday', 'Sunday': 'Sunday'
};

// ✅ Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.report-section').forEach(s => s.classList.add('hidden'));
    btn.classList.add('active');
    const target = document.getElementById(btn.dataset.tab);
    if (target) target.classList.remove('hidden');
  });
});

// ============================================
// ✅ REAL-TIME TIMETABLE
// ============================================
const daySelect = document.getElementById('timetableDay');
const dayGrid = document.getElementById('timetableGrid');
let timetableUnsubscribe = null; 

function loadTimetable() {
  if (!daySelect || !dayGrid) {
    console.error('❌ HTML elements #timetableDay or #timetableGrid not found!');
    return;
  }

  // 🧹 Force hide ALL possible loaders so they don't block the UI
  const loader1 = document.getElementById('loadingOverlay');
  const loader2 = document.getElementById('page-loader');
  if (loader1) loader1.classList.add('hidden');
  if (loader2) loader2.classList.add('hidden');

  if (timetableUnsubscribe) {
    timetableUnsubscribe();
    timetableUnsubscribe = null;
  }

  const callback = (snapshot) => {
    dayGrid.innerHTML = '';
    const selectedDayRaw = daySelect.value;
    const targetDay = DAY_MAP[selectedDayRaw] || selectedDayRaw;
    
    // 🕵️ Debug logs to see exactly what Firebase is sending
    console.log('🔥 Firebase Data Received:', snapshot.val());
    console.log('📅 Selected Day in Dropdown:', selectedDayRaw, '-> Mapped to:', targetDay);

    if (!snapshot.exists()) {
      dayGrid.innerHTML = `<p class="hint" style="grid-column: 1/-1; text-align:center; padding: 2rem;">📭 No students found in this center yet.</p>`;
      return;
    }

    const studentsBySlot = {}; 
    let totalClasses = 0;

    snapshot.forEach(child => {
      const student = child.val();
      if (!student.subjects) return;

      const subjects = Array.isArray(student.subjects) ? student.subjects : Object.values(student.subjects);

      subjects.forEach(sub => {
        if (sub.status === 'drop') return;
        if (!sub.timeslots) return;

        const timeslots = Array.isArray(sub.timeslots) ? sub.timeslots : Object.values(sub.timeslots);

        timeslots.forEach(ts => {
          const slotDay = DAY_MAP[ts.day] || ts.day;
          
          if (slotDay === targetDay && ts.time) {
            if (!studentsBySlot[ts.time]) studentsBySlot[ts.time] = [];
            studentsBySlot[ts.time].push({
              nameCn: student.nameCn || '-',
              nickname: student.nickname || student.namePinyin || '-',
              grade: student.grade || '-',
              subject: sub.name || 'Unknown',
              level: sub.currentLevel || sub.startLevel || '-',
              color: SUBJECT_COLORS[sub.name] || ''
            });
            totalClasses++;
          }
        });
      });
    });

    const sortedSlots = Object.keys(studentsBySlot).sort((a, b) => a.localeCompare(b));

    sortedSlots.forEach(slot => {
      studentsBySlot[slot].sort((a, b) =>
        a.subject.localeCompare(b.subject) || a.nameCn.localeCompare(b.nameCn)
      );
    });

    if (sortedSlots.length === 0) {
      dayGrid.innerHTML = `
        <p class="hint" style="grid-column: 1/-1; text-align:center; padding: 2rem; font-size: 1rem;">
          📭 No classes scheduled for <strong>${targetDay}</strong>.
        </p>`;
      return;
    }

    const summary = document.createElement('div');
    summary.style.cssText = 'grid-column: 1/-1; background: #87CEEB; color: #333; padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 0.5rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;';
    summary.innerHTML = `
      <span>📅 ${targetDay}</span>
      <span style="font-size: 0.9rem;">
        ${totalClasses} class${totalClasses !== 1 ? 'es' : ''} · ${sortedSlots.length} timeslot${sortedSlots.length !== 1 ? 's' : ''}
      </span>`;
    dayGrid.appendChild(summary);

    sortedSlots.forEach(slot => {
      const students = studentsBySlot[slot];
      const card = document.createElement('div');
      card.className = 'timeslot-card';
      card.innerHTML = `
        <h3 style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; font-size: 1.1rem; color: #333;">
          <span>⏰ ${slot}</span>
          <span style="background: #4682B4; color: white; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${students.length}</span>
        </h3>
        <ul style="list-style:none; padding:0; margin:0;">
          ${students.map(s => `
            <li style="padding: 0.6rem 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <div style="min-width: 0; flex: 1;">
                <div style="font-weight: 600; color: #333;">${s.nameCn}</div>
                <div style="font-size: 0.82rem; color: #666;">
                  ${s.nickname} · Grade ${s.grade}
                </div>
              </div>
              <span class="slot-pill ${s.color}" style="min-width: 110px; font-size: 0.78rem;">
                ${s.subject} · ${s.level}
              </span>
            </li>
          `).join('')}
        </ul>`;
      dayGrid.appendChild(card);
    });
  };

  onValue(studentsRef, callback, (err) => {
    console.error('❌ Timetable listener error:', err);
    dayGrid.innerHTML = `<p class="error" style="grid-column:1/-1; text-align:center;">Error loading timetable: ${err.message}</p>`;
  });

  timetableUnsubscribe = () => off(studentsRef, 'value', callback);
}

if (daySelect) {
  daySelect.addEventListener('change', loadTimetable);
  loadTimetable();
} else {
  console.error('❌ #timetableDay dropdown not found in HTML!');
}

window.addEventListener('beforeunload', () => {
  if (timetableUnsubscribe) timetableUnsubscribe();
});

// ============================================
// ✅ MONTHLY REPORT LOGIC
// ============================================
const generateBtn = document.getElementById('generateReport');
if (generateBtn) {
  generateBtn.addEventListener('click', async () => {
    const subject = document.getElementById('reportSubject').value;
    const month = document.getElementById('reportMonth').value;
    const tbody = document.getElementById('reportBody');
    const tableContainer = document.getElementById('monthlyReport');
    const loader1 = document.getElementById('loadingOverlay');
    const loader2 = document.getElementById('page-loader');

    if (!month) return alert('Please select a month');
    if (loader1) loader1.classList.remove('hidden');
    if (loader2) loader2.classList.remove('hidden');
    tbody.innerHTML = '';

    try {
      const snapshot = await get(studentsRef);
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const s = child.val();
          if (!s.subjects) return;
          const subjects = Array.isArray(s.subjects) ? s.subjects : Object.values(s.subjects);
          subjects.forEach(sub => {
            if (subject !== 'all' && sub.name !== subject) return;
            const progress = sub.progress ? (Array.isArray(sub.progress) ? sub.progress : Object.values(sub.progress)) : [];
            const prog = progress.find(p => p.month === month);
            if (prog) {
              const row = document.createElement('tr');
              const t = prog.test || {};
              row.innerHTML = `
                <td>${s.studentNumber || '-'}</td>
                <td>${s.nameCn || '-'}</td>
                <td>${s.namePinyin || s.nickname || '-'}</td>
                <td>${s.grade || '-'}</td>
                <td>${prog.prevLevel || '-'}</td>
                <td>${prog.prevWS || '-'}</td>
                <td>${prog.currLevel || '-'}</td>
                <td>${prog.currWS || '-'}</td>
                <td>${t.level || '-'}</td>
                <td>${t.score || '-'}</td>
                <td>${t.time || '-'}</td>
                <td>${t.group || '-'}</td>`;
              tbody.appendChild(row);
            }
          });
        });
      }
      if (tbody.innerHTML === '') {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding: 1rem;">No data for this period</td></tr>';
      }
      if (tableContainer) tableContainer.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      alert('Error generating report: ' + err.message);
    } finally {
      if (loader1) loader1.classList.add('hidden');
      if (loader2) loader2.classList.add('hidden');
    }
  });
}

const printTimetableBtn = document.getElementById('printTimetable');
if (printTimetableBtn) printTimetableBtn.onclick = () => window.print();

const printReportBtn = document.getElementById('printReport');
if (printReportBtn) printReportBtn.onclick = () => window.print();