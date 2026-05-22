import { requireAuth, db } from './auth.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

if (!requireAuth()) window.location.href = 'index.html';

const centerId = sessionStorage.getItem('selectedCenter');
const studentsRef = ref(db, `centers/${centerId}/students`);

async function loadStudents(searchTerm = '') {
    const loader = document.getElementById('page-loader');
    const tbody = document.getElementById('studentList');
    
    loader?.classList.remove('hidden');
    tbody.innerHTML = '<tr><td colspan="9" class="hint" style="text-align:center;">Loading...</td></tr>';

    try {
        const snapshot = await get(studentsRef);
        if (!snapshot.exists()) {
            tbody.innerHTML = '<tr><td colspan="9" class="hint" style="text-align:center; padding:1rem;">No students found. Click "+ Add Student" to begin.</td></tr>';
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

        // 1️⃣ FILTER: Subject Dropdown (Strict)
        const subjectFilter = document.getElementById('filter-subject')?.value || '';
        let filtered = subjectFilter ? allRows.filter(r => r.subjectName === subjectFilter) : allRows;

        // 2️⃣ FILTER: Search Term
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

        // 3️⃣ SORT: 3-Level (Primary/Secondary/Tertiary)
        const sortRules = getSortRules();
        const sorted = applyMultiSort(filtered, sortRules);

        // 4️⃣ RENDER
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

// 🔽 3-Level Sort Engine
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

// 🔽 Event Listeners
document.querySelectorAll('#filter-subject, [id^="sort"]').forEach(el => {
    el.addEventListener('change', () => loadStudents(document.getElementById('searchInput')?.value || ''));
});

document.getElementById('clearSortBtn')?.addEventListener('click', () => {
    document.getElementById('filter-subject').value = '';
    document.getElementById('sort1-field').value = '';
    document.getElementById('sort1-dir').value = 'asc';
    document.getElementById('sort2-field').value = '';
    document.getElementById('sort2-dir').value = 'asc';
    document.getElementById('sort3-field').value = '';
    document.getElementById('sort3-dir').value = 'asc';
    loadStudents(document.getElementById('searchInput')?.value || '');
});

document.getElementById('searchInput')?.addEventListener('input', (e) => loadStudents(e.target.value));
document.getElementById('addStudentBtn')?.addEventListener('click', () => window.location.href = 'student-form.html');
document.getElementById('logoutBtn')?.addEventListener('click', () => { 
    sessionStorage.removeItem('kumonAuth'); 
    window.location.href = 'index.html'; 
});

// Initial render
loadStudents();