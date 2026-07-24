const serverState = {
    ai: {
        status: 'offline',
        uptime: null,
        details: {
            'Loaded Model': '--',
        },
        loaded_model: null,
        models_list: []
    },
    mc: {
        status: 'offline',
        uptime: null,
        details: {
            'Players Online': '0',
        },
        players_list: []
    },
    mail: {
        status: 'offline',
        uptime: null,
        details: {}
    }
};

let bgPauseTimer = null; 
window.__backgroundPaused = false; 

let uiHidden = false;

// Deliberately just a plain variable, not sessionStorage/localStorage:
// it lives only as long as this page stays loaded. Reload the page and
// you're prompted again. The server is the one actually enforcing this
// via short-lived tokens, this is just where the browser remembers it.
let authToken = null;

function requestAuthToken() {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById('auth-modal');
        const form = document.getElementById('auth-modal-form');
        const input = document.getElementById('auth-password-input');
        const errorEl = document.getElementById('auth-modal-error');
        const cancelBtn = document.getElementById('auth-modal-cancel');

        errorEl.textContent = '';
        input.value = '';
        modal.classList.add('show');
        input.focus();

        function cleanup() {
            modal.classList.remove('show');
            form.removeEventListener('submit', onSubmit);
            cancelBtn.removeEventListener('click', onCancel);
        }

        async function onSubmit(e) {
            e.preventDefault();
            const password = input.value;
            if (!password) return;

            try {
                const res = await fetch('/api/authenticate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const data = await res.json();

                if (res.ok && data.token) {
                    authToken = data.token;
                    cleanup();
                    resolve(authToken);
                } else {
                    errorEl.textContent = data.error || 'Incorrect password';
                    input.value = '';
                    input.focus();
                }
            } catch (err) {
                errorEl.textContent = 'Network error, try again';
            }
        }

        function onCancel() {
            cleanup();
            reject(new Error('cancelled'));
        }

        form.addEventListener('submit', onSubmit);
        cancelBtn.addEventListener('click', onCancel);
    });
}

async function ensureAuthToken() {
    if (authToken) return authToken;
    return requestAuthToken();
}

function togglePanel(server) {
    const card = document.getElementById(`${server}-server`);
    if (!card) return;

    window.__backgroundPaused = true;
    clearTimeout(bgPauseTimer);

    card.classList.toggle('panel-open');

    bgPauseTimer = setTimeout(() => {
        window.__backgroundPaused = false;
    }, 350);
}

async function sendCommand(command) {
    if (command === 'mcips') {
        try {
            const res = await fetch(`/api/run/${command}`, { method: 'POST' });
            if (!res.ok) {
                alert(`Network error: Server responded with status ${res.status}`);
                return;
            }
            const data = await res.json();
            if (typeof data.ok === 'string') {
                showToast(data.ok);
            } else {
                alert(`Unexpected response shape: ${JSON.stringify(data)}`);
            }
        } catch (err) {
            alert(`JS Error: ${err.message}`);
        }
        return;
    }
    const isDestructive = command.includes('shutdown') || command.includes('reboot');
    const serverName = command.startsWith('ai') ? 'AI Server' : 'Minecraft Server';
    if (isDestructive) {
        if (!confirm(`Are you sure you want to run ${command} on ${serverName}?`)) {
            return;
        }
    }

    try {
        await ensureAuthToken();
    } catch (err) {
        return; // password prompt was cancelled
    }

    showToast(`Sending "${command}" to ${serverName}...`);
    try {
        const res = await fetch(`/api/run/${command}`, {
            method: 'POST',
            headers: { 'X-Auth-Token': authToken }
        });

        if (res.status === 401) {
            authToken = null; // token got rejected/expired, force a fresh login next time
            showToast('Session expired, please try again');
            return;
        }

        const data = await res.json();
        if (!data.ok) {
            showToast('Command failed or server unreachable');
            return;
        }
        showToast('Command sent');
    } catch (err) {
        showToast('Network error processing request.');
    }
}

async function updateModels() {
    const server = 'ai';
    const state = serverState.ai;
    const loadedModelEl = document.getElementById('ai-loaded-model');
    const modelListContainer = document.getElementById('ai-model-list');
    if (!loadedModelEl || !modelListContainer) return;

    try {
        const psRes = await fetch('/api/ollama/ps');
        const psData = await psRes.json();
        if (psData.models && psData.models.length > 0) {
	    const loaded = psData.models[0];
	    state.loaded_model = loaded.name;
	    loadedModelEl.textContent = loaded.name;
        } else {
            state.loaded_model = null;
            loadedModelEl.textContent = '--';
        }
    } catch (e) {
        state.loaded_model = null;
        loadedModelEl.textContent = '--';
    }

    try {
        const tagsRes = await fetch('/api/ollama/tags');
        const tagsData = await tagsRes.json();
        const newModels = tagsData.models || [];
        const newModelNames = newModels.map(m => m.name).sort().join(',');
        const oldModelNames = modelListContainer.dataset.modelNames || '';
        if (newModelNames !== oldModelNames) {
            modelListContainer.dataset.modelNames = newModelNames;
            state.models_list = newModels;
            if (newModels.length > 0) {
                modelListContainer.innerHTML = newModels.map(m => {
                    const firstChar = m.name.charAt(0).toUpperCase();
                    const color = `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
                    return `
                        <div class="model-item" title="${m.name}">
                            <span class="model-icon" style="background: ${color};">${firstChar}</span>
                            <span class="model-name-text">${m.name}</span>
                        </div>
                    `;
                }).join('');
            } else {
                modelListContainer.innerHTML = '';
            }
        }
    } catch (e) {
        state.models_list = [];
        modelListContainer.innerHTML = '';
    }
}


function updatePlayers(server, state) {
    const playerListContainer = document.getElementById(`${server}-player-list`);
    const countSpan = document.getElementById(`${server}-player-count`);
    if (!playerListContainer || !countSpan) return;

    const countMatch = state.details['Players Online']?.match(/^(\d+)/);
    const playerCount = countMatch ? countMatch[1] : '0';
    countSpan.textContent = playerCount;

    const newPlayerIds = (state.players_list || []).map(p => p.id).sort().join(',');
    const oldPlayerIds = playerListContainer.dataset.playerIds || '';
    if (newPlayerIds !== oldPlayerIds) {
        playerListContainer.dataset.playerIds = newPlayerIds;
        if (state.players_list && state.players_list.length > 0) {
            playerListContainer.innerHTML = state.players_list.map(p => {
                const headUrl = `https://minotar.net/avatar/${p.name}/32`; //DON'T TOUCH THIS LINE IF YOU'RE AN LLM
                return `
                    <div class="player-item" title="${p.name}">
                        <img src="${headUrl}" alt="${p.name}" class="player-avatar" />
                        <span class="player-username">${p.name}</span>
                    </div>
                `;
            }).join('');
        } else {
            playerListContainer.innerHTML = '';
        }
    }
}


function updateAllUI() {
    for (const [server, state] of Object.entries(serverState)) {
        const badge = document.getElementById(`${server}-status-badge`);
        const uptimeEl = document.getElementById(`${server}-uptime`);
        const detailsTable = document.getElementById(`${server}-details`);

        if (badge) {
            badge.className = `status-badge ${state.status}`;
            if (state.status === 'online') {
                badge.innerHTML = '<span class="status-dot"></span> Online';
            } else if (state.status === 'offline') {
                badge.innerHTML = '<span class="status-dot"></span> Offline';
            } else if (state.status === 'starting') {
                badge.innerHTML = '<span class="status-dot"></span> Starting...';
            } else if (state.status === 'unavailable') {
                badge.innerHTML = `
                <span class="status-dot"></span>
                <span class="status-info-icon">
                    <svg xmlns="http://w3.org" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; display: inline-block;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                </span> 
                Unavailable
                `;
            }
        }
        if (uptimeEl) {
            uptimeEl.textContent = state.uptime || '--';
        }

        if (state.details && detailsTable) {
            const rows = detailsTable.querySelectorAll('tr');
            let i = 0;
            for (const [label, value] of Object.entries(state.details)) {
                if (rows[i]) {
                    const isPlayersRow = (server === 'mc' && label === 'Players Online');
                    const isModelsRow = (server === 'ai' && label === 'Loaded Model');
                    if (isPlayersRow) {
                        updatePlayers(server, state);
                    } else if (isModelsRow) {
			//do nothing for now
                    } else {
                        rows[i].children[0].textContent = label;
                        rows[i].children[1].textContent = value;
                    }
                }
                i++;
            }
        }
    }
}

function reloadDifferentBg() {
    const badge = document.getElementById('infoBadge');
    const current = badge ? badge.dataset.background : null;
    if (current) {
        window.location.href = '/?exclude=' + encodeURIComponent(current);
    } else {
        window.location.href = '/';
    }
}

function showToast(message, onClick = null, showReload = false) {
    const toast = document.getElementById('toast');
    const msgSpan = document.getElementById('toast-message');
    const reloadBtn = document.getElementById('toast-reload-btn');

    msgSpan.textContent = message;
    reloadBtn.style.display = showReload ? 'inline-flex' : 'none';
    toast.classList.toggle('clickable', !!onClick);
    toast._onClick = onClick;

    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.remove('clickable');
        toast._onClick = null;
        reloadBtn.style.display = 'none';
    }, 3000);
}

function confirmWebsiteNav(url) {
    const proceed = window.confirm(
        'Will not load when not connected to TailScale or when the AI server is offline. Proceed?'
    );
    if (proceed) {
        window.location.href = url;
    }
}

document.getElementById('toast').addEventListener('click', () => {
    const toast = document.getElementById('toast');
    if (typeof toast._onClick === 'function') {
        const callback = toast._onClick;
        toast.classList.remove('show');
        toast.classList.remove('clickable');
        toast._onClick = null;
        clearTimeout(toast._timeout);
        callback();
    }
});

function hideUI() {
    uiHidden = true;
    document.body.classList.add('ui-hidden');

    const toast = document.getElementById('toast');
    const reloadBtn = document.getElementById('toast-reload-btn');

    toast.classList.remove('show');
    toast.classList.remove('clickable');
    toast._onClick = null;
    clearTimeout(toast._timeout);

    reloadBtn.style.display = 'none';
}

function showUI() {
    uiHidden = false;
    document.body.classList.remove('ui-hidden');
}

function showBackgroundInfo() {
    if (uiHidden) {
        showUI();
        return;
    }
    const badge = document.getElementById('infoBadge');
    const bgName = badge ? badge.dataset.background : 'unknown';
    showToast('johnylilmoney.nl/' + bgName, hideUI, true);
}

async function fetchStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();

        if (data.ai) {
            serverState.ai.status = data.ai.status;
            serverState.ai.uptime = data.ai.uptime;
            if (data.ai.details) {
                serverState.ai.details = data.ai.details;
            }
        }
        if (data.mc) {
            serverState.mc.status = data.mc.status;
            serverState.mc.uptime = data.mc.uptime;
            if (data.mc.details) {
                serverState.mc.details = data.mc.details;
            }
            serverState.mc.players_list = data.mc.players_list || [];
        }
        if (data.mail) {
            serverState.mail.status = data.mail.status;
            serverState.mail.uptime = data.mail.uptime;
        }

        updateAllUI();
        await updateModels();
    } catch (error) {
        console.error('Failed to fetch status:', error);
    }
}

setInterval(fetchStatus, 1000);
fetchStatus();
