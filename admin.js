const STORAGE_KEYS = {
    QUESTIONS:     'institute_night_quiz_questions',
    CURRENT_PLAYER:'institute_night_quiz_player',
    PARTICIPANTS:  'institute_night_quiz_participants',
    SETTINGS:      'institute_night_quiz_settings'
};

// ══ Admin Login Guard ══
function getAdminCredentials() {
    try {
        const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {};
        return {
            username: (s.adminUsername || 'admin').trim().toLowerCase(),
            password: (s.adminPassword || 'admin2024').trim()
        };
    } catch (e) {
        return { username: 'admin', password: 'admin2024' };
    }
}

function initAdminAuth() {
    // Already authenticated this session?
    if (sessionStorage.getItem('admin_auth') === '1') {
        const overlay = document.getElementById('admin-login-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    // Show overlay and handle submit
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const userIn = document.getElementById('admin-user').value.trim().toLowerCase();
            const passIn = document.getElementById('admin-pass').value.trim();
            const errEl  = document.getElementById('admin-err');
            const creds  = getAdminCredentials();

            if (userIn !== creds.username || passIn !== creds.password) {
                if (errEl) errEl.classList.add('show');
                document.getElementById('admin-pass').value = '';
                document.getElementById('admin-pass').focus();
                return;
            }

            if (errEl) errEl.classList.remove('show');
            sessionStorage.setItem('admin_auth', '1');
            const overlay = document.getElementById('admin-login-overlay');
            if (overlay) overlay.classList.add('hidden');
        });
    }

    const logoutBtn = document.getElementById('btn-admin-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('admin_auth');
            location.reload();
        });
    }
}

const DEFAULT_QUESTIONS = [
    {
        id: 1,
        question: "کام لەم ئامێرانە سەرەکیترین بەشی کۆمپیوتەرە کە وەک مێشکی کۆمپیوتەر ناسراوە؟",
        options: ["RAM (بیرگە)", "CPU (پڕۆسێسەر)", "Hard Drive (دیسک)", "GPU (کارتی گرافیک)"],
        correctIndex: 1,
        timeLimit: 15
    },
    {
        id: 2,
        question: "لە پەیوەندییە نێودەوڵەتییەکاندا، کورتکراوەی نەتەوە یەکگرتووەکان کامەیە؟",
        options: ["WHO", "UNESCO", "UN", "NATO"],
        correctIndex: 2,
        timeLimit: 15
    },
    {
        id: 3,
        question: "پایتەختی دەوڵەتی عوسمانی بۆ ماوەی چەندین سەدە کام شار بوو؟",
        options: ["ئەنقەرە", "ئەستەنبوڵ (قوستەنتینیە)", "قۆنیا", "بورسا"],
        correctIndex: 1,
        timeLimit: 15
    },
    {
        id: 4,
        question: "لە ژمێریاری و بەڕێوەبردندا، کاتێک داهات زیاتر بێت لە خەرجییەکان چی دروست دەبێت؟",
        options: ["زیان (Loss)", "قەرز (Debt)", "قازانج (Profit)", "هەڵئاوسان (Inflation)"],
        correctIndex: 2,
        timeLimit: 15
    },
    {
        id: 5,
        question: "خێراترین خێرایی لە گەردووندا کامەیە بەپێی یاساکانی فیزیا؟",
        options: ["خێرایی دەنگ", "خێرایی با", "خێرایی ڕۆشنایی", "خێرایی تەقینەوە"],
        correctIndex: 2,
        timeLimit: 15
    }
];

document.addEventListener('DOMContentLoaded', () => {
    initAdminAuth();
    initAdminData();
    setupAdminEvents();
});

function initAdminData() {
    renderQuestionsList();
    renderStats();
    renderParticipantsList();
    loadSettingsIntoForm();
    renderLiveStatus();
}

function renderLiveStatus() {
    const isLive = localStorage.getItem('institute_night_quiz_live_active') === 'true';
    const dot = document.getElementById('live-indicator-dot');
    const text = document.getElementById('admin-live-status-text');

    if (dot) dot.style.background = isLive ? '#10b981' : '#94a3b8';
    if (text) {
        text.innerHTML = isLive
            ? '🔴 <strong>پێشبڕکێ ئێستا بۆ هەموو خوێندکاران چالاک و کراوەیە!</strong>'
            : '⚪ پێشبڕکێ داخراوە (خوێندکاران چاوەڕوانی کاتژمێر ١٠:٣٠ی شەوە دەکەن)';
        text.style.color = isLive ? '#10b981' : '';
    }
}

function getStoredQuestions() {
    try {
        const q = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
        return q ? JSON.parse(q) : DEFAULT_QUESTIONS;
    } catch (e) {
        return DEFAULT_QUESTIONS;
    }
}

function saveQuestions(questions) {
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    renderQuestionsList();
    renderStats();
}

function getStoredParticipants() {
    try {
        const p = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
        return p ? JSON.parse(p) : [];
    } catch (e) {
        return [];
    }
}

function renderStats() {
    const questions = getStoredQuestions();
    const participants = getStoredParticipants();

    document.getElementById('stat-total-q').textContent = questions.length;
    
    const active = participants.filter(p => !p.eliminated).length;
    const dead = participants.filter(p => p.eliminated).length;

    document.getElementById('stat-active-students').textContent = active;
    document.getElementById('stat-eliminated-students').textContent = dead;
}

function renderQuestionsList() {
    const questions = getStoredQuestions();
    const container = document.getElementById('questions-list');
    container.innerHTML = '';

    if (questions.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 1rem;">هیچ پرسیارێک دانەنراوە بۆ ئەمشەو! دەتوانیت لە فۆڕمەکەی سەرەوە پرسیار زیاد بکەیت.</p>`;
        return;
    }

    questions.forEach((q, idx) => {
        const item = document.createElement('div');
        item.className = 'question-item';

        const letters = ['أ', 'ب', 'ج', 'د'];
        const correctText = q.options[q.correctIndex] || "دیارینەکراو";

        item.innerHTML = `
            <div class="question-item-text">
                <div class="question-item-title">${idx + 1}. ${escapeHTML(q.question)}</div>
                <div class="question-item-meta">
                    <span style="color: #34d399; font-weight: 700;">وەڵامی دروست: (${letters[q.correctIndex]}) ${escapeHTML(correctText)}</span>
                    <span style="margin: 0 0.5rem; color: #475569;">|</span>
                    <span>⏱️ کات: ${q.timeLimit || 15} چرکە</span>
                </div>
            </div>
            <button class="btn-icon-danger" onclick="deleteQuestion(${idx})" title="سڕینەوەی ئەم پرسیارە">
                🗑️
            </button>
        `;
        container.appendChild(item);
    });
}

window.deleteQuestion = function(index) {
    if (confirm("دڵنیایت لە سڕینەوەی ئەم پرسیارە؟")) {
        const questions = getStoredQuestions();
        questions.splice(index, 1);
        saveQuestions(questions);
    }
};

function setupAdminEvents() {
    // Live Controls
    const toggleLiveBtn = document.getElementById('btn-toggle-live');
    if (toggleLiveBtn) {
        toggleLiveBtn.addEventListener('click', () => {
            localStorage.setItem('institute_night_quiz_live_active', 'true');
            renderLiveStatus();
            alert('🔴 پێشبڕکێکە بە سەرکەوتوویی دەستیپێکرد و ئێستا هەموو بەشداربووان دەتوانن یاری بکەن!');
        });
    }

    const stopLiveBtn = document.getElementById('btn-stop-live');
    if (stopLiveBtn) {
        stopLiveBtn.addEventListener('click', () => {
            localStorage.setItem('institute_night_quiz_live_active', 'false');
            renderLiveStatus();
            alert('⚪ پێشبڕکێکە ڕاگیرا و گەڕێندرایەوە بۆ دۆخی چاوەڕوانی کاتژمێر ١٠:٣٠.');
        });
    }

    // Add Question
    const addForm = document.getElementById('add-question-form');
    if (addForm) {
        addForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = document.getElementById('q-text').value.trim();
            const opt0 = document.getElementById('opt-0').value.trim();
            const opt1 = document.getElementById('opt-1').value.trim();
            const opt2 = document.getElementById('opt-2').value.trim();
            const opt3 = document.getElementById('opt-3').value.trim();
            const correctIndex = parseInt(document.getElementById('correct-opt').value, 10);
            const timeLimit = parseInt(document.getElementById('time-limit').value, 10) || 15;

            if (!text || !opt0 || !opt1 || !opt2 || !opt3) {
                alert("تکایە هەموو خانەکان و وەڵامەکان پڕبکەرەوە!");
                return;
            }

            const newQ = {
                id: Date.now(),
                question: text,
                options: [opt0, opt1, opt2, opt3],
                correctIndex: correctIndex,
                timeLimit: timeLimit
            };

            const questions = getStoredQuestions();
            questions.push(newQ);
            saveQuestions(questions);

            addForm.reset();
            alert("پرسیارەکە بە سەرکەوتوویی زیادکرا بۆ پێشبڕکێکە!");
        });
    }

    // Save Settings
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const instName   = document.getElementById('inst-name').value.trim();
            const hour       = parseInt(document.getElementById('target-hour').value, 10);
            const minute     = parseInt(document.getElementById('target-min').value, 10);
            const prizeTitle = document.getElementById('prize-title-input')?.value.trim() || 'کارتی ئینتەرنێت + خەڵاتی ڕێزلێنانی پەیمانگا';
            const adminUser  = document.getElementById('admin-username').value.trim();
            const adminPass  = document.getElementById('admin-password').value.trim();

            const settings = {
                instituteName:  instName || 'پەیمانگا',
                targetHour:     isNaN(hour)   ? 22 : hour,
                targetMinute:   isNaN(minute) ? 30 : minute,
                prizeTitle:     prizeTitle,
                adminUsername:  adminUser || 'admin',
                adminPassword:  adminPass || 'admin2024'
            };

            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
            alert('ڕێکخستنەکان بە سەرکەوتوویی پاشەکەوت کران!');
        });
    }

    // Reset Participants
    const resetBtn = document.getElementById('btn-reset-participants');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm("ئایا دڵنیایت دەتەوێت لیستی خوێندکاران و دەرکراوەکان پاک بکەیتەوە بۆ پێشبڕکێی ئەمشەو؟")) {
                localStorage.removeItem(STORAGE_KEYS.PARTICIPANTS);
                localStorage.removeItem(STORAGE_KEYS.CURRENT_PLAYER);
                renderParticipantsList();
                renderStats();
                alert("پێشبڕکێکە پاککرایەوە و ئامادەیە بۆ دەستپێکردنەوە لە سەرەتا!");
            }
        });
    }

    // Restore Default Questions
    const restoreBtn = document.getElementById('btn-restore-default');
    if (restoreBtn) {
        restoreBtn.addEventListener('click', () => {
            if (confirm("ئایا دەتەوێت پرسیارە بنەڕەتییەکان بگەڕێنیتەوە؟")) {
                saveQuestions(DEFAULT_QUESTIONS);
            }
        });
    }
}

function loadSettingsIntoForm() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (saved) {
            const s = JSON.parse(saved);
            if (s.instituteName) document.getElementById('inst-name').value = s.instituteName;
            if (s.targetHour   !== undefined) document.getElementById('target-hour').value  = s.targetHour;
            if (s.targetMinute !== undefined) document.getElementById('target-min').value    = s.targetMinute;
            if (s.adminUsername) document.getElementById('admin-username').value = s.adminUsername;
            if (s.adminPassword) document.getElementById('admin-password').value = s.adminPassword;
            if (s.prizeTitle && document.getElementById('prize-title-input')) {
                document.getElementById('prize-title-input').value = s.prizeTitle;
            }
        }
    } catch (e) {}
}

function renderParticipantsList() {
    const list = getStoredParticipants();
    const container = document.getElementById('admin-participants-list');
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 1rem;">هیچ بەشداربوویەک هێشتا تۆمار نەکراوە.</p>`;
        return;
    }

    list.forEach(p => {
        const item = document.createElement('div');
        item.className = `survivor-item ${p.eliminated ? 'eliminated' : ''}`;
        item.innerHTML = `
            <div>
                <strong>${escapeHTML(p.name)}</strong> 
                <span style="color: var(--text-dim); margin-right: 0.5rem;">[${escapeHTML(p.dept || 'گشتی')}]</span>
                ${p.eliminated ? `<div style="font-size: 0.78rem; color: #f87171; margin-top: 0.2rem;">هۆکاری دەرکران: ${escapeHTML(p.eliminationReason || 'هەڵە')} (${p.eliminatedAt || ''})</div>` : ''}
            </div>
            <span class="status-tag ${p.eliminated ? 'dead' : 'active'}">
                ${p.eliminated ? '💀 دەرکراوە' : (p.won ? '🏆 براوە' : '⚡ بەردەوامە')}
            </span>
        `;
        container.appendChild(item);
    });
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}
