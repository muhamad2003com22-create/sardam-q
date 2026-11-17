// ══════════════════════════════════════════════════
//  پێشبڕکێی شەوانەی پەیمانگا — app.js
// ══════════════════════════════════════════════════

const STORAGE_KEYS = {
    QUESTIONS:     'institute_night_quiz_questions',
    CURRENT_PLAYER:'institute_night_quiz_player',
    PARTICIPANTS:  'institute_night_quiz_participants',
    SETTINGS:      'institute_night_quiz_settings',
    PROFILES:      'institute_night_quiz_profiles',
    USERS:         'institute_night_quiz_users'
};

const DEFAULT_QUESTIONS = [
    {
        id: 1,
        question: "کام لەم ئامێرانە سەرەکیترین بەشی کۆمپیوتەرە کە وەک مێشکی کۆمپیوتەر ناسراوە؟",
        options: ["RAM (بیرگە)", "CPU (پڕۆسێسەر)", "Hard Drive (دیسک)", "GPU (کارتی گرافیک)"],
        correctIndex: 1, timeLimit: 15
    },
    {
        id: 2,
        question: "لە پەیوەندییە نێودەوڵەتییەکاندا، کورتکراوەی نەتەوە یەکگرتووەکان کامەیە؟",
        options: ["WHO", "UNESCO", "UN", "NATO"],
        correctIndex: 2, timeLimit: 15
    },
    {
        id: 3,
        question: "پایتەختی دەوڵەتی عوسمانی بۆ ماوەی چەندین سەدە کام شار بوو؟",
        options: ["ئەنقەرە", "ئەستەنبوڵ (قوستەنتینیە)", "قۆنیا", "بورسا"],
        correctIndex: 1, timeLimit: 15
    },
    {
        id: 4,
        question: "لە ژمێریاری و بەڕێوەبردندا، کاتێک داهات زیاتر بێت لە خەرجییەکان چی دروست دەبێت؟",
        options: ["زیان (Loss)", "قەرز (Debt)", "قازانج (Profit)", "هەڵئاوسان (Inflation)"],
        correctIndex: 2, timeLimit: 15
    },
    {
        id: 5,
        question: "خێراترین خێرایی لە گەردووندا کامەیە بەپێی یاساکانی فیزیا؟",
        options: ["خێرایی دەنگ", "خێرایی با", "خێرایی ڕۆشنایی", "خێرایی تەقینەوە"],
        correctIndex: 2, timeLimit: 15
    }
];

// ── Ranks ──
const RANKS = [
    { min: 0,  label: 'تازەکار',    icon: '🌱', color: '#718096' },
    { min: 1,  label: 'ئامادە',     icon: '🥉', color: '#c05621' },
    { min: 3,  label: 'پیشەیی',    icon: '🥈', color: '#718096' },
    { min: 6,  label: 'کارکوێست',  icon: '🥇', color: '#d69e2e' },
    { min: 10, label: 'ئەفسانە',   icon: '🏆', color: '#ff6b35' },
    { min: 20, label: 'ئوستا',     icon: '👑', color: '#805ad5' }
];

function getRank(wins) {
    let r = RANKS[0];
    for (const rank of RANKS) {
        if ((wins || 0) >= rank.min) r = rank;
    }
    return r;
}

function getAvatarColor(name) {
    const colors = ['#ff6b35','#38a169','#3182ce','#805ad5','#d69e2e','#e53e3e','#319795'];
    let hash = 0;
    const str = name || 'Student';
    for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
    if (!name) return '؟';
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '؟';
    if (words.length === 1) return words[0].slice(0, 2);
    return (words[0][0] + words[1][0]).toUpperCase();
}

// ── State ──
let questions = [];
let currentQuestionIndex = 0;
let currentPlayer = null;
let questionTimer = null;
let timeLeft = 0;
let countdownInterval = null;
let isLiveForced = false;
let sessionCorrect = 0;
let sessionAnswered = 0;

// Lifelines state
let lifeline5050Used = false;
let lifelineTimeUsed = false;

const STORAGE_KEYS_EXTRA = {
    CHAT: 'institute_night_quiz_chat_msgs'
};

// ══════════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    loadQuestions();
    initSettings();
    initDefaultUsers();
    renderSurvivorsList();
    renderChatMessages();
    setupEventListeners();
    handleAuthGate();
    renderPrizeBanner();
});

// ══════════════════════════════════════════════════
//  USER ACCOUNTS & AUTH
// ══════════════════════════════════════════════════
function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || {};
    } catch (e) {
        return {};
    }
}

function saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function initDefaultUsers() {
    let users = getUsers();
    let changed = false;

    // Ensure student exists
    if (!users['student']) {
        users['student'] = {
            username: 'student',
            name: 'خوێندکاری تاقیکردنەوە',
            dept: 'بەشی کۆمپیوتەر',
            password: '123'
        };
        changed = true;
    }

    // Ensure admin is also a valid login if user types admin in student login
    if (!users['admin']) {
        users['admin'] = {
            username: 'admin',
            name: 'بەڕێوەبەری پەیمانگا',
            dept: 'بەڕێوەبەرایەتی',
            password: 'admin2024'
        };
        changed = true;
    }

    if (changed) {
        saveUsers(users);
    }
}

// ── Auth Gate Check ──
function handleAuthGate() {
    const session = sessionStorage.getItem('quiz_logged_in');
    const overlay = document.getElementById('auth-overlay');

    if (session) {
        try {
            const data = JSON.parse(session);
            currentPlayer = {
                id: data.id || Date.now(),
                name: data.name,
                username: data.username,
                dept: data.dept,
                joinedAt: data.joinedAt || new Date().toLocaleTimeString(),
                eliminated: false,
                score: 0
            };

            showWelcomeCard(data.name, data.dept);
            if (overlay) overlay.classList.add('hidden');

            const profileBtn = document.getElementById('btn-view-profile');
            if (profileBtn) profileBtn.style.display = 'inline-flex';

            checkExistingSession();
            initCountdownTimer();
            return;
        } catch (e) {
            sessionStorage.removeItem('quiz_logged_in');
        }
    }

    if (overlay) overlay.classList.remove('hidden');
    initCountdownTimer();
}

// ── Global Helper Functions ──
window.switchTab = function(tab) {
    const tabLogin  = document.getElementById('tab-login');
    const tabReg    = document.getElementById('tab-register');
    const panelLogin = document.getElementById('panel-login');
    const panelReg   = document.getElementById('panel-register');

    if (tab === 'login') {
        if (tabLogin) tabLogin.classList.add('active');
        if (tabReg) tabReg.classList.remove('active');
        if (panelLogin) panelLogin.classList.add('active');
        if (panelReg) panelReg.classList.remove('active');
    } else {
        if (tabLogin) tabLogin.classList.remove('active');
        if (tabReg) tabReg.classList.add('active');
        if (panelLogin) panelLogin.classList.remove('active');
        if (panelReg) panelReg.classList.add('active');
    }

    const errL = document.getElementById('login-err');
    const errR = document.getElementById('register-err');
    const okR  = document.getElementById('register-ok');
    if (errL) errL.classList.remove('show');
    if (errR) errR.classList.remove('show');
    if (okR)  okR.classList.remove('show');
};

window.togglePass = function(id, btn) {
    const input = document.getElementById(id);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
};

window.checkUsernameAvail = function(val) {
    const hint = document.getElementById('username-hint');
    if (!hint) return;
    const clean = val.trim().toLowerCase();
    if (!clean) {
        hint.textContent = 'بە ئینگلیزی، بەبێ فەراغ';
        hint.style.color = '#999';
        return;
    }
    const users = getUsers();
    if (users[clean]) {
        hint.textContent = '⚠️ ئەم ناوی بەکارهێنەرە پێشتر بەکارهاتووە!';
        hint.style.color = '#e53e3e';
    } else if (clean.length < 3) {
        hint.textContent = 'لانیکەم دەبێت ٣ پیت بێت';
        hint.style.color = '#d69e2e';
    } else {
        hint.textContent = '✅ بەردەستە';
        hint.style.color = '#38a169';
    }
};

window.updateStrength = function(val) {
    const bar  = document.getElementById('pass-bar');
    const hint = document.getElementById('pass-hint');
    if (!bar || !hint) return;

    if (!val) {
        bar.style.width = '0%';
        hint.textContent = 'لانیکەم ٦ پیت بنووسە';
        hint.style.color = '#999';
        return;
    }

    let score = 0;
    if (val.length >= 6) score += 40;
    if (/[0-9]/.test(val)) score += 30;
    if (/[a-zA-Z]/.test(val)) score += 30;

    bar.style.width = score + '%';
    if (score < 40) {
        bar.style.background = '#e53e3e';
        hint.textContent = 'لاوازە (کەمترە لە ٦ پیت)';
        hint.style.color = '#e53e3e';
    } else if (score < 80) {
        bar.style.background = '#d69e2e';
        hint.textContent = 'مامناوەندە';
        hint.style.color = '#d69e2e';
    } else {
        bar.style.background = '#38a169';
        hint.textContent = 'بەهێزە ✅';
        hint.style.color = '#38a169';
    }
};

window.logoutUser = function() {
    sessionStorage.removeItem('quiz_logged_in');
    localStorage.removeItem(STORAGE_KEYS.CURRENT_PLAYER);
    location.reload();
};

// ── Profile Helpers ──
function getAllProfiles() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES)) || {};
    } catch (e) {
        return {};
    }
}

function getProfile(nameOrUsername) {
    const all = getAllProfiles();
    const key = (nameOrUsername || '').trim().toLowerCase();
    return all[key] || null;
}

function upsertProfile(name, dept, updates = {}) {
    const all = getAllProfiles();
    const key = (name || '').trim().toLowerCase();
    const existing = all[key] || {
        name: name,
        dept: dept || '',
        firstJoined: new Date().toLocaleDateString('ckb'),
        totalGames: 0,
        wins: 0,
        eliminations: 0,
        totalCorrect: 0,
        totalAnswered: 0,
        lastPlayed: ''
    };
    if (dept) existing.dept = dept;
    Object.assign(existing, updates);
    all[key] = existing;
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(all));
    return existing;
}

window.openProfileModal = function(name) {
    const targetName = name || (currentPlayer ? currentPlayer.name : '');
    if (!targetName) return;

    let profile = getProfile(targetName);
    if (!profile) {
        profile = {
            name: targetName,
            dept: currentPlayer ? currentPlayer.dept : 'پەیمانگا',
            firstJoined: new Date().toLocaleDateString('ckb'),
            totalGames: 0,
            wins: 0,
            eliminations: 0,
            totalCorrect: 0,
            totalAnswered: 0
        };
    }

    const rank = getRank(profile.wins);
    const color = getAvatarColor(profile.name);
    const initials = getInitials(profile.name);
    const winRate = profile.totalGames > 0
        ? Math.round((profile.wins / profile.totalGames) * 100) : 0;
    const accuracy = profile.totalAnswered > 0
        ? Math.round((profile.totalCorrect / profile.totalAnswered) * 100) : 0;

    const historyKey = `quiz_history_${targetName.trim().toLowerCase()}`;
    let history = [];
    try { history = JSON.parse(localStorage.getItem(historyKey)) || []; } catch (e) {}

    const historyHTML = history.length === 0
        ? `<div style="text-align:center; color:var(--text-dim); padding:1rem; font-size:.85rem;">هێشتا هیچ یاریەک تۆمار نەکراوە</div>`
        : history.slice(0, 8).map(h => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:.55rem .75rem;
                background:${h.won ? '#f0fff4' : '#fff5f5'}; border:1px solid ${h.won ? '#c6f6d5' : '#fed7d7'};
                border-radius:8px; font-size:.8rem; gap:.5rem;">
                <div>
                    <span style="font-weight:700; color:${h.won ? '#276749' : '#c53030'};">${h.won ? '✅ براوە' : '❌ دەرکراوە'}</span>
                    <span style="color:var(--text-dim); margin-right:.5rem;">${h.date}</span>
                </div>
                <span style="font-weight:800; color:var(--text-muted);">${h.correctCount}/${h.totalQuestions} دروست</span>
            </div>`).join('');

    const isSelf = currentPlayer && currentPlayer.name.toLowerCase() === targetName.toLowerCase();

    const existingModal = document.getElementById('profile-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'profile-modal';
    modal.style.cssText = `
        position:fixed; inset:0; z-index:500;
        background:rgba(0,0,0,.45); backdrop-filter:blur(6px);
        display:flex; align-items:center; justify-content:center;
        padding:1rem;
    `;
    modal.innerHTML = `
        <div style="
            background:#fff; border-radius:24px; width:100%; max-width:460px;
            max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,.25);
            border:1.5px solid #e8e8f0; text-align:right;
        ">
            <div style="
                background:linear-gradient(135deg, ${color}22, ${color}11);
                border-bottom:1.5px solid ${color}33;
                padding:1.75rem 1.5rem 1.25rem; text-align:center; position:relative;
            ">
                <button onclick="document.getElementById('profile-modal').remove()"
                    style="position:absolute; top:1rem; left:1rem; background:rgba(0,0,0,.08);
                    border:none; width:34px; height:34px; border-radius:50%; cursor:pointer;
                    font-size:1.1rem; display:flex; align-items:center; justify-content:center;">✕</button>

                <div style="
                    width:76px; height:76px; border-radius:50%; margin:0 auto .9rem;
                    background:${color}; display:flex; align-items:center; justify-content:center;
                    font-size:1.8rem; font-weight:900; color:#fff;
                    border:4px solid #fff; box-shadow:0 6px 20px ${color}55;
                ">${initials}</div>

                <h2 style="font-size:1.25rem; font-weight:900; color:#1a1a2e; margin-bottom:.2rem;">${profile.name}</h2>
                <div style="font-size:.82rem; color:#666680; margin-bottom:.75rem;">${profile.dept || 'پەیمانگا'}</div>

                <div style="
                    display:inline-flex; align-items:center; gap:.4rem;
                    background:${rank.color}18; border:1.5px solid ${rank.color}44;
                    color:${rank.color}; padding:.3rem .9rem; border-radius:50px;
                    font-size:.85rem; font-weight:800;
                ">${rank.icon} ${rank.label}</div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:.6rem; padding:1.25rem 1.25rem .5rem;">
                <div style="background:#faf9f7; border:1.5px solid #e8e8f0; border-radius:12px; padding:.75rem .5rem; text-align:center;">
                    <div style="font-size:1.3rem;">🎮</div>
                    <div style="font-size:1.05rem; font-weight:900; color:#ff6b35; margin:.15rem 0;">${profile.totalGames}</div>
                    <div style="font-size:.7rem; color:#666680;">کۆی یاری</div>
                </div>
                <div style="background:#faf9f7; border:1.5px solid #e8e8f0; border-radius:12px; padding:.75rem .5rem; text-align:center;">
                    <div style="font-size:1.3rem;">🏆</div>
                    <div style="font-size:1.05rem; font-weight:900; color:#276749; margin:.15rem 0;">${profile.wins}</div>
                    <div style="font-size:.7rem; color:#666680;">براوە</div>
                </div>
                <div style="background:#faf9f7; border:1.5px solid #e8e8f0; border-radius:12px; padding:.75rem .5rem; text-align:center;">
                    <div style="font-size:1.3rem;">💀</div>
                    <div style="font-size:1.05rem; font-weight:900; color:#c53030; margin:.15rem 0;">${profile.eliminations}</div>
                    <div style="font-size:.7rem; color:#666680;">دەرکراوە</div>
                </div>
                <div style="background:#faf9f7; border:1.5px solid #e8e8f0; border-radius:12px; padding:.75rem .5rem; text-align:center;">
                    <div style="font-size:1.3rem;">⚡</div>
                    <div style="font-size:1.05rem; font-weight:900; color:#d69e2e; margin:.15rem 0;">${winRate}%</div>
                    <div style="font-size:.7rem; color:#666680;">ڕێژەی براوێتی</div>
                </div>
                <div style="background:#faf9f7; border:1.5px solid #e8e8f0; border-radius:12px; padding:.75rem .5rem; text-align:center;">
                    <div style="font-size:1.3rem;">🎯</div>
                    <div style="font-size:1.05rem; font-weight:900; color:#3182ce; margin:.15rem 0;">${accuracy}%</div>
                    <div style="font-size:.7rem; color:#666680;">وەڵامی دروست</div>
                </div>
                <div style="background:#faf9f7; border:1.5px solid #e8e8f0; border-radius:12px; padding:.75rem .5rem; text-align:center;">
                    <div style="font-size:1.3rem;">📅</div>
                    <div style="font-size:.9rem; font-weight:900; color:#805ad5; margin:.2rem 0;">${profile.firstJoined}</div>
                    <div style="font-size:.7rem; color:#666680;">بەشداری</div>
                </div>
            </div>

            <div style="padding:.5rem 1.25rem 1.5rem;">
                <div style="font-weight:800; font-size:.92rem; color:#1a1a2e; margin-bottom:.6rem;">
                    📋 مێژووی یاریەکان
                </div>
                <div style="display:flex; flex-direction:column; gap:.45rem; margin-bottom:1.25rem;">
                    ${historyHTML}
                </div>

                ${isSelf ? `
                <button onclick="window.logoutUser()" style="
                    width:100%; background:#fff5f5; border:1.5px solid #fed7d7;
                    color:#c53030; padding:.75rem; border-radius:10px;
                    font-size:.9rem; font-weight:800; cursor:pointer;
                ">🚪 دەرچوون لە ئەکاونت (Logout)</button>` : ''}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
};

function saveGameHistory(name, won, correctCount, totalQuestions) {
    const key = `quiz_history_${(name || '').trim().toLowerCase()}`;
    let history = [];
    try { history = JSON.parse(localStorage.getItem(key)) || []; } catch (e) {}
    history.unshift({
        won: won,
        correctCount: correctCount,
        totalQuestions: totalQuestions,
        date: new Date().toLocaleDateString('ckb')
    });
    if (history.length > 30) history = history.slice(0, 30);
    localStorage.setItem(key, JSON.stringify(history));
}

function showWelcomeCard(name, dept) {
    const profile = getProfile(name);
    const rank = profile ? getRank(profile.wins) : RANKS[0];
    const color = getAvatarColor(name);
    const initials = getInitials(name);

    const el = document.getElementById('welcome-name');
    const dl = document.getElementById('welcome-dept');
    const av = document.getElementById('welcome-avatar');
    const rk = document.getElementById('welcome-rank');

    if (el) el.textContent = name;
    if (dl) dl.textContent = dept || 'بەشداربوو بە پەیمانگا';
    if (av) {
        av.textContent = initials;
        av.style.background = color;
    }
    if (rk) {
        rk.textContent = `${rank.icon} ${rank.label}`;
        rk.style.color = rank.color;
        rk.style.borderColor = rank.color + '44';
        rk.style.background = rank.color + '18';
    }
}

// ── Setup Form Events ──
function setupEventListeners() {
    // 1. Login Form Submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const userInput = document.getElementById('l-username');
            const passInput = document.getElementById('l-password');
            const errEl     = document.getElementById('login-err');

            if (!userInput || !passInput) return;
            const u = userInput.value.trim().toLowerCase();
            const p = passInput.value.trim();

            const users = getUsers();
            const user = users[u];

            if (!user || user.password !== p) {
                if (errEl) {
                    errEl.textContent = '❌ ناوی بەکارهێنەر یان پاسوۆردەکە هەڵەیە!';
                    errEl.classList.add('show');
                }
                passInput.value = '';
                passInput.focus();
                return;
            }

            if (errEl) errEl.classList.remove('show');

            // Check if player with this name was eliminated in today's competition
            const participants = getParticipants();
            const existing = participants.find(part => part.name.toLowerCase() === user.name.toLowerCase() && part.eliminated);
            if (existing) {
                if (errEl) {
                    errEl.textContent = `❌ بەڕێز ${user.name}، لە پێشبڕکێی ئەمشەودا پێشتر دەرکراویت!`;
                    errEl.classList.add('show');
                }
                return;
            }

            currentPlayer = {
                id: Date.now(),
                name: user.name,
                username: user.username,
                dept: user.dept,
                joinedAt: new Date().toLocaleTimeString(),
                eliminated: false,
                score: 0
            };

            sessionStorage.setItem('quiz_logged_in', JSON.stringify(currentPlayer));
            savePlayer(currentPlayer);
            recordParticipant(currentPlayer);
            renderSurvivorsList();
            showWelcomeCard(user.name, user.dept);

            const overlay = document.getElementById('auth-overlay');
            if (overlay) overlay.classList.add('hidden');

            const profileBtn = document.getElementById('btn-view-profile');
            if (profileBtn) profileBtn.style.display = 'inline-flex';
        });
    }

    // 2. Register Form Submit
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameIn  = document.getElementById('r-name');
            const deptIn  = document.getElementById('r-dept');
            const userIn  = document.getElementById('r-username');
            const passIn  = document.getElementById('r-password');
            const passIn2 = document.getElementById('r-password2');
            const errEl   = document.getElementById('register-err');
            const okEl    = document.getElementById('register-ok');

            const name = nameIn ? nameIn.value.trim() : '';
            const dept = deptIn ? deptIn.value.trim() : 'پەیمانگا';
            const username = userIn ? userIn.value.trim().toLowerCase() : '';
            const pass = passIn ? passIn.value.trim() : '';
            const pass2 = passIn2 ? passIn2.value.trim() : '';

            if (errEl) errEl.classList.remove('show');
            if (okEl) okEl.classList.remove('show');

            if (!name || !username || !pass) {
                if (errEl) {
                    errEl.textContent = '❌ تکایە هەموو خانەکان پڕبکەرەوە!';
                    errEl.classList.add('show');
                }
                return;
            }

            if (username.length < 3) {
                if (errEl) {
                    errEl.textContent = '❌ ناوی بەکارهێنەر دەبێت لانیکەم ٣ پیت بێت!';
                    errEl.classList.add('show');
                }
                return;
            }

            if (pass.length < 4) {
                if (errEl) {
                    errEl.textContent = '❌ پاسوۆرد دەبێت لانیکەم ٤ پیت بێت!';
                    errEl.classList.add('show');
                }
                return;
            }

            if (pass !== pass2) {
                if (errEl) {
                    errEl.textContent = '❌ هەردوو پاسوۆردەکە یەکسان نین!';
                    errEl.classList.add('show');
                }
                return;
            }

            const users = getUsers();
            if (users[username]) {
                if (errEl) {
                    errEl.textContent = '❌ ئەم ناوی بەکارهێنەرە پێشتر تۆمار کراوە! تکایە ناوێکی تر هەڵبژێرە.';
                    errEl.classList.add('show');
                }
                return;
            }

            // Save user
            users[username] = {
                username: username,
                name: name,
                dept: dept,
                password: pass,
                createdAt: new Date().toLocaleDateString('ckb')
            };
            saveUsers(users);

            // Initialize profile
            upsertProfile(name, dept, {
                totalGames: 1,
                lastPlayed: new Date().toLocaleDateString('ckb')
            });

            // Automatically log them in!
            currentPlayer = {
                id: Date.now(),
                name: name,
                username: username,
                dept: dept,
                joinedAt: new Date().toLocaleTimeString(),
                eliminated: false,
                score: 0
            };

            sessionStorage.setItem('quiz_logged_in', JSON.stringify(currentPlayer));
            savePlayer(currentPlayer);
            recordParticipant(currentPlayer);
            renderSurvivorsList();
            showWelcomeCard(name, dept);

            const overlay = document.getElementById('auth-overlay');
            if (overlay) overlay.classList.add('hidden');

            const profileBtn = document.getElementById('btn-view-profile');
            if (profileBtn) profileBtn.style.display = 'inline-flex';
        });
    }

    // 3. Game screen buttons
    document.getElementById('btn-enter-game')?.addEventListener('click', () => {
        if (!currentPlayer) {
            window.switchTab('login');
            document.getElementById('auth-overlay')?.classList.remove('hidden');
            return;
        }

        if (!isQuizLiveNow()) {
            alert("⏳ بەڕێز، پێشبڕکێکە هێشتا دەستی پێنەکردووە!\n\nخەڵکی ناتوانن یاری بکەن تاکو کاتژمێر ١٠:٣٠ی شەو دەستپێدەکات، یان تاکو بەڕێوەبەری پەیمانگا پێشبڕکێکە دەستپێدەکات.\n\nتکایە چاوەڕوانی کاتژمێرەکە بە!");
            return;
        }

        startGame();
    });

    document.getElementById('btn-test-now')?.addEventListener('click', () => {
        if (!currentPlayer) {
            window.switchTab('login');
            document.getElementById('auth-overlay')?.classList.remove('hidden');
            return;
        }
        isLiveForced = true;
        startGame();
    });

    document.getElementById('btn-retry-game')?.addEventListener('click', () => {
        resetPlayerSession();
        location.reload();
    });

    document.getElementById('btn-view-profile')?.addEventListener('click', () => {
        if (currentPlayer) window.openProfileModal(currentPlayer.name);
    });

    document.getElementById('sound-toggle')?.addEventListener('click', () => {
        if (window.soundFX) {
            window.soundFX.enabled = !window.soundFX.enabled;
            const btn = document.getElementById('sound-toggle');
            if (btn) btn.textContent = window.soundFX.enabled ? '🔊' : '🔇';
        }
    });

    // 4. Live Chat Form Submit
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            if (!input) return;
            const text = input.value.trim();
            if (!text) return;
            const author = currentPlayer ? currentPlayer.name : 'خوێندکار';
            saveChatMessage(author, text);
            input.value = '';
        });
    }

    // 5. Lifeline 50:50
    document.getElementById('btn-lifeline-5050')?.addEventListener('click', () => {
        if (lifeline5050Used) return;
        useLifeline5050();
    });

    // 6. Lifeline +10s Time
    document.getElementById('btn-lifeline-time')?.addEventListener('click', () => {
        if (lifelineTimeUsed) return;
        useLifelineTime();
    });

    // 7. TTS Question Voice Reader
    document.getElementById('btn-read-question')?.addEventListener('click', () => {
        const q = questions[currentQuestionIndex];
        if (q) speakQuestionText(q.question);
    });

    // 8. Download Certificate
    document.getElementById('btn-download-cert')?.addEventListener('click', () => {
        window.openCertificateModal();
    });
}

// ══════════════════════════════════════════════════
//  SETTINGS & QUESTIONS HELPERS
// ══════════════════════════════════════════════════
function loadQuestions() {
    const saved = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    try {
        questions = saved ? JSON.parse(saved) : DEFAULT_QUESTIONS;
    } catch (e) {
        questions = DEFAULT_QUESTIONS;
    }
    if (!saved) localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
}

function initSettings() {
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
            targetHour: 22,
            targetMinute: 30,
            instituteName: 'پەیمانگای پەروەردەیی و تەکنیکی',
            adminUsername: 'admin',
            adminPassword: 'admin2024'
        }));
    }
}

function getSettings() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {};
    } catch (e) {
        return {};
    }
}

function renderPrizeBanner() {
    const s = getSettings();
    const prizeEl = document.getElementById('prize-title-display');
    if (prizeEl && s.prizeTitle) {
        prizeEl.textContent = s.prizeTitle;
    }
}

// ══════════════════════════════════════════════════
//  LIVE WAITING CHAT
// ══════════════════════════════════════════════════
function getChatMessages() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS_EXTRA.CHAT)) || [
            { author: 'ئاریان (بەشی IT)', text: 'سڵاو لە هەمووان، ئەمشەو هەموومان سەعات ١٠:٣٠ ئامادەین! 🔥', time: '10:15 PM' },
            { author: 'سۆزان (ژمێریاری)', text: 'ئەمشەو خەڵاتەکە هی منە ان شاء الله 🏆', time: '10:20 PM' }
        ];
    } catch (e) {
        return [];
    }
}

function saveChatMessage(author, text) {
    const msgs = getChatMessages();
    msgs.push({
        author: author || 'خوێندکار',
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (msgs.length > 50) msgs.shift();
    localStorage.setItem(STORAGE_KEYS_EXTRA.CHAT, JSON.stringify(msgs));
    renderChatMessages();
}

function renderChatMessages() {
    const box = document.getElementById('chat-messages-box');
    if (!box) return;
    const msgs = getChatMessages();
    box.innerHTML = '';
    msgs.forEach(m => {
        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerHTML = `
            <div class="chat-msg-author">
                <span>💬 ${escapeHTML(m.author)}</span>
                <span class="chat-msg-time">${escapeHTML(m.time)}</span>
            </div>
            <div class="chat-msg-text">${escapeHTML(m.text)}</div>
        `;
        box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
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
//  TTS (دەنگی خوێنەری پرسیار)
// ══════════════════════════════════════════════════
function speakQuestionText(text) {
    if (!('speechSynthesis' in window)) {
        alert('وێبگەڕەکەت پشتگیری دەنگی خوێندنەوە ناکات.');
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ckb';
    utterance.rate = 0.95;

    const ttsBtn = document.getElementById('btn-read-question');
    if (ttsBtn) ttsBtn.classList.add('speaking');

    utterance.onend = () => {
        if (ttsBtn) ttsBtn.classList.remove('speaking');
    };
    utterance.onerror = () => {
        if (ttsBtn) ttsBtn.classList.remove('speaking');
    };

    window.speechSynthesis.speak(utterance);
}

// ══════════════════════════════════════════════════
//  CERTIFICATE GENERATION & DOWNLOAD
// ══════════════════════════════════════════════════
window.openCertificateModal = function() {
    if (!currentPlayer) return;
    const s = getSettings();
    const instName = s.instituteName || 'پەیمانگای پەروەردەیی و تەکنیکی';
    const prize = s.prizeTitle || 'خەڵاتی پلەی یەکەم';
    const dateStr = new Date().toLocaleDateString('ckb');

    const modal = document.createElement('div');
    modal.id = 'cert-modal';
    modal.style.cssText = `
        position:fixed; inset:0; z-index:600;
        background:rgba(0,0,0,.65); backdrop-filter:blur(8px);
        display:flex; align-items:center; justify-content:center;
        padding:1rem;
    `;

    modal.innerHTML = `
        <div style="background:#fff; border-radius:24px; width:100%; max-width:540px; padding:1.5rem; text-align:center; box-shadow:0 25px 60px rgba(0,0,0,.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="margin:0; font-size:1.1rem; color:#78350f;">📜 بڕوانامەی شایستەیی و سەرکەوتن</h3>
                <button onclick="document.getElementById('cert-modal').remove()" style="border:none; background:#f3f4f6; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:1rem;">✕</button>
            </div>

            <!-- Certificate Canvas / Preview -->
            <div class="cert-preview-card" id="printable-cert">
                <div class="cert-seal">🎖️</div>
                <div class="cert-inst-title">${escapeHTML(instName)}</div>
                <div class="cert-heading">بڕوانامەی شایستەیی و ڕێزلێنان</div>
                <div style="font-size:0.85rem; color:#6b7280; margin-bottom:0.4rem;">ئەم بڕوانامەیە دەبەخشرێت بە خوێندکاری زیرەک:</div>
                <div class="cert-student-name">${escapeHTML(currentPlayer.name)}</div>
                <div class="cert-desc">
                    بەهۆی بەشداریکردنی لە پێشبڕکێی شەوانەی کاتژمێر ١٠:٣٠ و وەڵامدانەوەی سەرکەوتووانەی هەموو پرسیارەکان بەبێ هیچ هەڵەیەک، وەک پاڵەوان و براوەی فەرمی خەڵاتی ئەمشەو (${escapeHTML(prize)}) دیاریکرا.
                </div>
                <div class="cert-footer-row">
                    <div>بەروار: ${dateStr}</div>
                    <div>مۆری پەیمانگا: 🎓 پەسەندکراوە</div>
                </div>
            </div>

            <div style="display:flex; gap:0.75rem; justify-content:center;">
                <button onclick="window.printCertificate()" class="btn-primary" style="background:linear-gradient(135deg,#f59e0b,#d97706); padding:0.75rem 1.5rem;">
                    🖨️ چاپکردن / Save as PDF
                </button>
                <button onclick="document.getElementById('cert-modal').remove()" class="btn-secondary" style="padding:0.75rem 1.25rem;">
                    داخستن
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
};

window.printCertificate = function() {
    window.print();
};

// ══════════════════════════════════════════════════
//  LIVE CHECK & COUNTDOWN TIMER
// ══════════════════════════════════════════════════
function isQuizLiveNow() {
    if (isLiveForced) return true;

    // 1. Admin Live Toggle
    const adminLive = localStorage.getItem('institute_night_quiz_live_active');
    if (adminLive === 'true') return true;

    // 2. Automatic 10:30 PM Check
    const now = new Date();
    const s = getSettings();
    const h = s.targetHour ?? 22;
    const m = s.targetMinute ?? 30;

    let target = new Date();
    target.setHours(h, m, 0, 0);

    const diff = target.getTime() - now.getTime();
    // Live window: between 22:30 and 22:55 (25 minutes duration)
    if (diff <= 0 && diff > -25 * 60 * 1000) {
        return true;
    }

    return false;
}

function initCountdownTimer() {
    const hoursEl    = document.getElementById('timer-hours');
    const minutesEl  = document.getElementById('timer-minutes');
    const secondsEl  = document.getElementById('timer-seconds');
    const liveNotice = document.getElementById('live-status-notice');
    const enterBtn   = document.getElementById('btn-enter-game');

    function update() {
        const live = isQuizLiveNow();

        if (enterBtn) {
            if (live) {
                enterBtn.innerHTML = '<span>🔴 پێشبڕکێ دەستیپێکرد! بەشدار بە ئێستا</span>';
                enterBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                enterBtn.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                enterBtn.style.cursor = 'pointer';
                enterBtn.classList.add('live-active');
            } else {
                enterBtn.innerHTML = '<span>🔒 چاوەڕوانی کاتژمێر ١٠:٣٠ بە (پێشبڕکێ دەستپێدەکات)</span>';
                enterBtn.style.background = 'linear-gradient(135deg, #64748b, #475569)';
                enterBtn.style.boxShadow = 'none';
                enterBtn.style.cursor = 'pointer';
                enterBtn.classList.remove('live-active');
            }
        }

        if (live) {
            if (hoursEl) hoursEl.textContent = '00';
            if (minutesEl) minutesEl.textContent = '00';
            if (secondsEl) secondsEl.textContent = '00';
            if (liveNotice) {
                liveNotice.innerHTML = '🔴 <strong>پێشبڕکێ ئێستا چالاک و کراوەیە! تکایە دوگمەی خوارەوە دابگرە بۆ دەستپێکردن</strong>';
                liveNotice.style.color = '#10b981';
            }
            return;
        }

        const now = new Date();
        const s = getSettings();
        let target = new Date();
        target.setHours(s.targetHour ?? 22, s.targetMinute ?? 30, 0, 0);

        const diff = target.getTime() - now.getTime();

        if (diff <= -25 * 60 * 1000) {
            target.setDate(target.getDate() + 1);
        }

        const rem = Math.max(0, target.getTime() - now.getTime());
        if (hoursEl)   hoursEl.textContent   = String(Math.floor(rem / 3600000)).padStart(2, '0');
        if (minutesEl) minutesEl.textContent  = String(Math.floor((rem % 3600000) / 60000)).padStart(2, '0');
        if (secondsEl) secondsEl.textContent  = String(Math.floor((rem % 60000) / 1000)).padStart(2, '0');

        if (liveNotice) {
            const h = s.targetHour ?? 22;
            const m = s.targetMinute ?? 30;
            liveNotice.innerHTML = `⏳ پێشبڕکێ هەموو شەوێک لە کاتژمێر <strong>${h % 12 || 12}:${String(m).padStart(2,'0')} شەو</strong> دەستپێدەکات.<br><small style="color:var(--text-dim);">خەڵکی ناتوانن یاری بکەن تاکو کاتەکەی نەگات یان بەڕێوەبەر دەستیپێنەکات.</small>`;
            liveNotice.style.color = '';
        }
    }

    update();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(update, 1000);
}

// ══════════════════════════════════════════════════
//  GAME FLOW & ELIMINATION
// ══════════════════════════════════════════════════
function startGame() {
    currentQuestionIndex = 0;
    sessionCorrect = 0;
    sessionAnswered = 0;
    lifeline5050Used = false;
    lifelineTimeUsed = false;

    // Reset Lifeline buttons
    const b50 = document.getElementById('btn-lifeline-5050');
    const bTime = document.getElementById('btn-lifeline-time');
    if (b50) { b50.disabled = false; }
    if (bTime) { bTime.disabled = false; }

    showScreen(document.getElementById('screen-game'));
    renderCurrentQuestion();
}

// ── Lifeline 50:50 Implementation ──
function useLifeline5050() {
    if (lifeline5050Used) return;
    lifeline5050Used = true;
    const b50 = document.getElementById('btn-lifeline-5050');
    if (b50) b50.disabled = true;

    const q = questions[currentQuestionIndex];
    if (!q) return;

    // Find wrong indexes
    const wrongIndexes = [];
    q.options.forEach((_, idx) => {
        if (idx !== q.correctIndex) wrongIndexes.push(idx);
    });

    // Shuffle and pick 2 to hide
    wrongIndexes.sort(() => Math.random() - 0.5);
    const toHide = wrongIndexes.slice(0, 2);

    const buttons = document.querySelectorAll('.option-btn');
    toHide.forEach(idx => {
        if (buttons[idx]) {
            buttons[idx].style.opacity = '0.2';
            buttons[idx].disabled = true;
            buttons[idx].style.pointerEvents = 'none';
        }
    });

    if (window.soundFX) window.soundFX.playTick();
}

// ── Lifeline +10s Time Implementation ──
function useLifelineTime() {
    if (lifelineTimeUsed) return;
    lifelineTimeUsed = true;
    const bTime = document.getElementById('btn-lifeline-time');
    if (bTime) bTime.disabled = true;

    timeLeft += 10;
    const numEl = document.getElementById('timer-number');
    if (numEl) {
        numEl.textContent = timeLeft;
        numEl.style.color = '#10b981';
        setTimeout(() => { if (numEl) numEl.style.color = ''; }, 1000);
    }
    if (window.soundFX) window.soundFX.playCorrect();
}

function checkExistingSession() {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_PLAYER);
    if (!saved) return;
    try {
        const player = JSON.parse(saved);
        if (player.eliminated) {
            currentPlayer = player;
            showEliminationScreen(player.eliminationReason || 'پێشتر لە پێشبڕکێکە دەرکراویت!');
        }
    } catch (e) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_PLAYER);
    }
}

function showScreen(toShow) {
    const screens = [
        document.getElementById('screen-waiting'),
        document.getElementById('screen-game'),
        document.getElementById('screen-eliminated'),
        document.getElementById('screen-victory')
    ];
    screens.forEach(s => { if (s) s.classList.remove('active'); });
    if (toShow) toShow.classList.add('active');
}

function renderCurrentQuestion() {
    if (currentQuestionIndex >= questions.length) {
        handleVictory();
        return;
    }

    const q = questions[currentQuestionIndex];
    const nameEl = document.getElementById('current-player-name');
    const counterEl = document.getElementById('question-counter');
    const textEl = document.getElementById('question-text');

    if (nameEl && currentPlayer) nameEl.textContent = currentPlayer.name;
    if (counterEl) counterEl.textContent = `پرسیاری ${currentQuestionIndex + 1} لە ${questions.length}`;
    if (textEl) textEl.textContent = q.question;

    const letters = ['أ', 'ب', 'ج', 'د'];
    const container = document.getElementById('options-container');
    if (!container) return;
    container.innerHTML = '';

    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<span>${opt}</span><span class="option-letter">${letters[i] || (i + 1)}</span>`;
        btn.addEventListener('click', () => selectAnswer(i));
        container.appendChild(btn);
    });

    startQuestionTimer(q.timeLimit || 15);
}

function startQuestionTimer(duration) {
    clearInterval(questionTimer);
    timeLeft = duration;
    const numEl = document.getElementById('timer-number');
    const progEl = document.getElementById('timer-progress');
    const circumference = 125.6;

    function tick() {
        if (numEl) numEl.textContent = timeLeft;
        if (progEl) {
            const pct = timeLeft / duration;
            progEl.style.strokeDashoffset = circumference - pct * circumference;
            progEl.style.stroke = timeLeft <= 4 ? '#e53e3e' : timeLeft <= 8 ? '#d69e2e' : '#38a169';
        }
        if (timeLeft <= 4 && window.soundFX) window.soundFX.playTick();
        if (timeLeft <= 0) {
            clearInterval(questionTimer);
            handleElimination('کاتی وەڵامدانەوەت بەسەرچوو پێش وەڵامدانەوە!');
            return;
        }
        timeLeft--;
    }
    tick();
    questionTimer = setInterval(tick, 1000);
}

function selectAnswer(idx) {
    clearInterval(questionTimer);
    const q = questions[currentQuestionIndex];
    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => b.disabled = true);
    sessionAnswered++;

    if (idx === q.correctIndex) {
        btns[idx].classList.add('correct');
        if (window.soundFX) window.soundFX.playCorrect();
        sessionCorrect++;
        if (currentPlayer) currentPlayer.score += 10;
        savePlayer(currentPlayer);
        setTimeout(() => {
            currentQuestionIndex++;
            renderCurrentQuestion();
        }, 1200);
    } else {
        btns[idx].classList.add('wrong');
        if (btns[q.correctIndex]) btns[q.correctIndex].classList.add('correct');
        document.body.classList.add('screen-shake');
        setTimeout(() => document.body.classList.remove('screen-shake'), 600);
        if (window.soundFX) window.soundFX.playWrong();
        setTimeout(() => {
            handleElimination(`وەڵامی هەڵەت هەڵبژارد لە پرسیاری: "${q.question}"`);
        }, 1400);
    }
}

function handleElimination(reason) {
    if (window.soundFX) window.soundFX.playEliminated();
    if (currentPlayer) {
        currentPlayer.eliminated = true;
        currentPlayer.eliminationReason = reason;
        currentPlayer.eliminatedAt = new Date().toLocaleTimeString();
        savePlayer(currentPlayer);
        updateParticipantStatus(currentPlayer);

        const p = getProfile(currentPlayer.name);
        if (p) {
            upsertProfile(currentPlayer.name, currentPlayer.dept, {
                eliminations: (p.eliminations || 0) + 1,
                totalCorrect: (p.totalCorrect || 0) + sessionCorrect,
                totalAnswered: (p.totalAnswered || 0) + sessionAnswered
            });
            saveGameHistory(currentPlayer.name, false, sessionCorrect, questions.length);
        }
    }

    renderSurvivorsList();
    showEliminationScreen(reason);
}

function showEliminationScreen(reason) {
    showScreen(document.getElementById('screen-eliminated'));
    const nameEl = document.getElementById('elimination-player-name');
    const reasonEl = document.getElementById('elimination-reason-text');
    if (nameEl) nameEl.textContent = currentPlayer ? currentPlayer.name : '---';
    if (reasonEl) reasonEl.textContent = reason;

    const miniEl = document.getElementById('elimination-profile-mini');
    if (miniEl && currentPlayer) {
        const profile = getProfile(currentPlayer.name);
        if (profile) {
            const rank = getRank(profile.wins);
            miniEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:.75rem; justify-content:center; margin-bottom:1rem;">
                    <div style="width:44px; height:44px; border-radius:50%; background:${getAvatarColor(profile.name)};
                        display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:1rem;">
                        ${getInitials(profile.name)}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:800; font-size:.9rem;">${profile.name}</div>
                        <div style="font-size:.78rem; color:${rank.color}; font-weight:700;">
                            ${rank.icon} ${rank.label} · ${profile.wins} براوە لە ${profile.totalGames} یاری
                        </div>
                    </div>
                </div>`;
        }
    }
}

function handleVictory() {
    clearInterval(questionTimer);
    if (window.soundFX) window.soundFX.playFanfare();

    if (currentPlayer) {
        currentPlayer.won = true;
        savePlayer(currentPlayer);
        updateParticipantStatus(currentPlayer);

        const p = getProfile(currentPlayer.name);
        if (p) {
            upsertProfile(currentPlayer.name, currentPlayer.dept, {
                wins: (p.wins || 0) + 1,
                totalCorrect: (p.totalCorrect || 0) + sessionCorrect,
                totalAnswered: (p.totalAnswered || 0) + sessionAnswered
            });
            saveGameHistory(currentPlayer.name, true, sessionCorrect, questions.length);
        }
    }

    renderSurvivorsList();
    showScreen(document.getElementById('screen-victory'));

    const nameEl = document.getElementById('victory-player-name');
    if (nameEl && currentPlayer) nameEl.textContent = currentPlayer.name;

    const miniVictEl = document.getElementById('victory-profile-mini');
    if (miniVictEl && currentPlayer) {
        const profile = getProfile(currentPlayer.name);
        if (profile) {
            const rank = getRank(profile.wins);
            const color = getAvatarColor(profile.name);
            miniVictEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:.75rem; justify-content:center; margin-bottom:.75rem;">
                    <div style="width:48px; height:48px; border-radius:50%; background:${color};
                        display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:1.1rem;
                        border:3px solid #fff; box-shadow:0 4px 12px ${color}44;">
                        ${getInitials(profile.name)}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:800;">${profile.name}</div>
                        <div style="font-size:.8rem; color:${rank.color}; font-weight:700;">
                            ${rank.icon} ${rank.label} — کۆی براوەکان: ${profile.wins}
                        </div>
                    </div>
                </div>`;
        }
    }

    triggerConfetti();
}

// ══════════════════════════════════════════════════
//  LOCALSTORAGE HELPERS
// ══════════════════════════════════════════════════
function savePlayer(p) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_PLAYER, JSON.stringify(p));
}

function resetPlayerSession() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_PLAYER);
    currentPlayer = null;
    currentQuestionIndex = 0;
}

function getParticipants() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS)) || [];
    } catch (e) {
        return [];
    }
}

function recordParticipant(player) {
    const list = getParticipants();
    const i = list.findIndex(p => p.id === player.id || (p.name && p.name.toLowerCase() === player.name.toLowerCase()));
    if (i >= 0) list[i] = player;
    else list.unshift(player);
    localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(list));
}

function updateParticipantStatus(player) {
    recordParticipant(player);
}

function renderSurvivorsList() {
    const listEl  = document.getElementById('survivors-list');
    const countEl = document.getElementById('survivors-count');
    if (!listEl) return;

    let list = getParticipants();
    if (list.length === 0) {
        list = [
            { id: 101, name: 'ئاریان کامەران', dept: 'تەکنەلۆژیای زانیاری', eliminated: false },
            { id: 102, name: 'سۆزان ئەحمەد',  dept: 'ژمێریاری',              eliminated: false },
            { id: 103, name: 'کاروان جەبار',   dept: 'ئینگلیزی',              eliminated: true,  eliminationReason: 'وەڵامی هەڵە' },
            { id: 104, name: 'شاییستە مەحمود', dept: 'کارگێڕی',               eliminated: false }
        ];
        localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(list));
    }

    const alive = list.filter(p => !p.eliminated).length;
    if (countEl) countEl.textContent = `${alive} کەس ماون`;

    listEl.innerHTML = '';
    list.forEach(p => {
        const color = getAvatarColor(p.name);
        const initials = getInitials(p.name);
        const profile = getProfile(p.name);
        const rank = profile ? getRank(profile.wins) : RANKS[0];

        const item = document.createElement('div');
        item.className = `survivor-item ${p.eliminated ? 'eliminated' : ''}`;
        item.style.cursor = 'pointer';
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:.6rem; min-width:0;">
                <div style="width:34px; height:34px; border-radius:50%; background:${color}; flex-shrink:0;
                    display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:.82rem;">
                    ${initials}
                </div>
                <div style="min-width:0;">
                    <div style="font-weight:800; font-size:.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${p.name}
                    </div>
                    <div style="font-size:.72rem; color:${rank.color}; font-weight:700;">
                        ${rank.icon} ${rank.label}
                    </div>
                </div>
            </div>
            <span class="status-tag ${p.eliminated ? 'dead' : 'active'}">
                ${p.eliminated ? '💀 دەرکراوە' : (p.won ? '🏆 براوە' : '⚡ بەردەوامە')}
            </span>`;

        item.addEventListener('click', () => window.openProfileModal(p.name));
        listEl.appendChild(item);
    });
}

// ══════════════════════════════════════════════════
//  CONFETTI
// ══════════════════════════════════════════════════
function triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#ff6b35','#ff8f65','#38a169','#d69e2e','#e53e3e','#3182ce','#805ad5'];
    const pieces = Array.from({ length: 160 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        size: Math.random() * 8 + 4,
        speed: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * 360,
        rotS: Math.random() * 10 - 5
    }));

    let frames = 0;
    let raf;
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            p.y += p.speed;
            p.rot += p.rotS;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
            if (p.y > canvas.height) {
                p.y = -10;
                p.x = Math.random() * canvas.width;
            }
        });
        if (++frames < 350) raf = requestAnimationFrame(render);
        else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            cancelAnimationFrame(raf);
        }
    }
    render();
}
