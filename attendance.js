// attendance.js
import { requireAuth, db } from './auth.js';
import { ref, get, onValue, set, remove, update } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

if (!requireAuth()) {}
const centerId = sessionStorage.getItem('selectedCenter');
if (!centerId) {
    alert('No center selected. Please log in again.');
    window.location.href = 'centers.html';
}

const dateInput = document.getElementById('attendanceDate');
const attendanceBody = document.getElementById('attendanceBody');
const scanBtn = document.getElementById('scanBtn');
const scanModal = document.getElementById('scanModal');
const confirmModal = document.getElementById('confirmModal');
const closeScanModal = document.getElementById('closeScanModal');
const qrReader = document.getElementById('qr-reader');
const scanStatus = document.getElementById('scanStatus');
const studentInfoDiv = document.getElementById('studentInfo');
const subjectCheckboxesDiv = document.getElementById('subjectCheckboxes');
const confirmBtn = document.getElementById('confirmAttendanceBtn');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');

dateInput.value = new Date().toISOString().split('T')[0];

let html5QrCode = null;
let currentStudent = null;
let studentsCache = {};
let attendanceListener = null;
let currentAttendanceData = {}; // Stores latest snapshot for instant re-renders

// 🔄 INIT: Pre-load all students
async function initApp() {
    try {
        const snap = await get(ref(db, `centers/${centerId}/students`));
        snap.forEach(child => studentsCache[child.key] = child.val());
        console.log(`✅ Cached ${Object.keys(studentsCache).length} students`);
    } catch (e) {
        console.error('Failed to cache students:', e);
    }
    setupAttendanceListener();
}
initApp();

// 📊 DYNAMIC STATUS CALCULATOR
function calculateStatus(scheduledTime, checkInISO) {
    if (!scheduledTime) return 'Not Today';
    const [sH, sM] = scheduledTime.split(':').map(Number);
    const cDate = new Date(checkInISO);
    const cH = cDate.getHours();
    const cM = cDate.getMinutes();
    const diff = (cH * 60 + cM) - (sH * 60 + sM);
    
    if (diff < -5) return 'Early';       // >5 mins before schedule
    if (diff > 10) return 'Late';       // >10 mins after schedule
    return 'On Time';                   // Within grace window
}

// 📅 REAL-TIME LISTENER
function setupAttendanceListener() {
    const date = dateInput.value;
    if (attendanceListener) attendanceListener();
    attendanceBody.innerHTML = '<tr><td colspan="9" class="text-center">Loading attendance...</td></tr>';

    attendanceListener = onValue(ref(db, `centers/${centerId}/attendance/${date}`), (snapshot) => {
        currentAttendanceData = snapshot.exists() ? snapshot.val() : {};
        renderTable();
    });
}

// 🎨 RENDER FUNCTION (Separates data from DOM for instant cache-sync updates)
function renderTable() {
    attendanceBody.innerHTML = '';
    if (Object.keys(currentAttendanceData).length === 0) {
        attendanceBody.innerHTML = '<tr><td colspan="9" class="text-center">No attendance records for this day.</td></tr>';
        return;
    }

    let rowsHtml = '';
    for (const [studentId, subjects] of Object.entries(currentAttendanceData)) {
        const student = studentsCache[studentId];
        if (!student || typeof subjects !== 'object') continue;

        for (const [subjectName, record] of Object.entries(subjects)) {
            rowsHtml += createAttendanceRowHtml(studentId, subjectName, record);
        }
    }
    attendanceBody.innerHTML = rowsHtml || '<tr><td colspan="9" class="text-center">No records for selected subjects.</td></tr>';
}

// 📝 GENERATES ROW HTML (Uses CURRENT timeslots for status calculation)
function createAttendanceRowHtml(studentId, subjectName, record) {
    const student = studentsCache[studentId];
    if (!student) return '';

    const subjObj = student.subjects?.find(s => s.name === subjectName);
    const scheduledTimes = subjObj?.timeslots?.map(t => `${t.day} ${t.time}`).join(', ') || 'N/A';
    const checkInTime = new Date(record.checkInTime).toLocaleTimeString();
    
    // 🔍 DYNAMIC STATUS: Calculate based on ACTUAL check-in day & CURRENT student timeslot
    const checkInDate = new Date(record.checkInTime);
    const checkInDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][checkInDate.getDay()];
    const daySlots = subjObj?.timeslots?.filter(t => t.day === checkInDay) || [];
    const scheduledTimeForDay = daySlots.length > 0 ? daySlots[0].time : '';
    const status = calculateStatus(scheduledTimeForDay, record.checkInTime);
    
    const statusConfig = {
        'Early': { color: '#28a745', icon: '⏩' },
        'On Time': { color: '#17a2b8', icon: '✅' },
        'Late': { color: '#dc3545', icon: '⚠️' },
        'Not Today': { color: '#ffc107', icon: '📅' }
    };
    const { color, icon } = statusConfig[status] || statusConfig['On Time'];

    return `
        <tr class="student-row">
            <td>${subjectName}</td>
            <td>${student.nameCn || '-'}</td>
            <td>${student.nickname || '-'}</td>
            <td>${student.grade || '-'}</td>
            <td>${student.school || '-'}</td>
            <td>${scheduledTimes}</td>
            <td>${checkInTime}</td>
            <td style="color: ${color}; font-weight:600;">${icon} ${status}</td>
            <td>
                <button class="delete-att-btn" data-student-id="${studentId}" data-subject="${subjectName}" 
                    style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem;">
                    🗑️ Delete
                </button>
            </td>
        </tr>
    `;
}

dateInput.addEventListener('change', setupAttendanceListener);

// 🔄 CROSS-TAB SYNC: Refreshes student cache & recalculates statuses when you switch tabs
window.addEventListener('focus', async () => {
    try {
        const snap = await get(ref(db, `centers/${centerId}/students`));
        snap.forEach(child => studentsCache[child.key] = child.val());
        renderTable(); // Instantly reflects edited timeslots
    } catch (e) { console.error('Cache refresh failed:', e); }
});

// 🗑️ DELETE ATTENDANCE
attendanceBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-att-btn');
    if (!btn) return;

    const studentId = btn.dataset.studentId;
    const subject = btn.dataset.subject;
    const date = dateInput.value;
    const path = `centers/${centerId}/attendance/${date}/${studentId}/${subject}`;

    if (confirm(`Delete attendance for ${subject}?`)) {
        btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = '...';
        try {
            await remove(ref(db, path));
        } catch (err) {
            alert('Error: ' + err.message);
            btn.disabled = false; btn.style.opacity = '1'; btn.textContent = '🗑️ Delete';
        }
    }
});

// 📷 QR SCANNER LOGIC
scanBtn.addEventListener('click', () => { scanModal.classList.remove('hidden'); startScanner(); });
closeScanModal.addEventListener('click', stopScannerAndClose);

async function startScanner() {
    if (!window.Html5Qrcode) return alert('QR Library not loaded');
    html5QrCode = new Html5Qrcode("qr-reader");
    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => { stopScannerAndClose(); handleScan(decodedText); },
            () => {}
        );
        scanStatus.textContent = 'Point camera at QR code...';
    } catch (err) {
        scanStatus.textContent = '❌ Camera error: ' + err.message;
    }
}

function stopScannerAndClose() {
    if (html5QrCode) { html5QrCode.stop(); html5QrCode = null; }
    scanModal.classList.add('hidden');
}

async function handleScan(qrCode) {
    const scanned = qrCode.trim();
    let found = null, sid = null;

    for (const [key, val] of Object.entries(studentsCache)) {
        if (val.qrCode && val.qrCode.trim() === scanned) { found = val; sid = key; break; }
    }

    if (!found) {
        scanStatus.textContent = '⏳ Searching database...';
        try {
            const studentsSnap = await get(ref(db, `centers/${centerId}/students`));
            studentsSnap.forEach(child => {
                const data = child.val();
                if (data && data.qrCode && data.qrCode.trim() === scanned) {
                    found = data; sid = child.key;
                    studentsCache[sid] = data;
                }
            });
        } catch (err) { console.error('DB fallback failed:', err); }
    }
    scanStatus.textContent = 'Point camera at QR code...';

    if (!found) return alert('Student not found in this center!');
    currentStudent = { id: sid, ...found };
    showConfirmationModal();
}

// ✅ CONFIRMATION MODAL
function showConfirmationModal() {
    confirmModal.classList.remove('hidden');
    studentInfoDiv.innerHTML = `<h3>${currentStudent.nameCn} (${currentStudent.nickname})<br>Grade ${currentStudent.grade} | ${currentStudent.school}</h3>`;
    subjectCheckboxesDiv.innerHTML = '';

    const activeSubjects = (currentStudent.subjects || []).filter(s => s.status === 'current' || s.status === 'new');
    if (activeSubjects.length === 0) {
        subjectCheckboxesDiv.innerHTML = '<p style="color:#dc3545;">No active subjects found.</p>';
        return;
    }

    activeSubjects.forEach(sub => {
        const label = document.createElement('label');
        label.style.display = 'block'; label.style.padding = '0.5rem'; label.style.borderBottom = '1px solid #eee';
        label.innerHTML = `
            <input type="checkbox" value="${sub.name}" checked> <strong>${sub.name}</strong> (Level: ${sub.startLevel})
            <br><small style="color:#666;">Timeslots: ${sub.timeslots.map(t => `${t.day} ${t.time}`).join(', ')}</small>
        `;
        subjectCheckboxesDiv.appendChild(label);
    });
}

confirmBtn.addEventListener('click', async () => {
    const selected = Array.from(subjectCheckboxesDiv.querySelectorAll('input:checked')).map(cb => cb.value);
    if (selected.length === 0) return alert('Select at least one subject.');

    const date = dateInput.value;
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    const todayDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];

    confirmBtn.disabled = true; confirmBtn.textContent = 'Saving...';
    try {
        const updates = {};
        for (const subject of selected) {
            const subj = currentStudent.subjects.find(s => s.name === subject);
            const todaySlots = subj?.timeslots.filter(t => t.day === todayDay) || [];
            const scheduledTime = todaySlots.length > 0 ? todaySlots[0].time : '';
            const status = calculateStatus(scheduledTime, now.toISOString());

            updates[`centers/${centerId}/attendance/${date}/${currentStudent.id}/${subject}`] = {
                subject,
                checkInTime: now.toISOString(),
                scheduledTime,
                status
            };
        }
        
        await update(ref(db), updates);
        alert(`✅ Attendance confirmed for ${selected.length} subject(s)!`);
        confirmModal.classList.add('hidden');
        currentStudent = null;
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm Attendance';
    }
});

cancelConfirmBtn.addEventListener('click', () => { confirmModal.classList.add('hidden'); currentStudent = null; });

window.addEventListener('beforeunload', () => {
    if (attendanceListener) attendanceListener();
    if (html5QrCode) html5QrCode.stop();
});