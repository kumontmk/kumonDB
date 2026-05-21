import { requireAuth, db } from './auth.js';
import { getDatabase, ref, get, push, update, remove, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

// ✅ Auth Guard
if (!requireAuth()) {
  // requireAuth handles redirection
}

const centerId = sessionStorage.getItem('selectedCenter');
const studentsRef = ref(db, `centers/${centerId}/students`);

// ✅ Load & display students
async function loadStudents(searchTerm = '') {
  const loader = document.getElementById('loadingOverlay');
  const container = document.getElementById('studentList');
  
  try {
    container.innerHTML = ''; // Clear list before loading
    const snapshot = await get(studentsRef);
    
    if (!snapshot.exists()) {
      container.innerHTML = '<p class="hint" style="text-align:center; padding:1rem;">No students found. Click "+ Add Student" to begin.</p>';
      return;
    }

    const students = [];
    snapshot.forEach(child => {
      const student = child.val();
      const id = child.key;
      
      // ✅ Fixed Syntax Error here
      if (searchTerm && !matchesSearch(student, searchTerm)) return;

      students.push({ ...student, id });
    });

    // Render cards
    students.forEach(student => {
      const card = document.createElement('div');
      card.className = 'student-card';
      card.innerHTML = `
        <div>
          <strong>${student.nameEn}</strong> (${student.nameCn})<br>
          <small>#${student.studentNumber} | ${student.grade} | ${student.school}</small><br>
          <small>📚 ${student.subjects.map(s => `<span class="badge">${s.name}: ${s.status}</span>`).join(', ')}</small>
        </div>
        <div class="student-actions">
          <button onclick="window.location.href='student-form.html?id=${student.id}'">✏️</button>
          <button onclick="window.location.href='progress.html?student=${student.id}'">📈</button>
          <button class="delete-btn" data-id="${student.id}">🗑️</button>
        </div>
      `;
      container.appendChild(card);
    });

    // ✅ Bind delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = async (e) => {
        if (confirm('Are you sure you want to delete this student?')) {
          const studentId = e.target.dataset.id;
          await remove(ref(db, `centers/${centerId}/students/${studentId}`));
          loadStudents(document.getElementById('searchInput').value);
        }
      };
    });

  } catch (error) {
    console.error('Error loading students:', error);
    container.innerHTML = `<p class="error">Error loading students: ${error.message}</p>`;
  } finally {
    if (loader) setTimeout(() => loader.classList.add('hidden'), 300);
  }
}

function matchesSearch(student, term) {
  term = term.toLowerCase();
  return (
    student.nameEn?.toLowerCase().includes(term) ||
    student.nameCn?.toLowerCase().includes(term) ||
    student.studentNumber?.toLowerCase().includes(term) ||
    student.school?.toLowerCase().includes(term)
  );
}

// ✅ Event Listeners
document.getElementById('searchInput')?.addEventListener('input', (e) => {
  loadStudents(e.target.value);
});

document.getElementById('addStudentBtn')?.addEventListener('click', () => {
  window.location.href = 'student-form.html';
});

// ✅ Initial Load
loadStudents();