// ══════════════════════════════════════════════════
//  🌐 SUPABASE CLOUD INTEGRATION — supabase.js
// ══════════════════════════════════════════════════

const SUPABASE_CONFIG = {
    url: 'https://vrmqbjmwlmibqjinuwag.supabase.co',
    key: 'sb_publishable_ohSxsxMFJ91bP674dF3Yqg_ZAAaj03b'
};

// Initialize Supabase JS Client if available via CDN
if (window.supabase && typeof window.supabase.createClient === 'function') {
    try {
        window.sbClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
        console.log('✅ Supabase SDK Client Initialized Successfully');
    } catch (e) {
        console.warn('Supabase SDK initialization notice:', e);
    }
}

// ══ Direct REST API Client (Works even if CDN script fails) ══
async function sbRest(endpoint, method = 'GET', body = null, extraHeaders = {}) {
    const url = `${SUPABASE_CONFIG.url}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': SUPABASE_CONFIG.key,
        'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...extraHeaders
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    options.signal = controller.signal;

    try {
        const res = await fetch(url, options);
        clearTimeout(timeout);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `HTTP ${res.status}`);
        }
        return await res.json().catch(() => null);
    } catch (e) {
        clearTimeout(timeout);
        // Silently handle offline/aborted gracefully
        return null;
    }
}

// ══════════════════════════════════════════════════
//  SUPABASE SERVICE API
// ══════════════════════════════════════════════════
window.supabaseService = {
    config: SUPABASE_CONFIG,

    // ── 1. Users Sync ──
    async pushUser(user) {
        if (!user || !user.username) return;
        return await sbRest('quiz_users', 'POST', {
            username: user.username.trim().toLowerCase(),
            name: user.name,
            dept: user.dept || '',
            avatar_url: user.avatarUrl || '',
            password_hash: user.passwordHash || ''
        }, { 'Prefer': 'resolution=merge-duplicates' });
    },

    async pullUsers() {
        const rows = await sbRest('quiz_users?select=*');
        if (Array.isArray(rows) && rows.length > 0) {
            const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '{}');
            rows.forEach(r => {
                users[r.username] = {
                    username: r.username,
                    name: r.name,
                    dept: r.dept,
                    avatarUrl: r.avatar_url,
                    passwordHash: r.password_hash,
                    createdAt: r.created_at
                };
            });
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
            return users;
        }
        return null;
    },

    // ── 2. Profiles Sync ──
    async pushProfile(profile) {
        if (!profile || !profile.name) return;
        return await sbRest('quiz_profiles', 'POST', {
            name: profile.name,
            username: profile.username || '',
            dept: profile.dept || '',
            avatar_url: profile.avatarUrl || '',
            bio: profile.bio || '',
            instagram: profile.instagram || '',
            telegram: profile.telegram || '',
            tiktok: profile.tiktok || '',
            facebook: profile.facebook || '',
            wins: profile.wins || 0,
            total_games: profile.totalGames || 0,
            eliminations: profile.eliminations || 0,
            total_correct: profile.totalCorrect || 0,
            total_answered: profile.totalAnswered || 0,
            last_played: profile.lastPlayed || ''
        }, { 'Prefer': 'resolution=merge-duplicates' });
    },

    async pullProfiles() {
        const rows = await sbRest('quiz_profiles?select=*');
        if (Array.isArray(rows) && rows.length > 0) {
            const profiles = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES) || '{}');
            rows.forEach(r => {
                const key = r.name.trim().toLowerCase();
                profiles[key] = {
                    name: r.name,
                    username: r.username,
                    dept: r.dept,
                    avatarUrl: r.avatar_url,
                    bio: r.bio,
                    instagram: r.instagram,
                    telegram: r.telegram,
                    tiktok: r.tiktok,
                    facebook: r.facebook,
                    wins: r.wins,
                    totalGames: r.total_games,
                    eliminations: r.eliminations,
                    totalCorrect: r.total_correct,
                    totalAnswered: r.total_answered,
                    lastPlayed: r.last_played
                };
            });
            localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
            return profiles;
        }
        return null;
    },

    // ── 3. Live Activity Log Sync ──
    async pushActivity(activity) {
        if (!activity || !activity.id) return;
        return await sbRest('quiz_activity_log', 'POST', {
            id: activity.id,
            name: activity.name || '',
            username: activity.username || '',
            dept: activity.dept || '',
            avatar_url: activity.avatarUrl || '',
            action_type: activity.actionType || '',
            action_label: activity.actionLabel || '',
            device: activity.device || '',
            time: activity.time || '',
            date: activity.date || '',
            timestamp: activity.timestamp || Date.now()
        }, { 'Prefer': 'resolution=merge-duplicates' });
    },

    async pullActivities() {
        const rows = await sbRest('quiz_activity_log?select=*&order=timestamp.desc&limit=60');
        if (Array.isArray(rows) && rows.length > 0) {
            const logs = rows.map(r => ({
                id: r.id,
                name: r.name,
                username: r.username,
                dept: r.dept,
                avatarUrl: r.avatar_url,
                actionType: r.action_type,
                actionLabel: r.action_label,
                device: r.device,
                time: r.time,
                date: r.date,
                timestamp: r.timestamp
            }));
            localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify(logs));
            return logs;
        }
        return null;
    },

    // ── 4. Questions Sync ──
    async pullQuestions() {
        const rows = await sbRest('quiz_questions?select=*&order=id.asc');
        if (Array.isArray(rows) && rows.length > 0) {
            const questions = rows.map(r => ({
                id: r.id,
                question: r.question,
                options: r.options,
                correctIndex: r.correct_index,
                timeLimit: r.time_limit
            }));
            localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
            return questions;
        }
        return null;
    },

    async pushQuestions(questions) {
        if (!Array.isArray(questions) || questions.length === 0) return;
        // Upsert all questions
        const rows = questions.map(q => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correct_index: q.correctIndex,
            time_limit: q.timeLimit || 15
        }));
        return await sbRest('quiz_questions', 'POST', rows, { 'Prefer': 'resolution=merge-duplicates' });
    },

    // ── 5. Chat Sync ──
    async pushChatMessage(msg) {
        if (!msg || !msg.text) return;
        return await sbRest('quiz_chat', 'POST', {
            id: msg.id || ('msg_' + Date.now()),
            name: msg.author || msg.name || 'خوێندکار',
            dept: msg.dept || '',
            avatar_url: msg.avatarUrl || '',
            text: msg.text,
            time: msg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: msg.timestamp || Date.now()
        }, { 'Prefer': 'resolution=merge-duplicates' });
    },

    async pullChatMessages() {
        const rows = await sbRest('quiz_chat?select=*&order=timestamp.asc&limit=100');
        if (Array.isArray(rows) && rows.length > 0) {
            const msgs = rows.map(r => ({
                id: r.id,
                author: r.name,
                name: r.name,
                dept: r.dept,
                avatarUrl: r.avatar_url,
                text: r.text,
                time: r.time,
                timestamp: r.timestamp
            }));
            localStorage.setItem('institute_night_quiz_chat_msgs', JSON.stringify(msgs));
            return msgs;
        }
        return null;
    },

    async deleteChatMessage(msgId) {
        if (!msgId) return;
        return await sbRest(`quiz_chat?id=eq.${encodeURIComponent(msgId)}`, 'DELETE');
    },

    async clearAllChatMessages() {
        return await sbRest('quiz_chat?timestamp=gt.0', 'DELETE');
    },

    // ── 6. Full Initial Sync ──
    async syncAll() {
        try {
            await Promise.allSettled([
                this.pullUsers(),
                this.pullProfiles(),
                this.pullActivities(),
                this.pullQuestions(),
                this.pullChatMessages()
            ]);
        } catch (e) {
            console.warn('Supabase sync notice:', e);
        }
    }
};

// Auto-run initial sync in the background
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (window.supabaseService) {
                window.supabaseService.syncAll().then(() => {
                    if (typeof renderHallOfFame === 'function') renderHallOfFame();
                    if (typeof renderSurvivorsList === 'function') renderSurvivorsList();
                    if (typeof renderActivityLog === 'function') renderActivityLog();
                    if (typeof renderStats === 'function') renderStats();
                    if (typeof renderChatMessages === 'function') renderChatMessages();
                    if (typeof renderAdminChat === 'function') renderAdminChat();
                });
            }
        }, 800);
    });
}
