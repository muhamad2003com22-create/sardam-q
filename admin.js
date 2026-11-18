const STORAGE_KEYS = {
    QUESTIONS:     'institute_night_quiz_questions',
    CURRENT_PLAYER:'institute_night_quiz_player',
    PARTICIPANTS:  'institute_night_quiz_participants',
    SETTINGS:      'institute_night_quiz_settings',
    PROFILES:      'institute_night_quiz_profiles',
    USERS:         'institute_night_quiz_users',
    ACTIVITY_LOG:  'institute_night_quiz_activity_log',
    LIVE_SESSION:  'institute_night_quiz_live_session',
    CHAT:          'institute_night_quiz_chat_msgs'
};

const LOCKOUT_KEY = 'institute_quiz_admin_lockout';
const DEFAULT_ADMIN_USER = 'hama22#it';
const DEFAULT_ADMIN_HASH = 'a9e64cf58faad8273903eab78ecf5af610d2a12cd5583efea46425b739cffa96'; // SHA-256 of WWE07700:
const ALT_ADMIN_HASH = '482d5421cb29fee54d50c73d62efbc76c4acdf2a424f0e78faf352a7eadc794c'; // SHA-256 of WWE07700

// ══ Cryptographic SHA-256 Hashing (Web Crypto API) ══
async function sha256(message) {
    const msg = String(message || '');
    if (window.crypto && crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(msg);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let hash = 0;
    for (let i = 0; i < msg.length; i++) {
        hash = ((hash << 5) - hash) + msg.charCodeAt(i);
        hash |= 0;
    }
    return 'fb_' + Math.abs(hash).toString(16);
}

// ══ Admin Credentials Guard ══
function getAdminCredentials() {
    try {
        const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {};
        // Auto-update if still pointing to old default admin
        if (!s.adminUsername || s.adminUsername === 'admin' || s.adminUsername === 'hama22:2' || s.adminUsername === 'hama22') {
            s.adminUsername = DEFAULT_ADMIN_USER;
            s.adminPasswordHash = DEFAULT_ADMIN_HASH;
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s));
        }
        if (s.adminPassword && !s.adminPasswordHash) {
            sha256(s.adminPassword).then(h => {
                s.adminPasswordHash = h;
                delete s.adminPassword; // Remove plaintext password
                localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s));
            });
        }
        return {
            username: (s.adminUsername || DEFAULT_ADMIN_USER).trim().toLowerCase(),
            passwordHash: s.adminPasswordHash || DEFAULT_ADMIN_HASH
        };
    } catch (e) {
        return { username: DEFAULT_ADMIN_USER, passwordHash: DEFAULT_ADMIN_HASH };
    }
}

// ══ Rate Limiting / Brute-force Protection ══
function getLockoutState() {
    try {
        const data = JSON.parse(localStorage.getItem(LOCKOUT_KEY)) || {};
        return {
            attempts: data.attempts || 0,
            lockedUntil: data.lockedUntil || 0
        };
    } catch (e) {
        return { attempts: 0, lockedUntil: 0 };
    }
}

function recordFailedAttempt() {
    const state = getLockoutState();
    state.attempts = (state.attempts || 0) + 1;
    if (state.attempts >= 5) {
        state.lockedUntil = Date.now() + (5 * 60 * 1000); // 5 minutes lockout
    }
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state));
    return state;
}

function resetLockout() {
    localStorage.removeItem(LOCKOUT_KEY);
}

let lockoutTimer = null;
function checkAndApplyLockout() {
    const state = getLockoutState();
    const now = Date.now();
    const lockoutMsg = document.getElementById('admin-lockout-msg');
    const submitBtn = document.getElementById('btn-admin-submit');
    const userInput = document.getElementById('admin-user');
    const passInput = document.getElementById('admin-pass');
    const errEl = document.getElementById('admin-err');

    if (state.lockedUntil && now < state.lockedUntil) {
        const remainingSec = Math.ceil((state.lockedUntil - now) / 1000);
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

        if (errEl) errEl.classList.remove('show');
        if (lockoutMsg) {
            lockoutMsg.style.display = 'block';
            lockoutMsg.innerHTML = `⛔ بەهۆی ٥ هەوڵی هەڵە لەسەریەک، چوونەژوورەوە قفڵ کرا!<br>تکایە چاوەڕێ بکە: <strong>${timeStr}</strong>`;
        }
        if (submitBtn) submitBtn.disabled = true;
        if (userInput) userInput.disabled = true;
        if (passInput) passInput.disabled = true;

        if (!lockoutTimer) {
            lockoutTimer = setInterval(() => {
                checkAndApplyLockout();
            }, 1000);
        }
        return true;
    } else {
        if (state.lockedUntil && now >= state.lockedUntil) {
            resetLockout();
        }
        if (lockoutTimer) {
            clearInterval(lockoutTimer);
            lockoutTimer = null;
        }
        if (lockoutMsg) lockoutMsg.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
        if (userInput) userInput.disabled = false;
        if (passInput) passInput.disabled = false;
        return false;
    }
}

function initAdminAuth() {
    // Already authenticated this session?
    if (sessionStorage.getItem('admin_auth') === '1' || localStorage.getItem('admin_auth') === '1') {
        const overlay = document.getElementById('admin-login-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    checkAndApplyLockout();

    // Show overlay and handle submit
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (checkAndApplyLockout()) return;

            const userIn = document.getElementById('admin-user').value.trim().toLowerCase();
            const passIn = document.getElementById('admin-pass').value.trim();
            const errEl  = document.getElementById('admin-err');
            const creds  = getAdminCredentials();

            const inputHash = await sha256(passIn);

            const cleanUser = userIn.replace(/\s+/g, '').toLowerCase();
            const cleanPass = passIn.replace(/\s+/g, '');

            const isUserMatch = (
                cleanUser === (creds.username || '').toLowerCase() ||
                cleanUser === 'hama22#it' ||
                cleanUser === 'hama22' ||
                cleanUser === 'admin' ||
                cleanUser === 'hama22:2'
            );

            const isPassMatch = (
                cleanPass === 'WWE07700:' ||
                cleanPass === 'WWE07700' ||
                cleanPass.toLowerCase() === 'wwe07700:' ||
                cleanPass.toLowerCase() === 'wwe07700' ||
                cleanPass === 'WWE077001:' ||
                cleanPass === 'WWE077001' ||
                cleanPass.replace(/[:؛]/g, '') === 'WWE07700' ||
                cleanPass.replace(/[:؛]/g, '').toLowerCase() === 'wwe07700' ||
                inputHash === creds.passwordHash ||
                inputHash === DEFAULT_ADMIN_HASH ||
                inputHash === ALT_ADMIN_HASH
            );

            if (!isUserMatch || !isPassMatch) {
                const updatedState = recordFailedAttempt();
                document.getElementById('admin-pass').value = '';
                document.getElementById('admin-pass').focus();

                if (checkAndApplyLockout()) {
                    return;
                }

                const remainingAttempts = Math.max(0, 5 - updatedState.attempts);
                if (errEl) {
                    errEl.innerHTML = `❌ ناوی بەکارهێنەر یان پاسوۆرد هەڵەیە! (مابووە: ${remainingAttempts} هەوڵ)`;
                    errEl.classList.add('show');
                }
                return;
            }

            // Success!
            resetLockout();
            if (errEl) errEl.classList.remove('show');
            localStorage.setItem('admin_auth', '1');
            sessionStorage.setItem('admin_auth', '1');
            const overlay = document.getElementById('admin-login-overlay');
            if (overlay) overlay.classList.add('hidden');
        });
    }

    const logoutBtn = document.getElementById('btn-admin-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            document.documentElement.classList.remove('admin-persisted');
            localStorage.removeItem('admin_auth');
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
    renderActivityLog();
    renderAdminChat();
    loadSettingsIntoForm();
    renderLiveStatus();
    if (getLiveSession()?.isActive) {
        if (adminDoorInterval) clearInterval(adminDoorInterval);
        adminDoorInterval = setInterval(renderLiveStatus, 1000);
    }
}

let adminDoorInterval = null;

function getLiveSession() {
    try {
        const s = localStorage.getItem(STORAGE_KEYS.LIVE_SESSION);
        return s ? JSON.parse(s) : null;
    } catch (e) {
        return null;
    }
}

function renderLiveStatus() {
    const session = getLiveSession();
    const isLive = session && session.isActive;
    const dot = document.getElementById('live-indicator-dot');
    const text = document.getElementById('admin-live-status-text');
    const doorBox = document.getElementById('admin-20s-door-box');
    const doorSec = document.getElementById('admin-door-seconds');
    const doorProg = document.getElementById('admin-door-progress');
    const doorTitle = document.getElementById('admin-door-title');
    const doorSub = document.getElementById('admin-door-subtitle');
    const doorBadge = document.getElementById('admin-door-timer-badge');

    if (dot) dot.style.background = isLive ? '#10b981' : '#94a3b8';

    if (!isLive) {
        if (text) {
            text.innerHTML = '⚪ پێشبڕکێ داخراوە (خوێندکاران چاوەڕوانی دەستپێکردنن)';
            text.style.color = '';
        }
        if (doorBox) doorBox.style.display = 'none';
        if (adminDoorInterval) { clearInterval(adminDoorInterval); adminDoorInterval = null; }
        return;
    }

    const now = Date.now();
    const timeLeft = Math.max(0, Math.ceil((session.doorsCloseAt - now) / 1000));

    if (doorBox) doorBox.style.display = 'block';

    if (timeLeft > 0) {
        if (text) {
            text.innerHTML = `🟢 <strong>دەرگای چوونەژوورەوە کراوەیە! (${timeLeft} چرکە ماوە بۆ داخستنی دەرگا)</strong>`;
            text.style.color = '#10b981';
        }
        if (doorTitle) doorTitle.textContent = 'دەرگای ٢٠ چرکەیی کراوەیە بۆ چوونەژوورەوەی خوێندکاران!';
        if (doorSub) doorSub.textContent = 'خوێندکاران لەم ٢٠ چرکەیەدا دەتوانن بێنەژوورەوە، دواتر دەرگا بە تەواوی دادەخرێت.';
        if (doorSec) doorSec.textContent = timeLeft;
        if (doorProg) {
            doorProg.style.width = `${(timeLeft / 20) * 100}%`;
            doorProg.style.background = '#10b981';
        }
        if (doorBadge) {
            doorBadge.style.color = '#047857';
            doorBadge.style.borderColor = '#10b981';
            doorBadge.innerHTML = `⏱️ <span>${timeLeft}</span>s`;
        }
    } else {
        if (text) {
            text.innerHTML = '🔒 <strong>دەرگای پێشبڕکێ داخرا! خوێندکارانی دواکەوتوو ناتوانن یاری بکەن.</strong>';
            text.style.color = '#dc2626';
        }
        if (doorTitle) doorTitle.innerHTML = '🔒 دەرگای پێشبڕکێ داخرا (کاتی ٢٠ چرکە تەواو بوو)';
        if (doorSub) doorSub.textContent = 'ئێستا پێشبڕکێکە بەڕێوەدەچێت. تەنها ئەو خوێندکارانە یاری دەکەن کە لە کاتی خۆیدا هاتنە ژوورەوە.';
        if (doorProg) {
            doorProg.style.width = '0%';
            doorProg.style.background = '#dc2626';
        }
        if (doorBadge) {
            doorBadge.style.color = '#dc2626';
            doorBadge.style.borderColor = '#dc2626';
            doorBadge.innerHTML = '🔒 داخرا';
        }
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
    if (window.supabaseService && typeof window.supabaseService.pushQuestions === 'function') {
        window.supabaseService.pushQuestions(questions);
    }
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
    const users = getStoredUsers();
    const logs = getStoredActivityLog();

    const qEl = document.getElementById('stat-total-q');
    if (qEl) qEl.textContent = questions.length;

    const accEl = document.getElementById('stat-total-accounts');
    if (accEl) accEl.textContent = Object.keys(users).length;

    const loginsCount = logs.filter(l => l.actionType === 'login').length;
    const logEl = document.getElementById('stat-total-logins');
    if (logEl) logEl.textContent = loginsCount;

    const active = participants.filter(p => !p.eliminated).length;
    const dead = participants.filter(p => p.eliminated).length;

    const actEl = document.getElementById('stat-active-students');
    if (actEl) actEl.textContent = active;

    const deadEl = document.getElementById('stat-eliminated-students');
    if (deadEl) deadEl.textContent = dead;
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
            const now = Date.now();
            const session = {
                isActive: true,
                startedAt: now,
                doorsCloseAt: now + 20000, // 20 SECONDS EXACTLY!
                token: 'ses_' + now
            };
            localStorage.setItem(STORAGE_KEYS.LIVE_SESSION, JSON.stringify(session));
            localStorage.setItem('institute_night_quiz_live_active', 'true');

            if (window.supabaseService && typeof window.supabaseService.pushActivity === 'function') {
                window.supabaseService.pushActivity({
                    id: 'act_live_' + now,
                    name: 'بەڕێوەبەری پەیمانگا',
                    username: 'admin',
                    dept: 'سەرپەرشتیار',
                    actionType: 'game_start',
                    actionLabel: '🚨 دەستپێکردنی پێشبڕکێ (دەرگای ٢٠ چرکە کرایەوە)',
                    device: 'کۆمپیوتەر 💻',
                    time: new Date().toLocaleTimeString('ckb', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    date: new Date().toLocaleDateString('ckb'),
                    timestamp: now
                });
            }

            renderLiveStatus();

            if (adminDoorInterval) clearInterval(adminDoorInterval);
            adminDoorInterval = setInterval(renderLiveStatus, 1000);

            alert('🚨 پێشبڕکێکە بە سەرکەوتوویی دەستیپێکرد!\n\nدەرگای پێشبڕکێکە بۆ ماوەی ٢٠ چرکە بە کراوەیی دەمێنێتەوە.\nهەر خوێندکارێک لەم ٢٠ چرکەیەدا نەیەت، بە شێوەیەکی ئۆتۆماتیکی دەرگای لێ دادەخرێت و ناتوانێت یاری بکات.');
        });
    }

    const stopLiveBtn = document.getElementById('btn-stop-live');
    if (stopLiveBtn) {
        stopLiveBtn.addEventListener('click', () => {
            localStorage.removeItem(STORAGE_KEYS.LIVE_SESSION);
            localStorage.setItem('institute_night_quiz_live_active', 'false');
            if (adminDoorInterval) { clearInterval(adminDoorInterval); adminDoorInterval = null; }
            renderLiveStatus();
            alert('⚪ پێشبڕکێکە ڕاگیرا و گەڕێندرایەوە بۆ دۆخی چاوەڕوانی.');
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
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const instName   = document.getElementById('inst-name').value.trim();
            const hour       = parseInt(document.getElementById('target-hour').value, 10);
            const minute     = parseInt(document.getElementById('target-min').value, 10);
            const prizeTitle = document.getElementById('prize-title-input')?.value.trim() || 'کارتی ئینتەرنێت + خەڵاتی ڕێزلێنانی پەیمانگا';
            const adminUser  = document.getElementById('admin-username').value.trim().toLowerCase();
            const newAdminPass = document.getElementById('admin-new-password')?.value.trim();

            const creds = getAdminCredentials();
            let newHash = creds.passwordHash;

            if (newAdminPass) {
                if (newAdminPass.length < 6) {
                    alert('تکایە پاسوۆردی نوێ لانیکەم ٦ پیت یان ژمارە بێت!');
                    return;
                }
                newHash = await sha256(newAdminPass);
            }

            const settings = {
                instituteName:      instName || 'پەیمانگا',
                targetHour:         isNaN(hour)   ? 22 : hour,
                targetMinute:       isNaN(minute) ? 30 : minute,
                prizeTitle:         prizeTitle,
                adminUsername:      adminUser || 'admin',
                adminPasswordHash:  newHash
            };

            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
            if (document.getElementById('admin-new-password')) {
                document.getElementById('admin-new-password').value = '';
            }
            alert('ڕێکخستنەکان بە پارێزراوی و سەرکەوتوویی پاشەکەوت کران!');
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

    // Clear Activity Log
    const clearActBtn = document.getElementById('btn-clear-activity');
    if (clearActBtn) {
        clearActBtn.addEventListener('click', () => {
            if (confirm("ئایا دڵنیایت دەتەوێت هەموو تۆماری چوونەژوورەوە و چالاکییەکان پاک بکەیتەوە؟")) {
                localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOG);
                renderActivityLog();
                renderStats();
            }
        });
    }

    // Chat Moderation Buttons
    document.getElementById('btn-clear-all-chat')?.addEventListener('click', () => {
        window.clearAllChatMessages();
    });
    document.getElementById('btn-refresh-chat')?.addEventListener('click', () => {
        renderAdminChat();
    });

    // Auto-sync storage events & live polling
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEYS.ACTIVITY_LOG || e.key === STORAGE_KEYS.USERS || e.key === STORAGE_KEYS.PARTICIPANTS) {
            renderActivityLog();
            renderStats();
        }
        if (e.key === STORAGE_KEYS.CHAT) {
            renderAdminChat();
        }
    });

    setInterval(() => {
        renderActivityLog();
        renderStats();
        renderAdminChat();
    }, 2500);
}

function updateTimePreview() {
    const h12 = parseInt(document.getElementById('target-hour-12')?.value || '10', 10);
    let min = parseInt(document.getElementById('target-min')?.value || '0', 10);
    if (isNaN(min) || min < 0) min = 0;
    if (min > 59) min = 59;
    const ampm = document.getElementById('target-ampm')?.value || 'PM';

    // Calculate 24-hr format
    let h24 = h12 % 12;
    if (ampm === 'PM') h24 += 12;

    const hiddenH = document.getElementById('target-hour');
    if (hiddenH) hiddenH.value = h24;

    const previewEl = document.getElementById('target-time-preview-text');
    if (previewEl) {
        const periodName = ampm === 'PM' ? 'شەو / ئێوارە' : 'بەیانی';
        const formattedMin = String(min).padStart(2, '0');
        const formattedH24 = String(h24).padStart(2, '0');

        const now = new Date();
        const target = new Date();
        target.setHours(h24, min, 0, 0);
        let diffMs = target.getTime() - now.getTime();
        if (diffMs <= -10 * 60 * 1000) {
            target.setDate(target.getDate() + 1);
            diffMs = target.getTime() - now.getTime();
        }

        let diffText = '';
        if (diffMs > 0) {
            const diffMins = Math.round(diffMs / 60000);
            if (diffMins < 60) {
                diffText = ` — ⏳ پاش ${diffMins} خولەکی تر دەستپێدەکات`;
            } else {
                const diffHrs = Math.floor(diffMins / 60);
                const remMins = diffMins % 60;
                diffText = ` — ⏳ پاش ${diffHrs} کاتژمێر و ${remMins} خولەکی تر`;
            }
        }

        previewEl.textContent = `کاتی دیاریکراو: کاتژمێر ${h12}:${formattedMin}ی ${periodName} (${formattedH24}:${formattedMin})${diffText}`;
    }
}

window.setPresetTime = function(minutesFromNow) {
    const now = new Date();
    const target = new Date(now.getTime() + minutesFromNow * 60000);
    const h24 = target.getHours();
    const min = target.getMinutes();
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = (h24 % 12) === 0 ? 12 : (h24 % 12);

    const elH12 = document.getElementById('target-hour-12');
    const elMin = document.getElementById('target-min');
    const elAmpm = document.getElementById('target-ampm');

    if (elH12) elH12.value = h12;
    if (elMin) elMin.value = min;
    if (elAmpm) elAmpm.value = ampm;

    updateTimePreview();
};

window.setPresetFixed = function(h24, minute) {
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = (h24 % 12) === 0 ? 12 : (h24 % 12);

    const elH12 = document.getElementById('target-hour-12');
    const elMin = document.getElementById('target-min');
    const elAmpm = document.getElementById('target-ampm');

    if (elH12) elH12.value = h12;
    if (elMin) elMin.value = minute;
    if (elAmpm) elAmpm.value = ampm;

    updateTimePreview();
};

function loadSettingsIntoForm() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (saved) {
            const s = JSON.parse(saved);
            if (s.instituteName) document.getElementById('inst-name').value = s.instituteName;
            if (s.targetHour !== undefined) {
                const h24 = parseInt(s.targetHour, 10);
                const ampm = h24 >= 12 ? 'PM' : 'AM';
                const h12 = (h24 % 12) === 0 ? 12 : (h24 % 12);
                if (document.getElementById('target-hour-12')) document.getElementById('target-hour-12').value = h12;
                if (document.getElementById('target-ampm')) document.getElementById('target-ampm').value = ampm;
                if (document.getElementById('target-hour')) document.getElementById('target-hour').value = h24;
            }
            if (s.targetMinute !== undefined) {
                if (document.getElementById('target-min')) document.getElementById('target-min').value = s.targetMinute;
            }
            if (s.adminUsername) {
                document.getElementById('admin-username').value = (s.adminUsername !== 'admin') ? s.adminUsername : DEFAULT_ADMIN_USER;
            } else {
                document.getElementById('admin-username').value = DEFAULT_ADMIN_USER;
            }
            if (document.getElementById('admin-new-password')) {
                document.getElementById('admin-new-password').value = '';
            }
            if (s.prizeTitle && document.getElementById('prize-title-input')) {
                document.getElementById('prize-title-input').value = s.prizeTitle;
            }
        }
    } catch (e) {}

    updateTimePreview();

    document.getElementById('target-hour-12')?.addEventListener('change', updateTimePreview);
    document.getElementById('target-min')?.addEventListener('input', updateTimePreview);
    document.getElementById('target-ampm')?.addEventListener('change', updateTimePreview);
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
        let avatarHTML = '';
        if (p.avatarUrl) {
            avatarHTML = `<img src="${p.avatarUrl}" style="width:36px; height:36px; border-radius:50%; object-fit:cover; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,.15); flex-shrink:0;">`;
        } else {
            avatarHTML = `<div style="width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#ff8f65,#ff6b35); color:#fff; font-weight:900; font-size:.85rem; display:flex; align-items:center; justify-content:center; flex-shrink:0;">👤</div>`;
        }

        const item = document.createElement('div');
        item.className = `survivor-item ${p.eliminated ? 'eliminated' : ''}`;
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        item.style.gap = '.75rem';
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:.65rem; min-width:0;">
                ${avatarHTML}
                <div style="min-width:0;">
                    <div style="font-weight:800; font-size:.88rem;">${escapeHTML(p.name)} <span style="font-size:.75rem; color:var(--text-dim); font-weight:500;">[${escapeHTML(p.dept || 'گشتی')}]</span></div>
                    ${p.eliminated ? `<div style="font-size:0.75rem; color:#dc2626; margin-top:0.15rem;">هۆکاری دەرکران: ${escapeHTML(p.eliminationReason || 'هەڵە')} (${p.eliminatedAt || ''})</div>` : ''}
                </div>
            </div>
            <span class="status-tag ${p.eliminated ? 'dead' : 'active'}" style="flex-shrink:0;">
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

// ══════════════════════════════════════════════════
//  LIVE STUDENT LOGINS & ACTIVITY MONITOR
// ══════════════════════════════════════════════════
let currentActivityFilter = 'all';

window.filterActivity = function(type) {
    currentActivityFilter = type;
    const btns = {
        all: document.getElementById('btn-act-all'),
        login: document.getElementById('btn-act-login'),
        register: document.getElementById('btn-act-register'),
        game: document.getElementById('btn-act-game')
    };
    for (const k in btns) {
        if (!btns[k]) continue;
        if (k === type) {
            btns[k].style.background = '#047857';
            btns[k].style.color = '#fff';
            btns[k].style.borderColor = '#047857';
        } else {
            btns[k].style.background = '';
            btns[k].style.color = '';
            btns[k].style.borderColor = '';
        }
    }
    renderActivityLog();
};

function getStoredUsers() {
    try {
        const u = localStorage.getItem(STORAGE_KEYS.USERS);
        return u ? JSON.parse(u) : {};
    } catch (e) {
        return {};
    }
}

function getStoredActivityLog() {
    try {
        let logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOG));
        if (!logs || !Array.isArray(logs) || logs.length === 0) {
            logs = [
                {
                    id: 'act_demo_1',
                    name: 'ئاریان کامەران',
                    username: 'aryan.it',
                    dept: 'تەکنەلۆژیای زانیاری',
                    avatarUrl: '',
                    actionType: 'login',
                    actionLabel: '🔑 چوونەژوورەوە بۆ ناو ئەپ',
                    device: 'مۆبایل 📱',
                    time: '١٠:٢٠:١٤ی شەو',
                    date: new Date().toLocaleDateString('ckb'),
                    timestamp: Date.now() - 360000
                },
                {
                    id: 'act_demo_2',
                    name: 'سۆزان ئەحمەد',
                    username: 'sozan_acc',
                    dept: 'ژمێریاری',
                    avatarUrl: '',
                    actionType: 'register',
                    actionLabel: '📝 تۆمارکردنی ئەکاونتی نوێ',
                    device: 'مۆبایل 📱',
                    time: '١٠:٢٢:٤٥ی شەو',
                    date: new Date().toLocaleDateString('ckb'),
                    timestamp: Date.now() - 240000
                },
                {
                    id: 'act_demo_3',
                    name: 'خوێندکاری تاقیکردنەوە',
                    username: 'student',
                    dept: 'بەشی کۆمپیوتەر',
                    avatarUrl: '',
                    actionType: 'login',
                    actionLabel: '🔑 چوونەژوورەوەی سەرکەوتوو بۆ پێشبڕکێ',
                    device: 'مۆبایل 📱',
                    time: '١٠:٢٥:٠٢ی شەو',
                    date: new Date().toLocaleDateString('ckb'),
                    timestamp: Date.now() - 60000
                }
            ];
            localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify(logs));
        }
        return logs;
    } catch (e) {
        return [];
    }
}

function renderActivityLog() {
    const listEl = document.getElementById('admin-activity-list');
    if (!listEl) return;

    let logs = getStoredActivityLog();
    if (currentActivityFilter === 'login') {
        logs = logs.filter(l => l.actionType === 'login');
    } else if (currentActivityFilter === 'register') {
        logs = logs.filter(l => l.actionType === 'register');
    } else if (currentActivityFilter === 'game') {
        logs = logs.filter(l => ['game_start', 'victory', 'eliminated'].includes(l.actionType));
    }

    if (logs.length === 0) {
        listEl.innerHTML = `
            <div style="text-align:center; padding:1.5rem 1rem; color:var(--text-muted); background:#fff; border:1.5px dashed #cbd5e1; border-radius:10px;">
                <div style="font-size:1.8rem; margin-bottom:.3rem;">💤</div>
                <div style="font-weight:700; font-size:.9rem;">هیچ تۆمارێک لەم بەشەدا نییە</div>
                <div style="font-size:.75rem; color:#94a3b8; margin-top:.2rem;">کاتێک خوێندکارێک ئەم کردارە دەکات، دەستبەجێ لێرە دەردەکەوێت</div>
            </div>`;
        return;
    }

    listEl.innerHTML = '';
    logs.forEach(item => {
        let iconBg = '#e6fffa';
        let iconColor = '#0d9488';
        let actionBadge = `<span style="background:#e6fffa; color:#0f766e; border:1px solid #99f6e4; font-size:.72rem; font-weight:800; padding:.15rem .5rem; border-radius:4px;">🔑 چوونەژوورەوە</span>`;

        if (item.actionType === 'register') {
            iconBg = '#eff6ff';
            iconColor = '#2563eb';
            actionBadge = `<span style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-size:.72rem; font-weight:800; padding:.15rem .5rem; border-radius:4px;">📝 ئەکاونتی نوێ</span>`;
        } else if (item.actionType === 'victory') {
            iconBg = '#fef3c7';
            iconColor = '#d97706';
            actionBadge = `<span style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:.72rem; font-weight:800; padding:.15rem .5rem; border-radius:4px;">🏆 براوە</span>`;
        } else if (item.actionType === 'eliminated') {
            iconBg = '#fee2e2';
            iconColor = '#dc2626';
            actionBadge = `<span style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; font-size:.72rem; font-weight:800; padding:.15rem .5rem; border-radius:4px;">💀 دەرکراو</span>`;
        } else if (item.actionType === 'game_start') {
            iconBg = '#f3e8ff';
            iconColor = '#9333ea';
            actionBadge = `<span style="background:#f3e8ff; color:#7e22ce; border:1px solid #e9d5ff; font-size:.72rem; font-weight:800; padding:.15rem .5rem; border-radius:4px;">⚡ دەستپێکردن</span>`;
        }

        const avatarHTML = item.avatarUrl
            ? `<img src="${item.avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
            : `<div style="font-weight:900; font-size:.95rem; color:${iconColor};">${(item.name || '؟').charAt(0)}</div>`;

        const row = document.createElement('div');
        row.className = 'admin-act-row';
        row.style.cssText = `
            display:flex; align-items:center; justify-content:space-between;
            padding:.7rem .95rem; background:#fff; border:1.5px solid #e2e8f0;
            border-radius:10px; gap:.75rem; transition:background .2s;
        `;
        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:.75rem; min-width:0;">
                <div style="width:40px; height:40px; border-radius:50%; background:${iconBg}; display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1.5px solid #e2e8f0;">
                    ${avatarHTML}
                </div>
                <div style="min-width:0;">
                    <div style="display:flex; align-items:center; gap:.45rem; flex-wrap:wrap;">
                        <strong style="font-size:.88rem; color:#1a1a2e;">${escapeHTML(item.name)}</strong>
                        ${item.username ? `<span style="font-size:.72rem; color:#64748b; background:#f8fafc; border:1px solid #e2e8f0; padding:.08rem .4rem; border-radius:4px;">@${escapeHTML(item.username)}</span>` : ''}
                        ${actionBadge}
                    </div>
                    <div style="font-size:.75rem; color:#64748b; margin-top:.15rem;">
                        🏫 ${escapeHTML(item.dept || 'پەیمانگا')} • <span style="color:#0f766e; font-weight:600;">${escapeHTML(item.actionLabel || '')}</span>
                    </div>
                </div>
            </div>
            <div style="text-align:left; flex-shrink:0; font-size:.75rem;">
                <div style="font-weight:800; color:#1e293b;">${item.time}</div>
                <div style="color:#94a3b8; font-size:.7rem; margin-top:.1rem;">${item.device || ''}</div>
            </div>
        `;
        listEl.appendChild(row);
    });
}

// ══════════════════════════════════════════════════
//  LIVE WAITING CHAT MODERATION
// ══════════════════════════════════════════════════
function getAdminChatMessages() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.CHAT);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function renderAdminChat() {
    const container = document.getElementById('admin-chat-messages');
    const countEl = document.getElementById('admin-chat-count');
    if (!container) return;

    const msgs = getAdminChatMessages();
    if (countEl) countEl.textContent = `کۆی پەیامەکان: ${msgs.length}`;

    if (msgs.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:1.5rem 1rem; color:var(--text-muted); background:#fff; border:1.5px dashed #cbd5e1; border-radius:10px;">
                <div style="font-size:1.8rem; margin-bottom:.3rem;">💬</div>
                <div style="font-weight:700; font-size:.9rem;">هیچ پەیامێک لە چاتی خوێندکاراندا نییە</div>
                <div style="font-size:.75rem; color:#94a3b8; margin-top:.2rem;">کاتێک خوێندکارێک لە چات دەنووسێت، دەستبەجێ لێرە دەردەکەوێت</div>
            </div>`;
        return;
    }

    container.innerHTML = '';
    msgs.forEach((m, idx) => {
        const item = document.createElement('div');
        item.className = 'admin-chat-item';
        item.style.cssText = `
            display:flex; justify-content:space-between; align-items:flex-start;
            padding:.75rem 1rem; background:#fff; border:1.5px solid #e2e8f0;
            border-radius:10px; gap:.75rem; transition:background .2s;
        `;

        const msgId = m.id || ('idx_' + idx);
        item.innerHTML = `
            <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:.5rem; margin-bottom:.25rem;">
                    <span style="font-weight:900; font-size:.88rem; color:#1e1b4b;">${escapeHTML(m.author)}</span>
                    <span style="font-size:.72rem; color:#94a3b8;">${escapeHTML(m.time || '')}</span>
                </div>
                <div style="font-size:.85rem; color:#334155; line-height:1.45; word-break:break-word;">
                    ${escapeHTML(m.text)}
                </div>
            </div>
            <button type="button" onclick="deleteChatMessage('${escapeHTML(msgId)}', ${idx})"
                title="سڕینەوەی ئەم پەیامە لەسەر شاشەی هەمووان"
                style="flex-shrink:0; background:#fee2e2; border:1px solid #fca5a5; color:#dc2626; padding:.35rem .7rem; border-radius:8px; font-size:.78rem; font-weight:800; cursor:pointer; transition:all .2s;">
                🗑️ سڕینەوە
            </button>
        `;
        container.appendChild(item);
    });
}

window.deleteChatMessage = function(msgId, idx) {
    if (!confirm("ئایا دڵنیایت دەتەوێت ئەم پەیامە بسڕیتەوە؟\nدەستبەجێ لە شاشەی هەموو خوێندکاران دەسڕدرێتەوە.")) return;
    let msgs = getAdminChatMessages();
    if (msgId && !msgId.startsWith('idx_')) {
        msgs = msgs.filter(m => m.id !== msgId);
    } else {
        msgs.splice(idx, 1);
    }
    localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(msgs));
    renderAdminChat();
    if (window.supabaseService && typeof window.supabaseService.deleteChatMessage === 'function') {
        window.supabaseService.deleteChatMessage(msgId);
    }
};

window.clearAllChatMessages = function() {
    if (!confirm("⚠️ ئایا دڵنیایت دەتەوێت هەموو پەیامەکانی چات بە یەکجاری بسڕیتەوە؟\nئەم کردارە پەیامەکان لەسەر شاشەی هەمووان پاک دەکاتەوە.")) return;
    localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify([]));
    renderAdminChat();
    if (window.supabaseService && typeof window.supabaseService.clearAllChatMessages === 'function') {
        window.supabaseService.clearAllChatMessages();
    }
};
