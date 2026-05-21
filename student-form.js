import { requireAuth, db } from './auth.js';
import { ref, push, set, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

if (!requireAuth()) { /* redirects automatically */ }

const SUBJECTS = ['Math', 'Chinese', 'English ERP', 'English EFL'];
let subjectCount = 0;
const centerId = sessionStorage.getItem('selectedCenter');
const studentId = new URLSearchParams(window.location.search).get('id');
const isEdit = !!studentId;

document.getElementById('formTitle').textContent = isEdit ? 'Edit Student' : 'Add Student';

function hideLoader() {
  const loader = document.getElementById('loadingOverlay');
  if (loader) setTimeout(() => loader.classList.add('hidden'), 300);
}

// Load existing data if editing
if (isEdit) {
  loadStudentData();
} else {
  addSubjectField(); // Add one empty subject by default
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
  
  div.innerHTML = `
    <div class="form-grid">
      <select class="subject-name" required>
        <option value="">Select Subject *</option>
        ${SUBJECTS.map(s => `<option value="${s}" ${data.name === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <input type="text" class="start-level" placeholder="Start Level *" value="${data.startLevel || ''}" required>
      <input type="date" class="start-date" placeholder="Start Date *" value="${data.startDate || ''}" required>
      <input type="text" class="timeslot" placeholder="Timeslot (e.g. Mon 4PM)" value="${data.timeslot || ''}" required>
      <select class="status">
        <option value="new" ${data.status === 'new' ? 'selected' : ''}>New</option>
        <option value="current" ${data.status === 'current' ? 'selected' : ''} selected>Current</option>
        <option value="pause" ${data.status === 'pause' ? 'selected' : ''}>Pause</option>
        <option value="drop" ${data.status === 'drop' ? 'selected' : ''}>Drop</option>
      </select>
    </div>
    <button type="button" class="remove-subject">🗑️ Remove</button>
  `;

  // Validation: ERP vs EFL conflict
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

  div.querySelector('.remove-subject').onclick = () => {
    div.remove();
    subjectCount--;
  };

  container.appendChild(div);
  subjectCount++;
}

document.getElementById('addSubjectBtn').onclick = () => addSubjectField();

// Form submission
document.getElementById('studentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const subjects = [];
  document.querySelectorAll('.subject-entry').forEach(entry => {
    subjects.push({
      name: entry.querySelector('.subject-name').value,
      startLevel: entry.querySelector('.start-level').value,
      startDate: entry.querySelector('.start-date').value,
      timeslot: entry.querySelector('.timeslot').value,
      status: entry.querySelector('.status').value,
      progress: [] 
    });
  });

  const studentData = {
    studentNumber: document.getElementById('studentNumber').value,
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
  }
});