import { requireAuth, db } from './auth.js';
import { ref, get, push } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

if (!requireAuth()) window.location.href = 'index.html';
const centerId = sessionStorage.getItem('selectedCenter');
const studentsRef = ref(db, `centers/${centerId}/students`);

// ==========================================
// 📥 EXCEL IMPORT CONFIGURATION & LOGIC
// ==========================================
const COLUMN_MAP_LOWER = {
  'studentno': 'studentNumber', 'family name': 'familyName', 'first name': 'firstName',
  'chinese name': 'nameCn', 'nickname': 'nickname', 'schoolgrade': 'grade',
  'schoolname': 'school', 'dateofbirth': 'birthday', 'nationality': 'nationality',
  'email': 'email', 'phone (emergency_m)': 'phoneMom', 'phone (emergency_d)': 'phoneDad',
  'phone (emergency_self)': 'phoneOwn', 'ship address': 'address',
  'maths': 'mathBool', 'mstarting': 'mathStartLevel', 'mstartingno': 'mathStartWS',
  'menrollmentdate': 'mathEnrolDate', 'mclassday': 'mathDay1', 'mclasstime': 'mathTime1',
  'mclassday2': 'mathDay2', 'mclasstime2': 'mathTime2', 'currentmath': 'mathCurrentLevel', 'mathno': 'mathCurrentWS',
  'english': 'engBool', 'estarting': 'engStartLevel', 'estartingno': 'engStartWS',
  'eenrollmentdate': 'engEnrolDate', 'eclassday': 'engDay1', 'ecclasstime': 'engTime1',
  'eclassday2': 'engDay2', 'ecclasstime2': 'engTime2', 'currenteng': 'engCurrentLevel', 'engno': 'engCurrentWS',
  'efl': 'eflBool', 'eflstarting': 'eflStartLevel', 'eflstartingno': 'eflStartWS',
  'eflenrollmentdate': 'eflEnrolDate', 'eflclassday': 'eflDay1', 'eflclasstime': 'eflTime1',
  'eflclassday2': 'eflDay2', 'eflclasstime2': 'eflTime2', 'currentefl': 'eflCurrentLevel', 'eflno': 'eflCurrentWS',
  'chinese': 'chiBool', 'cstarting': 'chiStartLevel', 'cstartingno': 'chiStartWS',
  'cenrollmentdate': 'chiEnrolDate', 'cclassday': 'chiDay1', 'cclasstime': 'chiTime1',
  'cclassday2': 'chiDay2', 'cclasstime2': 'chiTime2', 'currentchinese': 'chiCurrentLevel', 'chino': 'chiCurrentWS'
};

function parseExcelDate(val) {
  if (!val) return '';
  if (val instanceof Date) return !isNaN(val) ? val.toISOString().split('T')[0] : '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  return !isNaN(parsed) ? parsed.toISOString().split('T')[0] : str;
}

function parseExcelTime(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const totalMin = Math.round(val * 24 * 60);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  let str = String(val).trim().toUpperCase();
  const amPmMatch = str.match(/(AM|PM)/i);
  if (amPmMatch) {
    const [time, mod] = str.split(amPmMatch[0]);
    let [h, m] = time.replace(/[^0-9:]/g, '').split(':');
    h = parseInt(h, 10) || 0;
    if (mod === 'PM' && h < 12) h += 12;
    if (mod === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${(m || '00').padStart(2, '0')}`;
  }
  const parts = str.split(':');
  if (parts.length >= 2) return `${String(parts[0]).padStart(2, '0')}:${String(parts[1]).padStart(2, '0')}`;
  return str;
}

function isSubjectEnabled(val) {
  if (val === undefined || val === null || val === '') return false;
  const v = String(val).trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

function buildSubject(getVal, prefix, name) {
  const boolKey = `${prefix}Bool`;
  if (!isSubjectEnabled(getVal(boolKey))) return null;

  const timeslots = [];
  const d1 = getVal(`${prefix}Day1`);
  const t1 = parseExcelTime(getVal(`${prefix}Time1`));
  if (d1 && t1) timeslots.push({ day: String(d1).trim(), time: t1 });

  const d2 = getVal(`${prefix}Day2`);
  const t2 = parseExcelTime(getVal(`${prefix}Time2`));
  if (d2 && t2) timeslots.push({ day: String(d2).trim(), time: t2 });

  // ✅ REMOVED: `if (timeslots.length === 0) return null;`
  // Subjects now import even if schedule days/times are blank.

  return {
    name,
    startLevel: String(getVal(`${prefix}StartLevel`) || '').trim(),
    startWS: parseInt(getVal(`${prefix}StartWS`)) || 0,
    enrolDate: parseExcelDate(getVal(`${prefix}EnrolDate`)),
    currentLevel: String(getVal(`${prefix}CurrentLevel`) || '').trim(),
    currentWS: parseInt(getVal(`${prefix}CurrentWS`)) || 0,
    timeslots,
    status: 'current',
    progress: []
  };
}

async function handleExcelImport(file) {
  const modal = document.getElementById('importProgressModal');
  const status = document.getElementById('importStatus');
  const progress = document.getElementById('importProgressBar');
  const closeBtn = document.getElementById('closeImportModal');
  
  modal?.classList.remove('hidden');
  closeBtn?.classList.add('hidden');
  if (status) status.textContent = '🔍 Reading file...';
  if (progress) progress.value = 0;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { cellDates: true, cellNF: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });

      if (!rawRows || rawRows.length === 0) throw new Error('The Excel file is completely empty.');

      // 🔍 1️⃣ Find Header Row dynamically
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
        const rowStr = (rawRows[i] || []).map(c => String(c || '').trim().toLowerCase()).join(' ');
        if (rowStr.includes('studentno') || rowStr.includes('student number')) {
          headerRowIndex = i;
          break;
        }
      }
      if (headerRowIndex === -1) throw new Error('Could not find the "StudentNo" header row. Please ensure it exists in the file.');

      // 🗺️ 2️⃣ Map Column Indices
      const headers = rawRows[headerRowIndex].map(h => String(h || '').trim().toLowerCase());
      const colIndexMap = {};
      headers.forEach((h, idx) => {
        if (COLUMN_MAP_LOWER[h]) colIndexMap[COLUMN_MAP_LOWER[h]] = idx;
      });

      const dataRows = rawRows.slice(headerRowIndex + 1);
      let success = 0, skipped = 0;

      if (status) status.textContent = `📦 Found ${dataRows.length} rows. Processing...`;

      // 🔄 3️⃣ Process Rows
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
          continue; // Skip completely empty rows
        }

        const getVal = (key) => {
          const idx = colIndexMap[key];
          if (idx === undefined || row[idx] === null || row[idx] === undefined) return '';
          return typeof row[idx] === 'string' ? row[idx].trim() : row[idx];
        };

        const studentNo = String(getVal('studentNumber') || '').trim();
        if (!studentNo || studentNo === '0') { skipped++; continue; }

        const family = getVal('familyName');
        const first = getVal('firstName');
        const namePinyin = (family && first) ? `${family} ${first}` : (family || first || '');

        const subjects = [];
        const mathSubj = buildSubject(getVal, 'math', 'Math');
        if (mathSubj) subjects.push(mathSubj);
        
        const engSubj = buildSubject(getVal, 'eng', 'English ERP');
        if (engSubj) subjects.push(engSubj);
        
        const eflSubj = buildSubject(getVal, 'efl', 'English EFL');
        if (eflSubj) subjects.push(eflSubj);
        
        const chiSubj = buildSubject(getVal, 'chi', 'Chinese (Trad)');
        if (chiSubj) subjects.push(chiSubj);

        // ✅ REMOVED: `if (subjects.length === 0) { skipped++; continue; }`
        // Rows will now import successfully even if NO subjects are flagged.
        // You can add subjects/schedules later via the UI.

        const studentData = {
          studentNumber: studentNo,
          namePinyin,
          nickname: getVal('nickname'),
          nameCn: getVal('nameCn'),
          grade: getVal('grade'),
          school: getVal('school'),
          birthday: parseExcelDate(getVal('birthday')),
          nationality: getVal('nationality'),
          email: getVal('email'),
          phone: { mom: getVal('phoneMom'), dad: getVal('phoneDad'), own: getVal('phoneOwn') },
          address: getVal('address'),
          subjects,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await push(studentsRef, studentData);
        success++;
        if (progress) progress.value = Math.round(((i + 1) / dataRows.length) * 100);
      }

      if (status) status.textContent = `✅ Done! ${success} imported, ${skipped} skipped.`;
      closeBtn?.classList.remove('hidden');
    } catch (err) {
      console.error('❌ Import error:', err);
      if (status) status.textContent = `❌ Error: ${err.message}`;
    }
  };
  reader.onerror = () => { if (status) status.textContent = '❌ Failed to read file.'; };
  reader.readAsArrayBuffer(file);
}

// ==========================================
// 📋 STUDENT LIST & SORTING LOGIC
// ==========================================
async function loadStudents(searchTerm = '') {
  const loader = document.getElementById('page-loader');
  const tbody = document.getElementById('studentList');
  loader?.classList.remove('hidden');
  tbody.innerHTML = '<tr><td colspan="9" class="hint" style="text-align:center;">Loading...</td></tr>';
  
  try {
    const snapshot = await get(studentsRef);
    if (!snapshot.exists()) {
      tbody.innerHTML = '<tr><td colspan="9" class="hint" style="text-align:center; padding:1rem;">No students found. Click "+ Add Student" or import an Excel file.</td></tr>';
      return;
    }

    const allRows = [];
    snapshot.forEach(child => {
      const student = child.val();
      const id = child.key;
      if (student.subjects && Array.isArray(student.subjects)) {
        student.subjects.forEach(sub => {
          allRows.push({
            ...student, id,
            subjectName: sub.name || '-',
            level: sub.startLevel || '-',
            enrolDate: sub.enrolDate || '-',
            rawDob: student.birthday || '',
            rawEnrolDate: sub.enrolDate || ''
          });
        });
      } else {
        allRows.push({
          ...student, id,
          subjectName: '-', level: '-', enrolDate: '-',
          rawDob: student.birthday || '',
          rawEnrolDate: ''
        });
      }
    });

    const subjectFilter = document.getElementById('filter-subject')?.value || '';
    let filtered = subjectFilter ? allRows.filter(r => r.subjectName === subjectFilter) : allRows;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        row.nameCn?.toLowerCase().includes(term) ||
        row.nickname?.toLowerCase().includes(term) ||
        row.namePinyin?.toLowerCase().includes(term) ||
        row.studentNumber?.toLowerCase().includes(term) ||
        row.grade?.toLowerCase().includes(term) ||
        row.school?.toLowerCase().includes(term) ||
        row.subjectName?.toLowerCase().includes(term)
      );
    }

    const sortRules = getSortRules();
    const sorted = applyMultiSort(filtered, sortRules);

    tbody.innerHTML = '';
    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="hint" style="text-align:center; padding:1rem;">No matching students found.</td></tr>';
    } else {
      sorted.forEach(row => {
        const dobDisplay = row.rawDob ? new Date(row.rawDob).toLocaleDateString('en-CA') : '-';
        const enrolDisplay = row.rawEnrolDate ? new Date(row.rawEnrolDate).toLocaleDateString('en-CA') : '-';
        const tr = document.createElement('tr');
        tr.className = 'student-row';
        tr.innerHTML = `
          <td>${row.subjectName}</td>
          <td>${row.studentNumber || '-'}</td>
          <td>${row.nameCn || '-'}</td>
          <td>${row.nickname || '-'}</td>
          <td>${row.namePinyin || '-'}</td>
          <td>${dobDisplay}</td>
          <td>${row.grade || '-'}</td>
          <td>${row.level}</td>
          <td>${enrolDisplay}</td>
        `;
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
          if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
          window.location.href = `student-form.html?id=${row.id}`;
        };
        tbody.appendChild(tr);
      });
    }
  } catch (error) {
    console.error('Error loading students:', error);
    tbody.innerHTML = `<tr><td colspan="9" class="error">Error loading students: ${error.message}</td></tr>`;
  } finally {
    if (loader) setTimeout(() => loader.classList.add('hidden'), 300);
  }
}

function getSortRules() {
  const rules = [];
  for (let i = 1; i <= 3; i++) {
    const field = document.getElementById(`sort${i}-field`)?.value;
    const dir = document.getElementById(`sort${i}-dir`)?.value || 'asc';
    if (field) rules.push({ field, direction: dir });
  }
  return rules;
}

function applyMultiSort(rows, rules) {
  if (rules.length === 0) return rows;
  return rows.sort((a, b) => {
    for (const rule of rules) {
      let valA = a[rule.field] !== undefined ? a[rule.field] : '';
      let valB = b[rule.field] !== undefined ? b[rule.field] : '';
      if (rule.field === 'dob') { valA = a.rawDob || ''; valB = b.rawDob || ''; }
      if (rule.field === 'enrolDate') { valA = a.rawEnrolDate || ''; valB = b.rawEnrolDate || ''; }
      if (!valA && valB) return 1;
      if (valA && !valB) return -1;
      if (!valA && !valB) continue;
      const strA = typeof valA === 'string' ? valA.toLowerCase() : valA;
      const strB = typeof valB === 'string' ? valB.toLowerCase() : valB;
      if (strA < strB) return rule.direction === 'asc' ? -1 : 1;
      if (strA > strB) return rule.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
}

// ==========================================
// 📤 EXCEL EXPORT LOGIC
// ==========================================
async function exportStudentsToExcel() {
  const loader = document.getElementById('page-loader');
  loader?.classList.remove('hidden');
  
  try {
    const snapshot = await get(studentsRef);
    if (!snapshot.exists()) {
      alert("No students found to export.");
      return;
    }

    const rows = [];
    snapshot.forEach(child => {
      const s = child.val();
      const subs = s.subjects || [];
      const getSubj = (name) => subs.find(sub => sub.name === name) || {};

      const math = getSubj('Math');
      const eng = getSubj('English ERP');
      const efl = getSubj('English EFL');
      const chi = getSubj('Chinese (Trad)');

      rows.push({
        'StudentNo': s.studentNumber || '',
        'Family Name': s.namePinyin || '',
        'First Name': '',
        'Chinese Name': s.nameCn || '',
        'Nickname': s.nickname || '',
        'SchoolGrade': s.grade || '',
        'SchoolName': s.school || '',
        'DateOfBirth': s.birthday || '',
        'Nationality': s.nationality || '',
        'Email': s.email || '',
        'Phone (Emergency_M)': s.phone?.mom || '',
        'Phone (Emergency_D)': s.phone?.dad || '',
        'Phone (Emergency_Self)': s.phone?.own || '',
        'Ship Address': s.address || '',
        // Math
        'Maths': math.name ? '1' : '',
        'MStarting': math.startLevel || '',
        'MStartingNo': math.startWS || '',
        'MEnrollmentDate': math.enrolDate || '',
        'MClassDay': math.timeslots?.[0]?.day || '',
        'MClassTime': math.timeslots?.[0]?.time || '',
        'MClassDay2': math.timeslots?.[1]?.day || '',
        'MClassTime2': math.timeslots?.[1]?.time || '',
        'CurrentMath': math.currentLevel || '',
        'MathNo': math.currentWS || '',
        // English ERP
        'English': eng.name ? '1' : '',
        'EStarting': eng.startLevel || '',
        'EStartingNo': eng.startWS || '',
        'EEnrollmentDate': eng.enrolDate || '',
        'EClassDay': eng.timeslots?.[0]?.day || '',
        'EClassTime': eng.timeslots?.[0]?.time || '',
        'EClassDay2': eng.timeslots?.[1]?.day || '',
        'EClassTime2': eng.timeslots?.[1]?.time || '',
        'CurrentEng': eng.currentLevel || '',
        'EngNo': eng.currentWS || '',
        // English EFL
        'EFL': efl.name ? '1' : '',
        'EFLStarting': efl.startLevel || '',
        'EFLStartingNo': efl.startWS || '',
        'EFLEnrollmentDate': efl.enrolDate || '',
        'EFLClassDay': efl.timeslots?.[0]?.day || '',
        'EFLClassTime': efl.timeslots?.[0]?.time || '',
        'EFLClassDay2': efl.timeslots?.[1]?.day || '',
        'EFLClassTime2': efl.timeslots?.[1]?.time || '',
        'CurrentEFL': efl.currentLevel || '',
        'EFLNo': efl.currentWS || '',
        // Chinese
        'Chinese': chi.name ? '1' : '',
        'CStarting': chi.startLevel || '',
        'CStartingNo': chi.startWS || '',
        'CEnrollmentDate': chi.enrolDate || '',
        'CClassDay': chi.timeslots?.[0]?.day || '',
        'CClassTime': chi.timeslots?.[0]?.time || '',
        'CClassDay2': chi.timeslots?.[1]?.day || '',
        'CClassTime2': chi.timeslots?.[1]?.time || '',
        'CurrentChinese': chi.currentLevel || '',
        'ChiNo': chi.currentWS || ''
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `Kumon_Students_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (err) {
    console.error("❌ Export failed:", err);
    alert("Failed to export students. Check console for details.");
  } finally {
    loader?.classList.add('hidden');
  }
}

// ==========================================
// 🔌 EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#filter-subject, [id^="sort"]').forEach(el => {
    el.addEventListener('change', () => loadStudents(document.getElementById('searchInput')?.value || ''));
  });
  document.getElementById('clearSortBtn')?.addEventListener('click', () => {
    document.getElementById('filter-subject').value = '';
    for (let i = 1; i <= 3; i++) {
      document.getElementById(`sort${i}-field`).value = '';
      document.getElementById(`sort${i}-dir`).value = 'asc';
    }
    loadStudents(document.getElementById('searchInput')?.value || '');
  });
  document.getElementById('searchInput')?.addEventListener('input', (e) => loadStudents(e.target.value));
  document.getElementById('addStudentBtn')?.addEventListener('click', () => window.location.href = 'student-form.html');
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('kumonAuth');
    window.location.href = 'index.html';
  });

  // 📥 Import Button
  const importBtn = document.getElementById('importBtn');
  const excelFileInput = document.getElementById('excelFileInput');
  if (importBtn && excelFileInput) {
    importBtn.addEventListener('click', () => excelFileInput.click());
    excelFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleExcelImport(file);
      e.target.value = '';
    });
  }

document.getElementById('exportBtn')?.addEventListener('click', exportStudentsToExcel);
document.getElementById('closeImportModal')?.addEventListener('click', () => {
    document.getElementById('importProgressModal')?.classList.add('hidden');
    loadStudents();
  });

  loadStudents();
});