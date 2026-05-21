// student-form.js
import { requireAuth, db } from './auth.js';
import { ref, push, set, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

if (!requireAuth()) {}

const SUBJECTS = ['Math', 'Chinese', 'English ERP', 'English EFL'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
let subjectCount = 0;

const centerId = sessionStorage.getItem('selectedCenter');
const studentId = new URLSearchParams(window.location.search).get('id');
const isEdit = !!studentId;

document.getElementById('formTitle').textContent = isEdit ? 'Edit Student' : 'Add Student';

function hideLoader() {
  const loader = document.getElementById('loadingOverlay');
  if (loader) setTimeout(() => loader.classList.add('hidden'), 300);
}

if (isEdit) {
  loadStudentData();
} else {
  addSubjectField();
  hideLoader();
}

async function loadStudentData() {
  try {
    const snap = await get(ref(db, `centers/${centerId}/students/${studentId}`));
    if (snap.exists()) {
      const s = snap.val();
      document.getElementById('studentNumber').value = s.studentNumber || '';
      document.getElementById('nameEn').value = s.nameEn || '';
      document.getElementById('nameCn').value = s.nameCn || '';
      document.getElementById('grade').value = s.grade || '';
      document.getElementById('school').value = s.school || '';
      document.getElementById('address').value = s.address || '';
      document.getElementById('nationality').value = s.nationality || '';
      document.getElementById('email').value = s.email || '';
      document.getElementById('birthday').value = s.birthday || '';
      
      if (s.phone) {
        document.getElementById('phoneMom').value = s.phone.mom || '';
        document.getElementById('phoneDad').value = s.phone.dad || '';
        document.getElementById('phoneOwn').value = s.phone.own || '';
      }

      if (s.subjects) {
        s.subjects.forEach(sub => addSubjectField(sub));
      } else {
        addSubjectField();
      }
    }
  } catch (err) {
    alert('Error loading student: ' + err.message);
  } finally {
    hideLoader();
  }
}

function addSubjectField(data = {}) {
  if (subjectCount >= 3) return alert('Maximum 3 subjects allowed');
  
  const container = document.getElementById('subjectsContainer');
  const div = document.createElement('div');
  div.className = 'subject-entry';

  // ✅ Clean, single template literal (NO fragmented backticks)
  div.innerHTML = `
    <div class="form-grid">
      <select class="subject-name" required>
        <option value="">Select Subject *</option>
        ${SUBJECTS.map(s => `<option value="${s}" ${data.name === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <div>
        <label>Start Level *</label>
        <input type="text" class="start-level" placeholder="e.g. 7A" value="${data.startLevel || ''}" required>
      </div>
      <div>
        <label>Start WS # *</label>
        <input type="number" class="start-ws" placeholder="e.g. 10" value="${data.startWS || 0}" required>
      </div>
      <div>
        <label>Status</label>
        <select class="status">
          <option value="new" ${data.status === 'new' ? 'selected' : ''}>New</option>
          <option value="current" ${data.status === 'current' ? 'selected' : ''} selected>Current</option>
          <option value="pause" ${data.status === 'pause' ? 'selected' : ''}>Pause</option>
          <option value="drop" ${data.status === 'drop' ? 'selected' : ''}>Drop</option>
        </select>
      </div>
    </div>
    <div class="timeslots-container">
      <h4 style="font-size:0.9rem; margin:0 0 0.5rem;">Timeslots (Max 6)</h4>
      <div class="timeslots-list"></div>
      <button type="button" class="add-timeslot-btn secondary" style="margin-top:0.5rem; padding:0.4rem 0.8rem; font-size:0.9rem;">+ Add Timeslot</button>
    </div>
    <button type="button" class="remove-subject" style="background:#dc3545; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; margin-top:0.5rem;">🗑️ Remove Subject</button>
  `;

  const timeslotsList = div.querySelector('.timeslots-list');
  
  if (data.timeslots && data.timeslots.length > 0) {
    data.timeslots.forEach(ts => addTimeslotField(timeslotsList, ts));
  } else {
    addTimeslotField(timeslotsList);
  }

  div.querySelector('.add-timeslot-btn').onclick = () => addTimeslotField(div.querySelector('.timeslots-list'));
  
  div.querySelector('.remove-subject').onclick = () => {
    div.remove();
    subjectCount--;
  };

  div.querySelector('.subject-name').addEventListener('change', (e) => {
    const selected = e.target.value;
    const allSelects = document.querySelectorAll('.subject-name');
    let hasConflict = false;
    if (selected === 'English ERP' || selected === 'English EFL') {
      allSelects.forEach(sel => {
        if (sel !== e.target && (sel.value === 'English ERP' || sel.value === 'English EFL')) {
          hasConflict = true;
        }
      });
    }
    if (hasConflict) {
      alert('English ERP and English EFL cannot be selected together.');
      e.target.value = '';
    }
  });

  container.appendChild(div);
  subjectCount++;
}

function addTimeslotField(timeslotsList, data = {}) {
  if (!timeslotsList) return;
  if (timeslotsList.children.length >= 6) return alert('Maximum 6 timeslots per subject');

  // Parse time (defaults to 01:00 if empty/invalid)
  let h = 1, m = 0;
  if (data.time) {
    const parts = data.time.split(':');
    if (parts.length === 2) {
      h = parseInt(parts[0], 10) || 1;
      m = parseInt(parts[1], 10) || 0;
    }
  }

  const row = document.createElement('div');
  row.className = 'timeslot-row';
  const dayOptions = DAYS.map(d => `<option value="${d}" ${data.day === d ? 'selected' : ''}>${d}</option>`).join('');

  // ✅ Custom 1-24h Military Time Picker
  row.innerHTML = `
    <div>
      <label>Day</label>
      <select class="ts-day" required>${dayOptions}</select>
    </div>
    <div>
      <label>Time (1-24h)</label>
      <div class="custom-time-picker">
        <input type="number" class="ts-hour" min="1" max="24" value="${h}" required>
        <span class="time-sep">:</span>
        <input type="number" class="ts-min" min="0" max="59" value="${String(m).padStart(2, '0')}" required>
      </div>
    </div>
    <button type="button" class="remove-ts-btn">×</button>
  `;

  // Validation & UX
  const hInput = row.querySelector('.ts-hour');
  const mInput = row.querySelector('.ts-min');

  hInput.addEventListener('input', () => {
    let v = parseInt(hInput.value);
    if (v > 24) hInput.value = 24;
    if (v < 1 || isNaN(v)) hInput.value = 1;
  });
  mInput.addEventListener('input', () => {
    let v = parseInt(mInput.value);
    if (v > 59) mInput.value = 59;
    if (v < 0 || isNaN(v)) mInput.value = 0;
  });
  mInput.addEventListener('blur', () => {
    let v = parseInt(mInput.value);
    if (!isNaN(v)) mInput.value = String(v).padStart(2, '0');
  });

  row.querySelector('.remove-ts-btn').onclick = () => row.remove();
  timeslotsList.appendChild(row);
}

document.getElementById('addSubjectBtn').onclick = () => addSubjectField();

document.getElementById('studentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!centerId) {
    alert('Error: No center selected. Please go back and select a center.');
    return;
  }

  const subjects = [];
  document.querySelectorAll('.subject-entry').forEach(entry => {
    const timeslots = [];
    entry.querySelectorAll('.timeslots-list .timeslot-row').forEach(row => {
      const h = parseInt(row.querySelector('.ts-hour').value) || 1;
      const m = parseInt(row.querySelector('.ts-min').value) || 0;
      timeslots.push({
        day: row.querySelector('.ts-day').value,
        time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      });
    });

    const subjectName = entry.querySelector('.subject-name').value;
    if (!subjectName) return alert('Please select a subject.');
    if (timeslots.length === 0) return alert(`Please add at least one timeslot for ${subjectName}`);

    subjects.push({
      name: subjectName,
      startLevel: entry.querySelector('.start-level').value,
      startWS: parseInt(entry.querySelector('.start-ws').value) || 0,
      status: entry.querySelector('.status').value,
      timeslots: timeslots,
      progress: [] 
    });
  });

  const studentData = {
    studentNumber: document.getElementById('studentNumber').value || '',
    nameEn: document.getElementById('nameEn').value,
    nameCn: document.getElementById('nameCn').value,
    grade: document.getElementById('grade').value,
    school: document.getElementById('school').value,
    address: document.getElementById('address').value,
    nationality: document.getElementById('nationality').value,
    email: document.getElementById('email').value,
    birthday: document.getElementById('birthday').value,
    phone: {
      mom: document.getElementById('phoneMom').value,
      dad: document.getElementById('phoneDad').value,
      own: document.getElementById('phoneOwn').value
    },
    subjects: subjects,
    updatedAt: new Date().toISOString()
  };

  if (!isEdit) {
    studentData.createdAt = new Date().toISOString();
  }

  try {
    const loader = document.getElementById('loadingOverlay');
    loader.classList.remove('hidden');
    
    if (isEdit) {
      await set(ref(db, `centers/${centerId}/students/${studentId}`), studentData);
      alert('Student updated successfully!');
    } else {
      await push(ref(db, `centers/${centerId}/students`), studentData);
      alert('Student added successfully!');
    }
    window.location.href = 'students.html';
  } catch (err) {
    alert('Error saving student: ' + err.message);
  } finally {
    const loader = document.getElementById('loadingOverlay');
    loader.classList.add('hidden');
  }
});