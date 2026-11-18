// ══════════════════════════════════════════════════
//  پێشبڕکێی شەوانەی پەیمانگا — app.js
// ══════════════════════════════════════════════════

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
//  NOTIFICATION SYSTEM (TOAST & BROWSER NOTIFICATIONS)
// ══════════════════════════════════════════════════
function showToast(title, message, type = 'info', icon = '🔔', duration = 4500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    if (window.soundFX && typeof window.soundFX.playNotification === 'function') {
        window.soundFX.playNotification();
    }

    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${escapeHTML(title)}</div>
            <div class="toast-message">${escapeHTML(message)}</div>
        </div>
        <button class="toast-close" title="داخستن">✕</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 250);
    });

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.isConnected) {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 250);
        }
    }, duration);
}

function sendBrowserNotification(title, body, icon = '🎓') {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body: body,
                icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
            });
        } catch (e) {}
    }
}

function triggerNotification(title, message, type = 'info', icon = '🔔') {
    showToast(title, message, type, icon);
    sendBrowserNotification(title, message, icon);
}

window.showToast = showToast;
window.triggerNotification = triggerNotification;

function initNotificationToggle() {
    const btn = document.getElementById('notif-toggle');
    if (!btn) return;

    let enabled = localStorage.getItem('quiz_notif_enabled') !== '0'; // Enabled by default
    function updateBtn() {
        if (enabled) {
            btn.classList.add('active');
            btn.innerHTML = '🔔';
            btn.title = 'ئاگادارکردنەوە چالاکە (کلیک بکە بۆ ناچالاککردن)';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '🔕';
            btn.title = 'ئاگادارکردنەوە ناچالاکە (کلیک بکە بۆ چالاککردن)';
        }
    }
    updateBtn();

    btn.addEventListener('click', async () => {
        if (!enabled) {
            if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                try {
                    const perm = await Notification.requestPermission();
                    if (perm === 'granted') {
                        enabled = true;
                    }
                } catch (e) {
                    enabled = true;
                }
            }
            enabled = true;
            localStorage.setItem('quiz_notif_enabled', '1');
            updateBtn();
            triggerNotification('🔔 ئاگادارکردنەوەی پێشبڕکێ چالاک کرا!', 'شەوانە کاتژمێر ١٠:٣٠ ڕاستەوخۆ بە دەنگ و نۆتێفیکەیشن ئاگادارت دەکەینەوە.', 'success', '🎉');
        } else {
            enabled = false;
            localStorage.setItem('quiz_notif_enabled', '0');
            updateBtn();
            showToast('🔕 ئاگادارکردنەوە ناچالاک کرا', 'ئاگادارکردنەوەکانی سیستەم بۆ ئەم ئامێرە ڕاگیران.', 'info', '🔕');
        }
    });
}

// ══════════════════════════════════════════════════
//  🌙 DARK MODE & THEME TOGGLE
// ══════════════════════════════════════════════════
function initThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    let savedTheme = localStorage.getItem('quiz_theme');
    if (!savedTheme) {
        savedTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            btn.innerHTML = '☀️';
            btn.title = 'دۆخی ڕۆژ (Light Mode)';
        } else {
            document.body.classList.remove('dark-mode');
            btn.innerHTML = '🌙';
            btn.title = 'دۆخی شەوانە (Dark Mode)';
        }
    }

    applyTheme(savedTheme);

    btn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-mode');
        const nextTheme = isDark ? 'light' : 'dark';
        applyTheme(nextTheme);
        localStorage.setItem('quiz_theme', nextTheme);
        if (window.soundFX) window.soundFX.playTick();
    });
}

// ══════════════════════════════════════════════════
//  📱 PWA & SERVICE WORKER
// ══════════════════════════════════════════════════
let deferredPwaPrompt = null;
function initPwa() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    const installBtn = document.getElementById('btn-pwa-install');
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPwaPrompt = e;
        if (installBtn) {
            installBtn.style.display = 'inline-flex';
        }
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPwaPrompt) {
                showToast('📱 دامەزراندنی ئەپ', 'دەتوانیت لە ڕێگەی مێنیوی مۆبایلەکەت «Add to Home Screen» بکەیت.', 'info', '📲');
                return;
            }
            deferredPwaPrompt.prompt();
            const { outcome } = await deferredPwaPrompt.userChoice;
            if (outcome === 'accepted') {
                installBtn.style.display = 'none';
                showToast('🎉 پیرۆزە!', 'ئەپەکە بە سەرکەوتوویی لەسەر مۆبایلەکەت دامەزرا.', 'success', '📱');
            }
            deferredPwaPrompt = null;
        });
    }
}

// ══════════════════════════════════════════════════
//  🚀 LIVE FLOATING REACTIONS
// ══════════════════════════════════════════════════
window.sendFloatingReaction = function(emoji) {
    if (window.soundFX && typeof window.soundFX.playTick === 'function') {
        window.soundFX.playTick();
    }
    if (navigator.vibrate) {
        try { navigator.vibrate(15); } catch (e) {}
    }

    const floating = document.createElement('div');
    floating.className = 'floating-reaction';
    floating.textContent = emoji || '🔥';

    const startX = Math.floor(Math.random() * (window.innerWidth * 0.5)) + (window.innerWidth * 0.25);
    floating.style.left = startX + 'px';

    const rx = (Math.random() * 60 - 30) + 'px';
    const lx = (Math.random() * 60 - 30) + 'px';
    floating.style.setProperty('--rx', rx);
    floating.style.setProperty('--lx', lx);

    document.body.appendChild(floating);

    setTimeout(() => {
        if (floating.isConnected) floating.remove();
    }, 2200);
};

// ══════════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    loadQuestions();
    initSettings();
    initDefaultUsers();
    renderHallOfFame();
    renderSurvivorsList();
    renderChatMessages();
    setupEventListeners();
    handleAuthGate();
    renderPrizeBanner();
    initNotificationToggle();
    initThemeToggle();
    initPwa();
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

// ══ Cryptographic SHA-256 Hashing ══
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

function saveUsers(users) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

function initDefaultUsers() {
    let users = getUsers();
    let changed = false;

    // Ensure demo student exists with hashed password
    if (!users['student']) {
        users['student'] = {
            username: 'student',
            name: 'خوێندکاری تاقیکردنەوە',
            dept: 'بەشی کۆمپیوتەر',
            passwordHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3' // sha256 of 123
        };
        changed = true;
    }

    // Ensure Admin account exists for direct login
    if (!users['hama22#it']) {
        users['hama22#it'] = {
            username: 'hama22#it',
            name: 'بەڕێوەبەری پەیمانگا',
            dept: 'بەڕێوەبەرایەتی پەیمانگا ⚙️',
            passwordHash: 'a9e64cf58faad8273903eab78ecf5af610d2a12cd5583efea46425b739cffa96' // SHA-256 of WWE07700:
        };
        changed = true;
    }

    // Auto-migrate any existing plain passwords to hashed
    for (const u in users) {
        if (users[u].password && !users[u].passwordHash) {
            sha256(users[u].password).then(h => {
                users[u].passwordHash = h;
                delete users[u].password;
                saveUsers(users);
            });
        }
    }

    if (changed) {
        saveUsers(users);
    }
}

// ── Auth Gate Check ──
function handleAuthGate() {
    const session = localStorage.getItem('quiz_logged_in') || sessionStorage.getItem('quiz_logged_in');
    const overlay = document.getElementById('auth-overlay');

    if (session) {
        try {
            const data = JSON.parse(session);
            const prof = getProfile(data.name);
            currentPlayer = {
                id: data.id || Date.now(),
                name: data.name,
                username: data.username,
                dept: data.dept,
                avatarUrl: (prof && prof.avatarUrl) || data.avatarUrl || '',
                joinedAt: data.joinedAt || new Date().toLocaleTimeString(),
                eliminated: false,
                score: 0,
                isAdmin: !!data.isAdmin
            };

            showWelcomeCard(data.name, data.dept);
            if (overlay) overlay.classList.add('hidden');

            const profileBtn = document.getElementById('btn-view-profile');
            if (profileBtn) profileBtn.style.display = 'inline-flex';

            const uName = (data.username || '').toLowerCase();
            if (uName === 'hama22#it' || uName === 'hama22' || data.isAdmin) {
                const adminBtn = document.getElementById('btn-admin-panel');
                if (adminBtn) adminBtn.style.display = 'inline-flex';
            }

            checkExistingSession();
            initCountdownTimer();
            return;
        } catch (e) {
            console.warn('Session parse notice:', e);
            localStorage.removeItem('quiz_logged_in');
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
    localStorage.removeItem('quiz_logged_in');
    sessionStorage.removeItem('quiz_logged_in');
    localStorage.removeItem(STORAGE_KEYS.CURRENT_PLAYER);
    location.reload();
};

// ── Profile, Avatar & History System ══
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
        avatarUrl: '',
        bio: '',
        instagram: '',
        telegram: '',
        tiktok: '',
        facebook: '',
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
    if (window.supabaseService && typeof window.supabaseService.pushProfile === 'function') {
        window.supabaseService.pushProfile(existing);
    }
    return existing;
}

// ══ Live Student Activity Logger for Admin ══
function logStudentActivity(userOrPlayer, actionType, actionLabel) {
    if (!userOrPlayer) return;
    try {
        const logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOG)) || [];
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
        const profile = typeof getProfile === 'function' ? getProfile(userOrPlayer.name) : null;

        const entry = {
            id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            name: userOrPlayer.name || 'خوێندکار',
            username: userOrPlayer.username || '',
            dept: userOrPlayer.dept || (profile ? profile.dept : '') || 'پەیمانگا',
            avatarUrl: (profile && profile.avatarUrl) || userOrPlayer.avatarUrl || '',
            actionType: actionType, // 'login', 'register', 'game_start', 'victory', 'eliminated'
            actionLabel: actionLabel,
            device: isMobile ? 'مۆبایل 📱' : 'کۆمپیوتەر 💻',
            time: new Date().toLocaleTimeString('ckb', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            date: new Date().toLocaleDateString('ckb'),
            timestamp: Date.now()
        };

        logs.unshift(entry);
        if (logs.length > 120) logs.pop();

        localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify(logs));
        if (window.supabaseService && typeof window.supabaseService.pushActivity === 'function') {
            window.supabaseService.pushActivity(entry);
        }
    } catch (e) {
        console.error('Activity log error:', e);
    }
}

// ══ Image Compression Helper ══
function compressAndResizeImage(file, maxDimension = 220, quality = 0.8) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            return reject(new Error('تکایە تەنها وێنە هەڵبژێرە!'));
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = () => reject(new Error('کێشەیەک لە بارکردنی وێنەکە هەیە'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('نەتوانرا فایلەکە بخوێندرێتەوە'));
        reader.readAsDataURL(file);
    });
}

// ══ Registration Avatar Upload State ══
window.regAvatarDataUrl = null;
window.handleRegAvatarSelect = async function(input) {
    if (!input.files || !input.files[0]) return;
    try {
        const dataUrl = await compressAndResizeImage(input.files[0], 220, 0.82);
        window.regAvatarDataUrl = dataUrl;
        const preview = document.getElementById('reg-avatar-preview');
        if (preview) {
            preview.innerHTML = `<img src="${dataUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            preview.style.border = '2px solid #38a169';
        }
    } catch (err) {
        alert(err.message || 'هەڵە لە وێنەکەدا هەیە');
    }
};

// ══ Reusable Avatar Renderer ══
function renderAvatarHTML(name, avatarUrl, sizePx = 36, extraStyle = '') {
    const cleanName = escapeHTML(name || 'خوێندکار');
    if (avatarUrl) {
        return `<img src="${avatarUrl}" alt="${cleanName}" style="width:${sizePx}px; height:${sizePx}px; border-radius:50%; object-fit:cover; display:inline-block; vertical-align:middle; flex-shrink:0; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,.12); ${extraStyle}">`;
    }
    const color = getAvatarColor(name || '');
    const initials = getInitials(name || '');
    const fontSize = Math.max(10, Math.round(sizePx * 0.42));
    return `<div style="width:${sizePx}px; height:${sizePx}px; border-radius:50%; background:${color}; color:#fff; font-weight:900; font-size:${fontSize}px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,.12); ${extraStyle}">${initials}</div>`;
}

// ══ Social Media Formatter ══
function formatSocialLink(platform, input) {
    if (!input) return null;
    let raw = String(input).trim();
    if (!raw) return null;
    raw = raw.replace(/^@/, '');

    switch (platform) {
        case 'instagram':
            if (raw.startsWith('http://') || raw.startsWith('https://')) {
                return { url: raw, label: '@' + raw.split('/').filter(Boolean).pop(), icon: '📸', cls: 'ig' };
            }
            return { url: `https://instagram.com/${raw}`, label: `@${raw}`, icon: '📸', cls: 'ig' };
        case 'telegram':
            if (raw.startsWith('http://') || raw.startsWith('https://')) {
                return { url: raw, label: '@' + raw.split('/').filter(Boolean).pop(), icon: '✈️', cls: 'tg' };
            }
            return { url: `https://t.me/${raw}`, label: `@${raw}`, icon: '✈️', cls: 'tg' };
        case 'tiktok':
            if (raw.startsWith('http://') || raw.startsWith('https://')) {
                return { url: raw, label: 'تیکتۆک', icon: '🎵', cls: 'tt' };
            }
            return { url: `https://www.tiktok.com/@${raw}`, label: `@${raw}`, icon: '🎵', cls: 'tt' };
        case 'facebook':
            if (raw.startsWith('http://') || raw.startsWith('https://')) {
                return { url: raw, label: 'فەیسبووک', icon: '🌐', cls: 'fb' };
            }
            return { url: `https://facebook.com/${raw}`, label: `@${raw}`, icon: '🌐', cls: 'fb' };
        default:
            return null;
    }
}

// ══ Rich Game History Tracking ══
function saveGameHistory(name, won, correctCount, totalQuestions, extra = {}) {
    const key = `quiz_history_${(name || '').trim().toLowerCase()}`;
    let history = [];
    try { history = JSON.parse(localStorage.getItem(key)) || []; } catch (e) {}

    const now = new Date();
    const dateStr = now.toLocaleDateString('ckb', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('ckb', { hour: '2-digit', minute: '2-digit' });

    history.unshift({
        id: Date.now(),
        won: !!won,
        correctCount: Number(correctCount) || 0,
        totalQuestions: Number(totalQuestions) || 5,
        score: extra.score || (won ? 100 : Math.round(((Number(correctCount) || 0) / (Number(totalQuestions) || 1)) * 100)),
        reason: extra.reason || (won ? '🏆 براوەی تەواوی پێشبڕکێکە' : '❌ وەڵامی هەڵە یان تەواوبوونی کات'),
        lifelinesUsed: extra.lifelinesUsed || [],
        date: dateStr,
        time: timeStr
    });

    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem(key, JSON.stringify(history));
}

// ══ Profile Modal ══
let currentProfileModalTarget = '';
let currentProfileHistoryFilter = 'all';

window.openProfileModal = function(name, activeTab = 'stats') {
    const targetName = name || (currentPlayer ? currentPlayer.name : '');
    if (!targetName) return;
    currentProfileModalTarget = targetName;

    let profile = getProfile(targetName);
    if (!profile) {
        profile = {
            name: targetName,
            dept: currentPlayer ? currentPlayer.dept : 'پەیمانگا',
            avatarUrl: '',
            bio: '',
            instagram: '',
            telegram: '',
            tiktok: '',
            facebook: '',
            firstJoined: new Date().toLocaleDateString('ckb'),
            totalGames: 0,
            wins: 0,
            eliminations: 0,
            totalCorrect: 0,
            totalAnswered: 0
        };
    }

    const rank = getRank(profile.wins || 0);
    const winRate = profile.totalGames > 0
        ? Math.round((profile.wins / profile.totalGames) * 100) : 0;
    const accuracy = profile.totalAnswered > 0
        ? Math.round((profile.totalCorrect / profile.totalAnswered) * 100) : 0;

    const historyKey = `quiz_history_${targetName.trim().toLowerCase()}`;
    let history = [];
    try { history = JSON.parse(localStorage.getItem(historyKey)) || []; } catch (e) {}

    const isSelf = currentPlayer && currentPlayer.name.toLowerCase() === targetName.toLowerCase();

    // Social Links
    const socialList = [];
    if (profile.instagram) { const s = formatSocialLink('instagram', profile.instagram); if (s) socialList.push(s); }
    if (profile.telegram)  { const s = formatSocialLink('telegram', profile.telegram);   if (s) socialList.push(s); }
    if (profile.tiktok)    { const s = formatSocialLink('tiktok', profile.tiktok);       if (s) socialList.push(s); }
    if (profile.facebook)  { const s = formatSocialLink('facebook', profile.facebook);   if (s) socialList.push(s); }

    let socialHTML = '';
    if (socialList.length > 0) {
        socialHTML = `<div class="social-links-wrap">` +
            socialList.map(s => `
                <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="social-chip ${s.cls}" title="${s.label}">
                    <span>${s.icon}</span> <span>${escapeHTML(s.label)}</span>
                </a>
            `).join('') +
            `</div>`;
    } else if (isSelf) {
        socialHTML = `
            <div class="social-links-wrap">
                <button type="button" onclick="window.openEditProfileModal()" class="social-chip empty-add">
                    <span>➕</span> <span>دانانی لینکی سۆشیال میدیا</span>
                </button>
            </div>
        `;
    }

    const bioHTML = profile.bio ? `
        <div class="bio-quote-box">
            « ${escapeHTML(profile.bio)} »
        </div>
    ` : '';

    const editBtnHTML = isSelf ? `
        <div style="margin-top:.75rem;">
            <button onclick="window.openEditProfileModal()" style="
                background:#fff4ee; border:1.5px solid #ffd1b3; color:#ff6b35;
                padding:.42rem 1rem; border-radius:50px; font-size:.82rem; font-weight:800;
                cursor:pointer; display:inline-flex; align-items:center; gap:.4rem; font-family:inherit;
            ">
                <span>✏️</span> <span>دەستکاریکردنی پڕۆفایل و وێنە</span>
            </button>
        </div>
    ` : '';

    const existingModal = document.getElementById('profile-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'profile-modal';
    modal.style.cssText = `
        position:fixed; inset:0; z-index:500;
        background:rgba(0,0,0,.5); backdrop-filter:blur(6px);
        display:flex; align-items:center; justify-content:center;
        padding:1rem;
    `;

    // Filter History
    const winsCount = history.filter(h => h.won).length;
    const lossesCount = history.filter(h => !h.won).length;

    let filteredHistory = history;
    if (currentProfileHistoryFilter === 'won') filteredHistory = history.filter(h => h.won);
    if (currentProfileHistoryFilter === 'eliminated') filteredHistory = history.filter(h => !h.won);

    let historyCardsHTML = '';
    if (filteredHistory.length === 0) {
        historyCardsHTML = `
            <div style="text-align:center; padding:2rem 1rem; color:var(--text-dim); background:#fbfbfd; border-radius:14px; border:1.5px dashed #e2e8f0;">
                <div style="font-size:2rem; margin-bottom:.5rem;">📜</div>
                <div style="font-weight:800; font-size:.9rem; color:#64748b;">هیچ یاریەک لەم بەشەدا نەدۆزرایەوە</div>
                <div style="font-size:.75rem; margin-top:.25rem;">لە پێشبڕکێکانی ئەمشەودا بەشداری بکە بۆ تۆمارکردنی یەکەم یاریت!</div>
            </div>`;
    } else {
        historyCardsHTML = filteredHistory.map(h => {
            const won = h.won;
            const statusColor = won ? '#276749' : '#c53030';
            const statusBg = won ? '#f0fff4' : '#fff5f5';
            const statusBorder = won ? '#9ae6b4' : '#feb2b2';
            const statusLabel = won ? '🏆 براوەی تەواوی پێشبڕکێکە' : '💀 دەرکراوە لە یاریەکەدا';
            const acc = h.totalQuestions > 0 ? Math.round((h.correctCount / h.totalQuestions) * 100) : 0;

            return `
            <div class="history-card-item ${won ? 'won' : 'eliminated'}" style="margin-bottom:.55rem;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:.35rem;">
                    <div>
                        <span style="font-weight:900; font-size:.85rem; color:${statusColor};">${statusLabel}</span>
                        <div style="font-size:.72rem; color:#64748b; margin-top:.15rem;">
                            📅 ${h.date || ''} ${h.time ? '· ⏰ ' + h.time : ''}
                        </div>
                    </div>
                    <span style="font-weight:900; font-size:.85rem; color:${statusColor}; background:${statusBg}; border:1px solid ${statusBorder}; padding:.2rem .65rem; border-radius:50px;">
                        ${h.correctCount}/${h.totalQuestions} دروست
                    </span>
                </div>
                <div style="font-size:.78rem; color:#475569; margin-bottom:.45rem; line-height:1.4;">
                    ${escapeHTML(h.reason || (won ? 'وەڵامی هەموو پرسیارەکان بە سەرکەوتوویی درایەوە' : 'لە پێشبڕکێکە دەرکرا'))}
                </div>
                <div style="background:#e2e8f0; height:5px; border-radius:3px; overflow:hidden;">
                    <div style="background:${statusColor}; height:100%; width:${acc}%;"></div>
                </div>
            </div>`;
        }).join('');
    }

    modal.innerHTML = `
        <div style="
            background:#fff; border-radius:24px; width:100%; max-width:480px;
            max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,.28);
            border:1.5px solid #e8e8f0; text-align:right;
        ">
            <!-- Header with Avatar & Socials -->
            <div style="
                background:linear-gradient(135deg, #fff7ed, #fff);
                border-bottom:1.5px solid #fed7aa;
                padding:1.6rem 1.25rem 1.1rem; text-align:center; position:relative;
            ">
                <button onclick="document.getElementById('profile-modal').remove()"
                    style="position:absolute; top:1rem; left:1rem; background:rgba(0,0,0,.06);
                    border:none; width:34px; height:34px; border-radius:50%; cursor:pointer;
                    font-size:1.1rem; display:flex; align-items:center; justify-content:center;">✕</button>

                <div style="margin:0 auto .75rem; width:84px; height:84px; border-radius:50%; overflow:hidden; box-shadow:0 6px 20px rgba(255,107,53,.35); border:3.5px solid #fff;">
                    ${renderAvatarHTML(profile.name, profile.avatarUrl, 84)}
                </div>

                <h2 style="font-size:1.3rem; font-weight:900; color:#1a1a2e; margin:0 0 .2rem;">${escapeHTML(profile.name)}</h2>
                <div style="font-size:.82rem; color:#666680; margin-bottom:.55rem;">${escapeHTML(profile.dept || 'پەیمانگا')}</div>

                <div style="
                    display:inline-flex; align-items:center; gap:.4rem;
                    background:${rank.color}18; border:1.5px solid ${rank.color}44;
                    color:${rank.color}; padding:.3rem .9rem; border-radius:50px;
                    font-size:.85rem; font-weight:800;
                ">${rank.icon} ${rank.label}</div>

                ${bioHTML}
                ${socialHTML}
                ${editBtnHTML}
            </div>

            <!-- Tab Navigation -->
            <div class="profile-nav-tabs">
                <button class="profile-tab-btn ${activeTab === 'stats' ? 'active' : ''}" onclick="window.switchProfileTab('stats')">
                    📊 ئامار و پلەکان
                </button>
                <button class="profile-tab-btn ${activeTab === 'history' ? 'active' : ''}" onclick="window.switchProfileTab('history')">
                    📋 مێژووی یارییەکان (${history.length})
                </button>
            </div>

            <!-- TAB 1: STATS -->
            <div id="ptab-stats" style="display:${activeTab === 'stats' ? 'block' : 'none'}; padding:1.25rem 1.25rem 1.5rem;">
                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:.6rem; margin-bottom:1.25rem;">
                    <div style="background:#faf9f7; border:1.5px solid #e8e8f0; border-radius:12px; padding:.75rem .4rem; text-align:center;">
                        <div style="font-size:1.3rem;">🎮</div>
                        <div style="font-size:1.1rem; font-weight:900; color:#ff6b35; margin:.15rem 0;">${profile.totalGames || 0}</div>
                        <div style="font-size:.7rem; color:#666680;">کۆی یاری</div>
                    </div>
                    <div style="background:#faf9f7; border:1.5px solid #e8e8f0; border-radius:12px; padding:.75rem .4rem; text-align:center;">
                        <div style="font-size:1.3rem;">🏆</div>
                        <div style="font-size:1.1rem; font-weight:900; color:#276749; margin:.15rem 0;">${profile.wins || 0}</div>
                        <div style="font-size:.7rem; color:#666680;">بردنەوە</div>
                    </div>
                    <div style="background:#faf9f7; border:1.5px solid #e8e8f0; border-radius:12px; padding:.75rem .4rem; text-align:center;">
                        <div style="font-size:1.3rem;">💀</div>
                        <div style="font-size:1.1rem; font-weight:900; color:#c53030; margin:.15rem 0;">${profile.eliminations || 0}</div>
                        <div style="font-size:.7rem; color:#666680;">دەرکراوە</div>
                    </div>
                    <div style="background:#faf9f7; border:1.5px solid #e8e8f0; border-radius:12px; padding:.75rem .4rem; text-align:center;">
                        <div style="font-size:1.3rem;">⚡</div>
                        <div style="font-size:1.1rem; font-weight:900; color:#d69e2e; margin:.15rem 0;">${winRate}%</div>
                        <div style="font-size:.7rem; color:#666680;">ڕێژەی بردنەوە</div>
                    </div>
                    <div style="background:#faf9f7; border:1.5px solid #e8e8f0; border-radius:12px; padding:.75rem .4rem; text-align:center;">
                        <div style="font-size:1.3rem;">🎯</div>
                        <div style="font-size:1.1rem; font-weight:900; color:#3182ce; margin:.15rem 0;">${accuracy}%</div>
                        <div style="font-size:.7rem; color:#666680;">وەڵامی دروست</div>
                    </div>
                    <div style="background:#faf9f7; border:1.5px solid #e8e8f0; border-radius:12px; padding:.75rem .4rem; text-align:center;">
                        <div style="font-size:1.3rem;">📅</div>
                        <div style="font-size:.85rem; font-weight:900; color:#805ad5; margin:.2rem 0;">${profile.firstJoined || 'تازە'}</div>
                        <div style="font-size:.7rem; color:#666680;">بەرواری بەشداری</div>
                    </div>
                </div>

                <!-- Last match quick glimpse -->
                ${history.length > 0 ? `
                <div style="background:#fff7ed; border:1px solid #ffd1b3; border-radius:12px; padding:.75rem 1rem; margin-bottom:1.25rem;">
                    <div style="font-weight:800; font-size:.82rem; color:#c05621; margin-bottom:.25rem;">⚡ دوایین یاریی ئەنجامدراو:</div>
                    <div style="font-size:.78rem; color:#475569;">
                        ${history[0].won ? '🏆 براوەی پێشبڕکێکە بوو' : '❌ دەرکرا لە یاریەکە'} (${history[0].date}) — ${history[0].correctCount}/${history[0].totalQuestions} دروست
                    </div>
                </div>` : ''}

                ${isSelf ? `
                <button onclick="window.logoutUser()" style="
                    width:100%; background:#fff5f5; border:1.5px solid #fed7d7;
                    color:#c53030; padding:.75rem; border-radius:10px;
                    font-size:.88rem; font-weight:800; cursor:pointer; font-family:inherit;
                ">🚪 دەرچوون لە ئەکاونت (Logout)</button>` : ''}
            </div>

            <!-- TAB 2: FULL HISTORY -->
            <div id="ptab-history" style="display:${activeTab === 'history' ? 'block' : 'none'}; padding:1.1rem 1.25rem 1.5rem;">
                <div class="history-filter-wrap">
                    <button class="history-filter-btn ${currentProfileHistoryFilter === 'all' ? 'active' : ''}" onclick="window.filterProfileHistory('all')">
                        هەمووی (${history.length})
                    </button>
                    <button class="history-filter-btn ${currentProfileHistoryFilter === 'won' ? 'active' : ''}" onclick="window.filterProfileHistory('won')">
                        🏆 بردنەوەکان (${winsCount})
                    </button>
                    <button class="history-filter-btn ${currentProfileHistoryFilter === 'eliminated' ? 'active' : ''}" onclick="window.filterProfileHistory('eliminated')">
                        💀 دەرکراوەکان (${lossesCount})
                    </button>
                </div>

                <div style="display:flex; flex-direction:column; gap:.4rem;">
                    ${historyCardsHTML}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
};

window.switchProfileTab = function(tabName) {
    window.openProfileModal(currentProfileModalTarget, tabName);
};

window.filterProfileHistory = function(filter) {
    currentProfileHistoryFilter = filter;
    window.openProfileModal(currentProfileModalTarget, 'history');
};

// ══ Edit Profile Modal ══
window.openEditProfileModal = function() {
    if (!currentPlayer) return;
    const profile = getProfile(currentPlayer.name) || { name: currentPlayer.name, dept: currentPlayer.dept };

    const existing = document.getElementById('edit-profile-modal');
    if (existing) existing.remove();

    let tempAvatar = profile.avatarUrl || '';

    const modal = document.createElement('div');
    modal.id = 'edit-profile-modal';
    modal.style.cssText = `
        position:fixed; inset:0; z-index:600;
        background:rgba(0,0,0,.5); backdrop-filter:blur(6px);
        display:flex; align-items:center; justify-content:center;
        padding:1rem;
    `;

    modal.innerHTML = `
        <div style="
            background:#fff; border-radius:24px; width:100%; max-width:480px;
            max-height:92vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,.3);
            border:1.5px solid #e8e8f0; text-align:right; padding:1.4rem;
        ">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1.5px solid #f0f0f5; padding-bottom:.85rem; margin-bottom:1.15rem;">
                <h3 style="font-size:1.15rem; font-weight:900; color:#1a1a2e; margin:0;">
                    ✏️ دەستکاریکردنی پڕۆفایلی من
                </h3>
                <button onclick="document.getElementById('edit-profile-modal').remove()"
                    style="background:#f4f4f7; border:none; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center;">✕</button>
            </div>

            <!-- Avatar Upload Row -->
            <div style="text-align:center; margin-bottom:1.3rem;">
                <div id="edit-avatar-preview-box" style="margin:0 auto .75rem; width:88px; height:88px; border-radius:50%; overflow:hidden; position:relative; box-shadow:0 4px 14px rgba(0,0,0,.15); border:3px solid #ff6b35;">
                    ${renderAvatarHTML(profile.name, tempAvatar, 88)}
                </div>
                <input type="file" id="edit-avatar-file-input" accept="image/*" style="display:none;">
                <div style="display:flex; justify-content:center; gap:.5rem;">
                    <button type="button" onclick="document.getElementById('edit-avatar-file-input').click()"
                        style="background:#fff4ee; border:1.5px solid #ffd1b3; color:#ff6b35; padding:.4rem .9rem; border-radius:8px; font-size:.8rem; font-weight:800; cursor:pointer; font-family:inherit;">
                        📷 هەڵبژاردنی وێنە
                    </button>
                    <button type="button" id="btn-remove-avatar"
                        style="background:#fff5f5; border:1.5px solid #fed7d7; color:#c53030; padding:.4rem .8rem; border-radius:8px; font-size:.8rem; font-weight:700; cursor:pointer; font-family:inherit; ${tempAvatar ? '' : 'display:none;'}">
                        🗑️ سڕینەوە
                    </button>
                </div>
                <div style="font-size:.72rem; color:#888; margin-top:.35rem;">ڕەسمێک لە مۆبایل یان کۆمپیوتەرت دابنێ (خۆکارانە فۆرمات دەکرێت)</div>
            </div>

            <form id="edit-profile-form">
                <div class="form-group" style="margin-bottom:.85rem;">
                    <label style="display:block; font-size:.82rem; font-weight:800; margin-bottom:.3rem; color:#333;">✍️ ناوی تەواو:</label>
                    <input type="text" id="ep-name" class="form-control" value="${escapeHTML(profile.name || '')}" required style="width:100%; padding:.75rem; border:1.5px solid #e2e8f0; border-radius:10px; font-size:15px; font-family:inherit;">
                </div>

                <div class="form-group" style="margin-bottom:.85rem;">
                    <label style="display:block; font-size:.82rem; font-weight:800; margin-bottom:.3rem; color:#333;">🏫 بەش و قۆناغ:</label>
                    <input type="text" id="ep-dept" class="form-control" value="${escapeHTML(profile.dept || '')}" placeholder="نموونە: تەکنەلۆژیای زانیاری - قۆناغی ٢" style="width:100%; padding:.75rem; border:1.5px solid #e2e8f0; border-radius:10px; font-size:15px; font-family:inherit;">
                </div>

                <div class="form-group" style="margin-bottom:.85rem;">
                    <label style="display:block; font-size:.82rem; font-weight:800; margin-bottom:.3rem; color:#333;">💬 وتەی پڕۆفایل (Bio):</label>
                    <textarea id="ep-bio" rows="2" placeholder="پەندێک، وتەیەک یان ئامانجت بنووسە..." style="width:100%; padding:.75rem; border:1.5px solid #e2e8f0; border-radius:10px; font-size:14px; font-family:inherit; resize:none;">${escapeHTML(profile.bio || '')}</textarea>
                </div>

                <div style="background:#fafafa; border:1.5px solid #f0f0f5; border-radius:12px; padding:.9rem; margin-bottom:1.15rem;">
                    <div style="font-weight:900; font-size:.85rem; color:#1a1a2e; margin-bottom:.65rem;">
                        🌐 بەستەرەکانی سۆشیال میدیا
                    </div>

                    <div style="margin-bottom:.65rem;">
                        <label style="display:block; font-size:.78rem; font-weight:700; color:#555; margin-bottom:.2rem;">📸 ئینستاگرام (Instagram):</label>
                        <input type="text" id="ep-instagram" value="${escapeHTML(profile.instagram || '')}" placeholder="یوزەرنەیم بنووسە: alan_dev" style="width:100%; padding:.65rem; border:1.5px solid #e2e8f0; border-radius:8px; font-size:14px; direction:ltr; text-align:left;">
                    </div>

                    <div style="margin-bottom:.65rem;">
                        <label style="display:block; font-size:.78rem; font-weight:700; color:#555; margin-bottom:.2rem;">✈️ تێلیگرام (Telegram):</label>
                        <input type="text" id="ep-telegram" value="${escapeHTML(profile.telegram || '')}" placeholder="یوزەرنەیم: alan_krd" style="width:100%; padding:.65rem; border:1.5px solid #e2e8f0; border-radius:8px; font-size:14px; direction:ltr; text-align:left;">
                    </div>

                    <div style="margin-bottom:.65rem;">
                        <label style="display:block; font-size:.78rem; font-weight:700; color:#555; margin-bottom:.2rem;">🎵 تیکتۆک (TikTok):</label>
                        <input type="text" id="ep-tiktok" value="${escapeHTML(profile.tiktok || '')}" placeholder="یوزەرنەیم یان لینک" style="width:100%; padding:.65rem; border:1.5px solid #e2e8f0; border-radius:8px; font-size:14px; direction:ltr; text-align:left;">
                    </div>

                    <div>
                        <label style="display:block; font-size:.78rem; font-weight:700; color:#555; margin-bottom:.2rem;">🌐 فەیسبووک (Facebook):</label>
                        <input type="text" id="ep-facebook" value="${escapeHTML(profile.facebook || '')}" placeholder="لینک یان ناوی ئەکاونت" style="width:100%; padding:.65rem; border:1.5px solid #e2e8f0; border-radius:8px; font-size:14px; direction:ltr; text-align:left;">
                    </div>
                </div>

                <button type="submit" class="btn-primary" style="width:100%; padding:.85rem; font-size:1rem;">
                    💾 پاشەکەوتکردنی گۆڕانکارییەکان
                </button>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    const fileInput = document.getElementById('edit-avatar-file-input');
    const removeBtn = document.getElementById('btn-remove-avatar');
    const previewBox = document.getElementById('edit-avatar-preview-box');

    fileInput.addEventListener('change', async function() {
        if (!this.files || !this.files[0]) return;
        try {
            tempAvatar = await compressAndResizeImage(this.files[0], 220, 0.82);
            previewBox.innerHTML = renderAvatarHTML(profile.name, tempAvatar, 88);
            if (removeBtn) removeBtn.style.display = 'inline-block';
        } catch (e) {
            alert(e.message || 'هەڵە لە وێنەکەدا ڕوویدا');
        }
    });

    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            tempAvatar = '';
            fileInput.value = '';
            previewBox.innerHTML = renderAvatarHTML(profile.name, null, 88);
            removeBtn.style.display = 'none';
        });
    }

    const form = document.getElementById('edit-profile-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const newName = document.getElementById('ep-name').value.trim();
        const newDept = document.getElementById('ep-dept').value.trim();
        const newBio  = document.getElementById('ep-bio').value.trim();
        const newIg   = document.getElementById('ep-instagram').value.trim();
        const newTg   = document.getElementById('ep-telegram').value.trim();
        const newTt   = document.getElementById('ep-tiktok').value.trim();
        const newFb   = document.getElementById('ep-facebook').value.trim();

        if (!newName) {
            alert('تکایە ناوت بنووسە!');
            return;
        }

        const updates = {
            name: newName,
            dept: newDept,
            bio: newBio,
            instagram: newIg,
            telegram: newTg,
            tiktok: newTt,
            facebook: newFb
        };
        if (tempAvatar !== undefined) {
            updates.avatarUrl = tempAvatar;
        }

        // Save profile
        upsertProfile(newName, newDept, updates);

        // Update currentPlayer
        currentPlayer.name = newName;
        currentPlayer.dept = newDept;
        if (tempAvatar !== undefined) currentPlayer.avatarUrl = tempAvatar;
        localStorage.setItem('quiz_logged_in', JSON.stringify(currentPlayer));
        sessionStorage.setItem('quiz_logged_in', JSON.stringify(currentPlayer));
        savePlayer(currentPlayer);
        recordParticipant(currentPlayer);

        // Update welcome card and survivors
        showWelcomeCard(newName, newDept);
        renderSurvivorsList();
        renderHallOfFame();

        modal.remove();
        // Re-open profile modal
        window.openProfileModal(newName);
    });

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
};

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
        if (profile && profile.avatarUrl) {
            av.innerHTML = `<img src="${profile.avatarUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            av.style.background = 'transparent';
        } else {
            av.textContent = initials;
            av.style.background = color;
        }
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
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userInput = document.getElementById('l-username');
            const passInput = document.getElementById('l-password');
            const errEl     = document.getElementById('login-err');

            if (!userInput || !passInput) return;
            const u = userInput.value.trim().toLowerCase();
            const p = passInput.value.trim();

            const cleanU = u.replace(/\s+/g, '').toLowerCase();
            const cleanP = p.replace(/\s+/g, '');

            const users = getUsers();
            let user = users[cleanU] || users[u];
            const pHash = await sha256(p);

            // Special Admin login check directly on index.html:
            const isAdminUser = (
                cleanU === 'hama22#it' ||
                cleanU === 'hama22' ||
                cleanU === 'admin' ||
                cleanU === 'hama22:2'
            );
            const isAdminPass = (
                cleanP === 'WWE07700:' ||
                cleanP === 'WWE07700' ||
                cleanP.toLowerCase() === 'wwe07700:' ||
                cleanP.toLowerCase() === 'wwe07700' ||
                cleanP === 'WWE077001:' ||
                cleanP === 'WWE077001' ||
                cleanP.replace(/[:؛]/g, '') === 'WWE07700' ||
                cleanP.replace(/[:؛]/g, '').toLowerCase() === 'wwe07700' ||
                pHash === 'a9e64cf58faad8273903eab78ecf5af610d2a12cd5583efea46425b739cffa96' ||
                pHash === '482d5421cb29fee54d50c73d62efbc76c4acdf2a424f0e78faf352a7eadc794c'
            );
            const isAdminMatch = isAdminUser && isAdminPass;

            if (isAdminMatch) {
                user = {
                    username: 'hama22#it',
                    name: 'بەڕێوەبەری پەیمانگا',
                    dept: 'بەڕێوەبەرایەتی پەیمانگا ⚙️',
                    passwordHash: 'a9e64cf58faad8273903eab78ecf5af610d2a12cd5583efea46425b739cffa96',
                    isAdmin: true
                };
                users['hama22#it'] = user;
                users['hama22'] = user;
                saveUsers(users);
            }

            let isValid = false;
            if (user) {
                if (isAdminMatch) {
                    isValid = true;
                } else if (user.passwordHash && user.passwordHash === pHash) {
                    isValid = true;
                } else if (user.password && user.password === p) {
                    // Migrate legacy plain to hash
                    user.passwordHash = pHash;
                    delete user.password;
                    saveUsers(users);
                    isValid = true;
                }
            }

            if (!isValid) {
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

            const prof = getProfile(user.name);
            currentPlayer = {
                id: Date.now(),
                name: user.name,
                username: user.username,
                dept: user.dept,
                avatarUrl: (prof && prof.avatarUrl) || user.avatarUrl || '',
                joinedAt: new Date().toLocaleTimeString(),
                eliminated: false,
                score: 0
            };

            localStorage.setItem('quiz_logged_in', JSON.stringify(currentPlayer));
        sessionStorage.setItem('quiz_logged_in', JSON.stringify(currentPlayer));
            savePlayer(currentPlayer);
            recordParticipant(currentPlayer);
            logStudentActivity(user, 'login', '🔑 چوونەژوورەوەی سەرکەوتوو بۆ ناو ئەپ');
            renderSurvivorsList();
            renderHallOfFame();
            showWelcomeCard(user.name, user.dept);

            const overlay = document.getElementById('auth-overlay');
            if (overlay) overlay.classList.add('hidden');

            const profileBtn = document.getElementById('btn-view-profile');
            if (profileBtn) profileBtn.style.display = 'inline-flex';

            const curU = (currentPlayer.username || '').toLowerCase();
            if (curU === 'hama22#it' || curU === 'hama22' || currentPlayer.isAdmin) {
                const adminBtn = document.getElementById('btn-admin-panel');
                if (adminBtn) adminBtn.style.display = 'inline-flex';
                showToast('بەخێربێیت بەڕێوەبەر 👑', 'دەتوانیت لە ڕێگەی دوگمەی "⚙️ پەنێڵی ئادمین" بچیتە بەشی بەڕێوەبردن.', 'success', '⚙️', 6000);
            }
        });
    }

    // 2. Register Form Submit
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
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

            // Save user with SHA-256 hashed password
            const hashed = await sha256(pass);
            const avatarUrl = window.regAvatarDataUrl || '';
            users[username] = {
                username: username,
                name: name,
                dept: dept,
                avatarUrl: avatarUrl,
                passwordHash: hashed,
                createdAt: new Date().toLocaleDateString('ckb')
            };
            saveUsers(users);
            if (window.supabaseService && typeof window.supabaseService.pushUser === 'function') {
                window.supabaseService.pushUser(users[username]);
            }

            // Initialize profile
            upsertProfile(name, dept, {
                username: username,
                avatarUrl: avatarUrl,
                totalGames: 0,
                lastPlayed: new Date().toLocaleDateString('ckb')
            });

            // Automatically log them in!
            currentPlayer = {
                id: Date.now(),
                name: name,
                username: username,
                dept: dept,
                avatarUrl: avatarUrl,
                joinedAt: new Date().toLocaleTimeString(),
                eliminated: false,
                score: 0
            };
            window.regAvatarDataUrl = null;

            localStorage.setItem('quiz_logged_in', JSON.stringify(currentPlayer));
        sessionStorage.setItem('quiz_logged_in', JSON.stringify(currentPlayer));
            savePlayer(currentPlayer);
            recordParticipant(currentPlayer);
            logStudentActivity(currentPlayer, 'register', '📝 تۆمارکردنی ئەکاونتی نوێ لە پەیمانگا');
            renderSurvivorsList();
            renderHallOfFame();
            showWelcomeCard(name, dept);

            const overlay = document.getElementById('auth-overlay');
            if (overlay) overlay.classList.add('hidden');

            const profileBtn = document.getElementById('btn-view-profile');
            if (profileBtn) profileBtn.style.display = 'inline-flex';

            const curU = (currentPlayer.username || '').toLowerCase();
            if (curU === 'hama22#it' || curU === 'hama22' || currentPlayer.isAdmin) {
                const adminBtn = document.getElementById('btn-admin-panel');
                if (adminBtn) adminBtn.style.display = 'inline-flex';
                showToast('بەخێربێیت بەڕێوەبەر 👑', 'دەتوانیت لە ڕێگەی دوگمەی "⚙️ پەنێڵی ئادمین" بچیتە بەشی بەڕێوەبردن.', 'success', '⚙️', 6000);
            }
        });
    }

    // 3. Game screen buttons
    document.getElementById('btn-enter-game')?.addEventListener('click', () => {
        if (!currentPlayer) {
            window.switchTab('login');
            document.getElementById('auth-overlay')?.classList.remove('hidden');
            return;
        }

        const doorStatus = checkLiveDoorStatus();

        if (doorStatus.isLate) {
            alert("🔒 دەرگای پێشبڕکێ داخراوە!\n\nبەداخەوە پێشبڕکێکە دەستی پێکرد و کاتی ٢٠ چرکەی چوونەژوورەوە تەواو بوو.\n\nتۆ دواکەوتیت! بەپێی یاسای پێشبڕکێکە، لەبەر یەکسانی و دادپەروەری، خوێندکاری دواکەوتوو ناتوانێت بەشداری لەم خولەدا بکات.\n\nدەتوانیت لە ڕێگەی چات و تابلۆی ڕاستەوخۆوە بینەر بیت تا پێشبڕکێی داهاتوو!");
            return;
        }

        if (!doorStatus.isLive && !isQuizLiveNow()) {
            alert("⏳ بەڕێز، پێشبڕکێکە هێشتا دەستی پێنەکردووە!\n\nخەڵکی ناتوانن یاری بکەن تاکو کاتژمێر ١٠:٣٠ی شەو دەستپێدەکات، یان تاکو بەڕێوەبەری پەیمانگا پێشبڕکێکە دەستپێدەکات.\n\nتکایە چاوەڕوانی کاتژمێرەکە بە!");
            return;
        }

        // Authorize student into this live session
        if (doorStatus.token) {
            sessionStorage.setItem('quiz_entered_session', doorStatus.token);
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

    // 4. Live Chat Form Submit (Rate-Limited & Anti-Spam)
    let lastChatTimestamp = 0;
    const chatForm = document.getElementById('chat-form');
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            if (!input) return;
            const text = input.value.trim();
            if (!text) return;

            const now = Date.now();
            if (now - lastChatTimestamp < 2500) {
                showToast('⏳ تکایە کەمێک چاوەڕێ بکە', 'بۆ پاراستنی خێرایی، لانیکەم ٣ چرکە چاوەڕێ بکە لە نێوان نامەکاندا.', 'warning', '⚠️', 2500);
                return;
            }
            if (text.length > 200) {
                showToast('⚠️ نامەکەت زۆر درێژە', 'تکایە نامەکەت کەمتر بێت لە ٢٠٠ پیت.', 'warning', '⚠️', 2500);
                return;
            }
            lastChatTimestamp = now;

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

    // 7. Lifeline Audience
    document.getElementById('btn-lifeline-audience')?.addEventListener('click', () => {
        if (lifelineAudienceUsed) return;
        useLifelineAudience();
    });

    // 8. TTS Question Voice Reader
    document.getElementById('btn-read-question')?.addEventListener('click', () => {
        const q = questions[currentQuestionIndex];
        if (q) speakQuestionText(q.question);
    });

    // 9. Download Certificate
    document.getElementById('btn-download-cert')?.addEventListener('click', () => {
        window.openCertificateModal();
    });

    // 10. Spin Lucky Wheel
    document.getElementById('btn-spin-wheel')?.addEventListener('click', () => {
        openLuckyWheelModal();
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
    let s = {};
    try {
        s = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {};
    } catch (e) {}

    s.targetHour = s.targetHour ?? 22;
    s.targetMinute = s.targetMinute ?? 30;
    s.instituteName = s.instituteName || 'پەیمانگای پەروەردەیی و تەکنیکی';
    s.adminUsername = 'hama22#it';
    s.adminPasswordHash = 'a9e64cf58faad8273903eab78ecf5af610d2a12cd5583efea46425b739cffa96'; // SHA-256 of WWE07700:

    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s));
}

// ══ Stealth Admin Access ══
// 1) Keyboard shortcut: Ctrl + Shift + A
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        window.location.href = 'admin.html';
    }
});

// 2) Stealth 3-clicks on brand header
document.addEventListener('DOMContentLoaded', () => {
    let brandClicks = 0;
    let clickTimeout = null;
    const brand = document.querySelector('.brand');
    if (brand) {
        brand.addEventListener('click', () => {
            brandClicks++;
            clearTimeout(clickTimeout);
            if (brandClicks >= 3) {
                brandClicks = 0;
                window.location.href = 'admin.html';
            } else {
                clickTimeout = setTimeout(() => { brandClicks = 0; }, 1200);
            }
        });
    }
});

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
        let msgs = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAT));
        if (!msgs || !Array.isArray(msgs)) {
            msgs = [
                { id: 'msg_init_1', author: 'ئاریان (بەشی IT)', text: 'سڵاو لە هەمووان، ئەمشەو هەموومان سەعات ١٠:٣٠ ئامادەین! 🔥', time: '10:15 PM' },
                { id: 'msg_init_2', author: 'سۆزان (ژمێریاری)', text: 'ئەمشەو خەڵاتەکە هی منە ان شاء الله 🏆', time: '10:20 PM' }
            ];
            localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(msgs));
        }
        return msgs;
    } catch (e) {
        return [];
    }
}

function saveChatMessage(author, text) {
    const msgs = getChatMessages();
    const newMsg = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        author: author || 'خوێندکار',
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
    };
    msgs.push(newMsg);
    if (msgs.length > 60) msgs.shift();
    localStorage.setItem(STORAGE_KEYS.CHAT, JSON.stringify(msgs));
    renderChatMessages();
    if (window.supabaseService && typeof window.supabaseService.pushChatMessage === 'function') {
        window.supabaseService.pushChatMessage(newMsg);
    }
}

function renderChatMessages() {
    const box = document.getElementById('chat-messages-box');
    if (!box) return;
    const msgs = getChatMessages();
    box.innerHTML = '';
    msgs.forEach(m => {
        const prof = getProfile(m.author);
        const avatarUrl = prof ? prof.avatarUrl : '';
        const avatarHTML = renderAvatarHTML(m.author, avatarUrl, 26);

        const div = document.createElement('div');
        div.className = 'chat-msg';
        div.innerHTML = `
            <div class="chat-msg-author" style="display:flex; align-items:center; justify-content:space-between; gap:.5rem;">
                <div style="display:flex; align-items:center; gap:.4rem; cursor:pointer;" onclick="window.openProfileModal('${escapeHTML(m.author)}')">
                    ${avatarHTML}
                    <span style="font-weight:800; font-size:.82rem;">${escapeHTML(m.author)}</span>
                </div>
                <span class="chat-msg-time">${escapeHTML(m.time)}</span>
            </div>
            <div class="chat-msg-text" style="margin-top:.25rem; padding-right:.3rem;">${escapeHTML(m.text)}</div>
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

    const prof = getProfile(currentPlayer.name);
    const certPhotoHTML = (prof && prof.avatarUrl)
        ? `<div style="margin:0.4rem auto; width:54px; height:54px; border-radius:50%; overflow:hidden; border:2.5px solid #d97706; box-shadow:0 3px 10px rgba(0,0,0,.15); display:inline-block;"><img src="${prof.avatarUrl}" style="width:100%; height:100%; object-fit:cover;"></div>`
        : '';

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
                ${certPhotoHTML}
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
//  LIVE CHECK & COUNTDOWN TIMER (WITH 20s DOOR)
// ══════════════════════════════════════════════════
function getLiveSession() {
    try {
        const s = localStorage.getItem(STORAGE_KEYS.LIVE_SESSION);
        return s ? JSON.parse(s) : null;
    } catch (e) {
        return null;
    }
}

function checkLiveDoorStatus() {
    const session = getLiveSession();
    if (!session || !session.isActive) {
        return { isLive: false, doorOpen: false, isLate: false, timeLeft: 0 };
    }

    const now = Date.now();
    const timeLeft = Math.max(0, Math.ceil((session.doorsCloseAt - now) / 1000));
    const alreadyEntered = sessionStorage.getItem('quiz_entered_session') === session.token;

    if (timeLeft > 0) {
        // Doors are currently OPEN (20s entry window active)
        return { isLive: true, doorOpen: true, isLate: false, timeLeft, token: session.token };
    } else {
        // 20 seconds have expired!
        if (alreadyEntered) {
            return { isLive: true, doorOpen: false, isLate: false, timeLeft: 0, token: session.token };
        } else {
            // Late arrival! Cannot play!
            return { isLive: true, doorOpen: false, isLate: true, timeLeft: 0, token: session.token };
        }
    }
}

function isQuizLiveNow() {
    if (isLiveForced) return true;

    // 1. Live Session with 20s Door
    const session = getLiveSession();
    if (session && session.isActive) {
        return true;
    }

    // 2. Fallback Admin Live Toggle
    const adminLive = localStorage.getItem('institute_night_quiz_live_active');
    if (adminLive === 'true') return true;

    // 3. Automatic 10:30 PM Check
    const now = new Date();
    const s = getSettings();
    const h = s.targetHour ?? 22;
    const m = s.targetMinute ?? 30;

    let target = new Date();
    target.setHours(h, m, 0, 0);

    const diff = target.getTime() - now.getTime();
    if (diff <= 0 && diff > -25 * 60 * 1000) {
        return true;
    }

    return false;
}

let notifSent5m = false;
let notifSent1m = false;
let notifSentLive = false;

function initCountdownTimer() {
    const hoursEl    = document.getElementById('timer-hours');
    const minutesEl  = document.getElementById('timer-minutes');
    const secondsEl  = document.getElementById('timer-seconds');
    const liveNotice = document.getElementById('live-status-notice');
    const enterBtn   = document.getElementById('btn-enter-game');

    const doorBox    = document.getElementById('door-countdown-box');
    const lateBox    = document.getElementById('late-lockout-box');
    const doorSec    = document.getElementById('door-seconds-left');
    const doorProg   = document.getElementById('door-progress-bar');

    function update() {
        const doorStatus = checkLiveDoorStatus();
        const live = doorStatus.isLive || isQuizLiveNow();

        // ── 20-Second Live Entry & Latecomer Handling ──
        if (doorStatus.doorOpen) {
            // Door is currently OPEN (20s countdown active)
            if (doorBox) doorBox.style.display = 'block';
            if (lateBox) lateBox.style.display = 'none';
            if (doorSec) doorSec.textContent = doorStatus.timeLeft;
            if (doorProg) doorProg.style.width = `${(doorStatus.timeLeft / 20) * 100}%`;

            if (enterBtn) {
                enterBtn.disabled = false;
                enterBtn.innerHTML = `<span>🚨 پێشبڕکێ کرایەوە! بەشدار بە ئێستا (${doorStatus.timeLeft}s)</span>`;
                enterBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                enterBtn.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                enterBtn.style.cursor = 'pointer';
            }
        } else if (doorStatus.isLate) {
            // 20 seconds expired and student did NOT join in time -> LOCKED!
            if (doorBox) doorBox.style.display = 'none';
            if (lateBox) lateBox.style.display = 'block';

            if (enterBtn) {
                enterBtn.disabled = true;
                enterBtn.innerHTML = '<span>🔒 دەرگا داخراوە (تۆ دواکەوتیت)</span>';
                enterBtn.style.background = 'linear-gradient(135deg, #991b1b, #7f1d1d)';
                enterBtn.style.boxShadow = 'none';
                enterBtn.style.cursor = 'not-allowed';
            }
        } else {
            // Standard waiting screen or player already inside
            if (doorBox) doorBox.style.display = 'none';
            if (lateBox) lateBox.style.display = 'none';

            if (enterBtn) {
                enterBtn.disabled = false;
                if (live) {
                    enterBtn.innerHTML = '<span>🔴 پێشبڕکێ دەستیپێکرد! بەشدار بە ئێستا</span>';
                    enterBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                    enterBtn.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                    enterBtn.style.cursor = 'pointer';
                } else {
                    enterBtn.innerHTML = '<span>🔒 چاوەڕوانی کاتژمێر ١٠:٣٠ بە (پێشبڕکێ دەستپێدەکات)</span>';
                    enterBtn.style.background = 'linear-gradient(135deg, #64748b, #475569)';
                    enterBtn.style.boxShadow = 'none';
                    enterBtn.style.cursor = 'pointer';
                }
            }
        }

        if (live) {
            if (!notifSentLive) {
                notifSentLive = true;
                triggerNotification('🔴 پێشبڕکێکە دەستی پێکرد!', 'دەرگای پێشبڕکێ کراوەتەوە، تەنها ٢٠ چرکەت لەبەردەستە بۆ بەشداریکردن!', 'success', '🏆');
            }
            if (hoursEl) hoursEl.textContent = '00';
            if (minutesEl) minutesEl.textContent = '00';
            if (secondsEl) secondsEl.textContent = '00';
            if (liveNotice) {
                if (doorStatus.doorOpen) {
                    liveNotice.innerHTML = `🚨 <strong>دەرگای چوونەژوورەوە کراوەیە! کاتی ماوە: ${doorStatus.timeLeft} چرکە</strong>`;
                    liveNotice.style.color = '#10b981';
                } else if (doorStatus.isLate) {
                    liveNotice.innerHTML = '🔒 <strong>دەرگای پێشبڕکێ داخرا! خوێندکارانی دواکەوتوو ناتوانن یاری بکەن.</strong>';
                    liveNotice.style.color = '#dc2626';
                } else {
                    liveNotice.innerHTML = '🔴 <strong>پێشبڕکێ ئێستا چالاکە! تکایە دوگمەی خوارەوە دابگرە بۆ دەستپێکردن</strong>';
                    liveNotice.style.color = '#10b981';
                }
            }
            return;
        } else {
            notifSentLive = false;
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

        // Notification thresholds
        if (rem > 0 && rem <= 5 * 60 * 1000 && rem > 4.8 * 60 * 1000 && !notifSent5m) {
            notifSent5m = true;
            triggerNotification('⏰ تەنها ٥ خولەک ماوە!', 'خەریکە کاتژمێر دەبێتە ١٠:٣٠، کەمێکی تر پێشبڕکێکە دەستپێدەکات!', 'warning', '⏳');
        }
        if (rem > 0 && rem <= 60 * 1000 && rem > 50 * 1000 && !notifSent1m) {
            notifSent1m = true;
            triggerNotification('🚨 تەنها یەک خولەک ماوە!', 'ئامادەبە، چەند چرکەیەکی کەمی ماوە بۆ دەستپێکردنی پێشبڕکێکە!', 'danger', '⚡');
        }

        if (liveNotice) {
            const h = s.targetHour ?? 22;
            const m = s.targetMinute ?? 30;
            liveNotice.innerHTML = `⏳ پێشبڕکێ هەموو شەوێک لە کاتژمێر <strong>${h % 12 || 12}:${String(m).padStart(2,'0')} شەو</strong> دەستپێدەکات.<br><small style="color:var(--text-dim);">خەڵکی ناتوانن یاری بکەن تاکو بەڕێوەبەر دەستیپێنەکات یان کاتەکەی نەگات.</small>`;
            liveNotice.style.color = '';
        }
    }

    update();
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(update, 1000);

    // Cross-tab real-time sync when Admin triggers 20s live or moderates chat
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEYS.LIVE_SESSION || e.key === 'institute_night_quiz_live_active') {
            update();
        }
        if (e.key === STORAGE_KEYS.CHAT) {
            renderChatMessages();
        }
    });
}

// ══════════════════════════════════════════════════
//  GAME FLOW & ELIMINATION
// ══════════════════════════════════════════════════
let lifelineAudienceUsed = false;

function startGame() {
    currentQuestionIndex = 0;
    sessionCorrect = 0;
    sessionAnswered = 0;
    lifeline5050Used = false;
    lifelineTimeUsed = false;
    lifelineAudienceUsed = false;

    if (currentPlayer) {
        logStudentActivity(currentPlayer, 'game_start', '⚡ دەستپێکردنی پێشبڕکێ');
    }

    // Reset Lifeline buttons
    const b50 = document.getElementById('btn-lifeline-5050');
    const bTime = document.getElementById('btn-lifeline-time');
    const bAudience = document.getElementById('btn-lifeline-audience');
    if (b50) { b50.disabled = false; }
    if (bTime) { bTime.disabled = false; }
    if (bAudience) { bAudience.disabled = false; }

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

// ── Lifeline Audience (ڕای جەماوەر) ──
function useLifelineAudience() {
    if (lifelineAudienceUsed) return;
    lifelineAudienceUsed = true;
    const btn = document.getElementById('btn-lifeline-audience');
    if (btn) btn.disabled = true;

    const q = questions[currentQuestionIndex];
    if (!q) return;

    if (window.soundFX) window.soundFX.playNotification();

    const correctIdx = q.correctIndex;
    const correctPct = Math.floor(Math.random() * 15) + 65; // 65% - 79%
    let remaining = 100 - correctPct;

    const pcts = [0, 0, 0, 0];
    pcts[correctIdx] = correctPct;

    const wrongIndexes = [0, 1, 2, 3].filter(i => i !== correctIdx);
    const p1 = Math.floor(Math.random() * (remaining - 4)) + 1;
    remaining -= p1;
    const p2 = Math.floor(Math.random() * (remaining - 2)) + 1;
    const p3 = remaining - p2;

    pcts[wrongIndexes[0]] = p1;
    pcts[wrongIndexes[1]] = p2;
    pcts[wrongIndexes[2]] = p3;

    const letters = ['(أ)', '(ب)', '(ج)', '(د)'];

    const modal = document.createElement('div');
    modal.id = 'audience-modal';
    modal.style.cssText = `
        position:fixed; inset:0; z-index:700;
        background:rgba(0,0,0,.55); backdrop-filter:blur(6px);
        display:flex; align-items:center; justify-content:center;
        padding:1rem;
    `;

    modal.innerHTML = `
        <div style="background:var(--bg-card); border-radius:22px; width:100%; max-width:420px; padding:1.5rem; text-align:right; border:1.5px solid var(--border); box-shadow:0 20px 50px rgba(0,0,0,.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.1rem; border-bottom:1px solid var(--border); padding-bottom:.6rem;">
                <h3 style="font-size:1.1rem; font-weight:900; margin:0; color:var(--text-main);">
                    📊 ئەنجامی ڕای جەماوەری خوێندکاران
                </h3>
                <button onclick="document.getElementById('audience-modal').remove()" style="background:var(--bg-muted); border:none; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:.9rem; color:var(--text-main);">✕</button>
            </div>
            <p style="font-size:.82rem; color:var(--text-muted); margin-bottom:1rem;">
                ڕاپرسی دەنگدانی خوێندکاران بۆ ئەم پرسیارە بەمشێوەیە دابەشبووە:
            </p>
            ${q.options.map((opt, i) => `
                <div class="poll-bar-row">
                    <div class="poll-label-row">
                        <span style="color:var(--text-main); font-size:.84rem;">${letters[i]} ${escapeHTML(opt)}</span>
                        <span style="color:${i === correctIdx ? '#10b981' : 'var(--text-muted)'}; font-weight:900;">${pcts[i]}%</span>
                    </div>
                    <div class="poll-bar-bg">
                        <div class="poll-bar-fill" style="width:0%; ${i === correctIdx ? 'background:linear-gradient(135deg,#10b981,#059669);' : ''}" data-target-width="${pcts[i]}%"></div>
                    </div>
                </div>
            `).join('')}
            <button onclick="document.getElementById('audience-modal').remove()" class="btn-primary" style="width:100%; margin-top:.75rem; padding:.75rem;">
                ✅ تێگەیشتم، وەڵام دەدەمەوە
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    setTimeout(() => {
        modal.querySelectorAll('.poll-bar-fill').forEach(bar => {
            bar.style.width = bar.getAttribute('data-target-width');
        });
    }, 100);

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ── Lucky Wheel Implementation (چەرخی بەختی کۆتایی) ──
function openLuckyWheelModal() {
    const existing = document.getElementById('lucky-wheel-modal');
    if (existing) existing.remove();

    const prizes = [
        { label: '🎁 کارتی 5GB ئینتەرنێت', color: '#ff6b35' },
        { label: '🎧 هێدفۆنی بێلینک', color: '#805ad5' },
        { label: '👑 بڕوانامەی زێڕین', color: '#d69e2e' },
        { label: '💎 ١٠٠ خاڵ پرۆفایل', color: '#3182ce' },
        { label: '🚀 پاڵەوانی هەفتە', color: '#e53e3e' },
        { label: '🌟 سوپاسنامەی فەرمی', color: '#38a169' }
    ];

    const modal = document.createElement('div');
    modal.id = 'lucky-wheel-modal';
    modal.style.cssText = `
        position:fixed; inset:0; z-index:800;
        background:rgba(0,0,0,.7); backdrop-filter:blur(8px);
        display:flex; align-items:center; justify-content:center;
        padding:1rem;
    `;

    modal.innerHTML = `
        <div style="background:var(--bg-card); border-radius:24px; width:100%; max-width:440px; padding:1.5rem; text-align:center; border:2px solid #ffd1b3; box-shadow:0 25px 60px rgba(0,0,0,.4); position:relative;">
            <button onclick="document.getElementById('lucky-wheel-modal').remove()" style="position:absolute; top:1rem; left:1rem; background:var(--bg-muted); border:none; width:34px; height:34px; border-radius:50%; cursor:pointer; font-size:1.1rem; color:var(--text-main);">✕</button>
            <h3 style="font-size:1.25rem; font-weight:900; margin:0 0 .3rem; color:#ff6b35;">🎡 چەرخی بەختی براوەکان</h3>
            <p style="font-size:.82rem; color:var(--text-muted); margin-bottom:1rem;">چەرخەکە بسووڕێنە بۆ بردنەوەی خەڵاتێکی سەرسوڕهێنەر!</p>

            <div class="wheel-container">
                <div class="wheel-pointer"></div>
                <div class="wheel-center-pin">🎯</div>
                <canvas id="wheel-canvas" width="280" height="280"></canvas>
            </div>

            <div id="wheel-result" style="display:none; font-size:1.1rem; font-weight:900; color:#10b981; margin:1rem 0; animation:toastSlideDown .3s ease;"></div>

            <button type="button" id="btn-spin-now" class="btn-primary" style="background:linear-gradient(135deg,#ff6b35,#e05a28); width:100%; padding:.85rem; font-size:1.05rem;">
                🎯 ئێستا بیسووڕێنە (SPIN)
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const numSegments = prizes.length;
    const arcSize = (2 * Math.PI) / numSegments;
    let startAngle = 0;

    function drawWheel() {
        ctx.clearRect(0, 0, 280, 280);
        const cx = 140;
        const cy = 140;
        const r = 135;

        for (let i = 0; i < numSegments; i++) {
            const angle = startAngle + i * arcSize;
            ctx.beginPath();
            ctx.fillStyle = prizes[i].color;
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, angle, angle + arcSize);
            ctx.lineTo(cx, cy);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle + arcSize / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Vazirmatn, sans-serif';
            ctx.fillText(prizes[i].label, r - 16, 5);
            ctx.restore();
        }
    }

    drawWheel();

    const spinBtn = document.getElementById('btn-spin-now');
    let isSpinning = false;

    if (spinBtn) {
        spinBtn.addEventListener('click', () => {
            if (isSpinning) return;
            isSpinning = true;
            spinBtn.disabled = true;
            spinBtn.style.opacity = '0.6';

            const winningIndex = Math.floor(Math.random() * numSegments);
            const extraRotations = 5 + Math.floor(Math.random() * 3);
            const targetAngle = (3 * Math.PI / 2) - (winningIndex * arcSize + arcSize / 2);
            const totalRotation = extraRotations * (2 * Math.PI) + targetAngle - (startAngle % (2 * Math.PI));

            const duration = 4500;
            const startTime = performance.now();
            const initialAngle = startAngle;

            function animate(now) {
                const elapsed = now - startTime;
                const progress = Math.min(1, elapsed / duration);
                const easeOut = 1 - Math.pow(1 - progress, 3);
                startAngle = initialAngle + totalRotation * easeOut;
                drawWheel();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    isSpinning = false;
                    const wonPrize = prizes[winningIndex];
                    const resEl = document.getElementById('wheel-result');
                    if (resEl) {
                        resEl.innerHTML = `🎉 پیرۆزە! بەدەستت هێنا: <strong>${wonPrize.label}</strong>`;
                        resEl.style.display = 'block';
                    }
                    if (window.soundFX) window.soundFX.playFanfare();
                    triggerConfetti();
                    spinBtn.textContent = '🔄 دووبارە سووڕاندنەوە';
                    spinBtn.disabled = false;
                    spinBtn.style.opacity = '1';
                }
            }

            requestAnimationFrame(animate);
        });
    }

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function checkExistingSession() {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_PLAYER);
    if (!saved) return;
    try {
        const player = JSON.parse(saved);
        if (!verifyPlayerIntegrity(player)) {
            showToast('⚠️ دەستکاریکردنی نایاسایی دەستنیشانکرا!', 'داتاکانت لە براوسەر دەستکاری کرابوون و پوچەڵکرانەوە.', 'danger', '🛑');
            resetPlayerSession();
            return;
        }
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

let currentQuestionStartTime = 0;
let currentQuestionDuration = 15;

function startQuestionTimer(duration) {
    clearInterval(questionTimer);
    timeLeft = duration;
    currentQuestionDuration = duration;
    currentQuestionStartTime = Date.now();
    const numEl = document.getElementById('timer-number');
    const progEl = document.getElementById('timer-progress');
    const circumference = 125.6;

    function tick() {
        if (numEl) numEl.textContent = timeLeft;
        if (progEl) {
            const pct = Math.max(0, timeLeft / duration);
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

    // ══ Anti-Cheat: Wall-clock Timer Validation ══
    const elapsedSeconds = (Date.now() - currentQuestionStartTime) / 1000;
    const maxAllowedSeconds = currentQuestionDuration + (lifelineTimeUsed ? 10 : 0) + 1.8;
    if (elapsedSeconds > maxAllowedSeconds) {
        handleElimination('⚠️ کاتی یاسایی وەڵامدانەوەت بەسەرچوو بەپێی کاتژمێری فەرمی سیستەم! (Anti-Cheat)');
        return;
    }

    const q = questions[currentQuestionIndex];
    if (!q) return;

    const btns = document.querySelectorAll('.option-btn');
    btns.forEach(b => b.disabled = true);
    sessionAnswered++;

    if (idx === q.correctIndex) {
        btns[idx].classList.add('correct');
        if (window.soundFX) window.soundFX.playCorrect();
        sessionCorrect++;
        if (currentPlayer) currentPlayer.score = (currentPlayer.score || 0) + 10;
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
            saveGameHistory(currentPlayer.name, false, sessionCorrect, questions.length, {
                reason: reason || '❌ وەڵامی هەڵە یان تەواوبوونی کاتی پرسیارەکە',
                score: Math.round(((sessionCorrect || 0) / (questions.length || 1)) * 100)
            });
            logStudentActivity(currentPlayer, 'eliminated', '💀 دەرکرا: ' + (reason || 'وەڵامی هەڵە'));
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
            const rank = getRank(profile.wins || 0);
            const avatarHTML = renderAvatarHTML(profile.name, profile.avatarUrl, 46);
            miniEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:.75rem; justify-content:center; margin-bottom:1rem;">
                    ${avatarHTML}
                    <div style="text-align:right;">
                        <div style="font-weight:800; font-size:.9rem;">${escapeHTML(profile.name)}</div>
                        <div style="font-size:.78rem; color:${rank.color}; font-weight:700;">
                            ${rank.icon} ${rank.label} · ${profile.wins || 0} براوە لە ${profile.totalGames || 0} یاری
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
            saveGameHistory(currentPlayer.name, true, sessionCorrect, questions.length, {
                reason: '🏆 سەرکەوتووانە هەموو پرسیارەکان بە دروستی وەڵامدرانەوە و بووە براوەی خەڵاتی ئەمشەو!',
                score: 100
            });
            logStudentActivity(currentPlayer, 'victory', '🏆 بووە براوەی خەڵاتی پێشبڕکێکە');
        }
    }

    renderSurvivorsList();
    renderHallOfFame();
    showScreen(document.getElementById('screen-victory'));

    const nameEl = document.getElementById('victory-player-name');
    if (nameEl && currentPlayer) nameEl.textContent = currentPlayer.name;

    const miniVictEl = document.getElementById('victory-profile-mini');
    if (miniVictEl && currentPlayer) {
        const profile = getProfile(currentPlayer.name);
        if (profile) {
            const rank = getRank(profile.wins || 0);
            const avatarHTML = renderAvatarHTML(profile.name, profile.avatarUrl, 50);
            miniVictEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:.75rem; justify-content:center; margin-bottom:.75rem;">
                    ${avatarHTML}
                    <div style="text-align:right;">
                        <div style="font-weight:800;">${escapeHTML(profile.name)}</div>
                        <div style="font-size:.8rem; color:${rank.color}; font-weight:700;">
                            ${rank.icon} ${rank.label} — کۆی براوەکان: ${profile.wins || 0}
                        </div>
                    </div>
                </div>`;
        }
    }

    triggerConfetti();
}

// ══════════════════════════════════════════════════
//  LOCALSTORAGE HELPERS & INTEGRITY CHECK (ANTI-CHEAT)
// ══════════════════════════════════════════════════
const CLIENT_INTEGRITY_SALT = 'INST_QUIZ_SECURE_TOKEN_2026';

function generateIntegritySignature(p) {
    if (!p) return '';
    const raw = `${p.id || 0}_${p.username || ''}_${p.name || ''}_${p.eliminated ? '1' : '0'}_${p.won ? '1' : '0'}_${p.score || 0}_${CLIENT_INTEGRITY_SALT}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < raw.length; i++) {
        hash ^= raw.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16);
}

function savePlayer(p) {
    if (p) {
        p._sig = generateIntegritySignature(p);
    }
    localStorage.setItem(STORAGE_KEYS.CURRENT_PLAYER, JSON.stringify(p));
}

function verifyPlayerIntegrity(p) {
    if (!p) return false;
    if (!p._sig) return true; // Legacy first run migration
    return p._sig === generateIntegritySignature(p);
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
        const profile = getProfile(p.name);
        const rank = profile ? getRank(profile.wins || 0) : RANKS[0];
        const avatarUrl = (profile && profile.avatarUrl) || p.avatarUrl || '';
        const avatarHTML = renderAvatarHTML(p.name, avatarUrl, 38);

        const item = document.createElement('div');
        item.className = `survivor-item ${p.eliminated ? 'eliminated' : ''}`;
        item.style.cursor = 'pointer';
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:.65rem; min-width:0;">
                ${avatarHTML}
                <div style="min-width:0;">
                    <div style="font-weight:800; font-size:.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${escapeHTML(p.name)}
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
//  🏛️ HALL OF FAME (تەلاری پاڵەوانانی پەیمانگا)
// ══════════════════════════════════════════════════
let currentHofSort = 'wins';

window.switchHofSort = function(sortType) {
    currentHofSort = sortType;
    const btnWins = document.getElementById('hof-sort-wins');
    const btnAcc = document.getElementById('hof-sort-accuracy');
    if (btnWins) btnWins.classList.toggle('active', sortType === 'wins');
    if (btnAcc) btnAcc.classList.toggle('active', sortType === 'accuracy');
    renderHallOfFame();
};

function initDefaultInstituteProfiles() {
    let profiles = getAllProfiles();
    const seeds = [
        {
            name: 'ئاریان کامەران',
            dept: 'تەکنەلۆژیای زانیاری',
            avatarUrl: '',
            bio: 'شەوان کاتژمێر ١٠:٣٠ کاتی بردنەوەیە! 🏆🔥',
            instagram: 'aryan.it',
            wins: 12,
            totalGames: 14,
            eliminations: 2,
            totalCorrect: 68,
            totalAnswered: 70
        },
        {
            name: 'سۆزان ئەحمەد',
            dept: 'ژمێریاری',
            avatarUrl: '',
            bio: 'وردبینی و خێرایی کلیلی سەرکەوتنە ⚡',
            telegram: 'sozan_acc',
            wins: 9,
            totalGames: 11,
            eliminations: 2,
            totalCorrect: 53,
            totalAnswered: 55
        },
        {
            name: 'شاییستە مەحمود',
            dept: 'کارگێڕی',
            avatarUrl: '',
            bio: 'زانست و پێشبڕکێ هەمیشە سەردەکەون 📚',
            tiktok: 'shayista_m',
            wins: 7,
            totalGames: 9,
            eliminations: 2,
            totalCorrect: 44,
            totalAnswered: 45
        },
        {
            name: 'دڵشاد عەلی',
            dept: 'بەشی کۆمپیوتەر',
            avatarUrl: '',
            bio: 'کۆدەکان ڕاستین و نمرەکان بەرزن 💻',
            wins: 5,
            totalGames: 7,
            eliminations: 2,
            totalCorrect: 32,
            totalAnswered: 35
        },
        {
            name: 'لانە سەردار',
            dept: 'بەشی ئینگلیزی',
            avatarUrl: '',
            bio: 'Keep learning and win every night 🌟',
            wins: 4,
            totalGames: 6,
            eliminations: 2,
            totalCorrect: 26,
            totalAnswered: 30
        }
    ];

    let changed = false;
    seeds.forEach(s => {
        const key = s.name.trim().toLowerCase();
        if (!profiles[key]) {
            profiles[key] = {
                ...s,
                firstJoined: '٢٠٢٤/١/١',
                facebook: '',
                lastPlayed: 'ئەمشەو'
            };
            changed = true;
        }
    });

    if (changed) {
        localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    }
}

function renderHallOfFame() {
    const podiumEl = document.getElementById('podium-container');
    const runnersListEl = document.getElementById('hof-runners-list');
    if (!podiumEl) return;

    initDefaultInstituteProfiles();
    const all = getAllProfiles();
    const list = Object.values(all);

    list.forEach(p => {
        p.wins = p.wins || 0;
        p.totalCorrect = p.totalCorrect || 0;
        p.totalAnswered = p.totalAnswered || 0;
        p.accuracy = p.totalAnswered > 0 ? Math.round((p.totalCorrect / p.totalAnswered) * 100) : 0;
    });

    if (currentHofSort === 'wins') {
        list.sort((a, b) => b.wins - a.wins || b.accuracy - a.accuracy || b.totalCorrect - a.totalCorrect);
    } else {
        list.sort((a, b) => b.accuracy - a.accuracy || b.wins - a.wins || b.totalCorrect - a.totalCorrect);
    }

    const first  = list[0] || null;
    const second = list[1] || null;
    const third  = list[2] || null;

    // Podium layout: Rank 2 (Silver), Rank 1 (Gold in center), Rank 3 (Bronze)
    const podiumItems = [
        { rank: 2, data: second, colClass: 'podium-col-2', crown: '🥈', badge: '٢', label: 'پلەی دووەم', pedNum: '2' },
        { rank: 1, data: first,  colClass: 'podium-col-1', crown: '👑', badge: '١', label: 'پاڵەوانی پەیمانگا', pedNum: '1' },
        { rank: 3, data: third,  colClass: 'podium-col-3', crown: '🥉', badge: '٣', label: 'پلەی سێیەم', pedNum: '3' }
    ];

    podiumEl.innerHTML = '';
    podiumItems.forEach(item => {
        if (!item.data) return;
        const p = item.data;
        const avatarSize = item.rank === 1 ? 64 : (item.rank === 2 ? 54 : 50);
        const avatarHTML = renderAvatarHTML(p.name, p.avatarUrl, avatarSize);
        const statText = currentHofSort === 'wins'
            ? `🏆 ${p.wins} بردنەوە`
            : `🎯 ${p.accuracy}٪ دروستی (${p.totalCorrect} نمرە)`;

        const col = document.createElement('div');
        col.className = `podium-column ${item.colClass}`;
        col.title = `کلیک بکە بۆ بینینی پرۆفایلی ${escapeHTML(p.name)}`;
        col.innerHTML = `
            <div class="podium-crown">${item.crown}</div>
            <div class="podium-avatar-wrap">
                ${avatarHTML}
                <div class="podium-rank-badge">${item.badge}</div>
            </div>
            <div class="podium-name">${escapeHTML(p.name)}</div>
            <div class="podium-dept">${escapeHTML(p.dept || 'پەیمانگا')}</div>
            <div class="podium-stat-pill">${statText}</div>
            <div class="podium-pedestal">
                <div class="podium-pedestal-num">${item.pedNum}</div>
                <div class="podium-pedestal-label">${item.label}</div>
            </div>
        `;
        col.addEventListener('click', () => window.openProfileModal(p.name));
        podiumEl.appendChild(col);
    });

    // Runners-Up (Ranks 4-10)
    if (runnersListEl) {
        runnersListEl.innerHTML = '';
        const runners = list.slice(3, 10);
        if (runners.length === 0) {
            runnersListEl.innerHTML = '<div style="font-size:.8rem;color:var(--text-dim);text-align:center;padding:.8rem;">بەشداربووی دیکە نییە</div>';
        } else {
            runners.forEach((p, idx) => {
                const rankNum = idx + 4;
                const avatarHTML = renderAvatarHTML(p.name, p.avatarUrl, 36);
                const statText = currentHofSort === 'wins'
                    ? `🏆 ${p.wins} بردنەوە`
                    : `🎯 ${p.accuracy}٪ دروستی`;

                const card = document.createElement('div');
                card.className = 'hof-runner-card';
                card.title = `کلیک بکە بۆ بینینی پرۆفایلی ${escapeHTML(p.name)}`;
                card.innerHTML = `
                    <div style="display:flex; align-items:center; gap:.65rem; min-width:0;">
                        <div class="hof-runner-rank-num">#${rankNum}</div>
                        ${avatarHTML}
                        <div style="min-width:0;">
                            <div style="font-weight:800; font-size:.86rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${escapeHTML(p.name)}
                            </div>
                            <div style="font-size:.7rem; color:var(--text-dim);">
                                ${escapeHTML(p.dept || 'پەیمانگا')}
                            </div>
                        </div>
                    </div>
                    <div class="hof-runner-stat-pill">${statText}</div>
                `;
                card.addEventListener('click', () => window.openProfileModal(p.name));
                runnersListEl.appendChild(card);
            });
        }
    }
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
