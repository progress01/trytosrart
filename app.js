import { db, auth, provider, signInWithPopup, onAuthStateChanged, signOut } from './firebase-config.js';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const COLLECTION_RECORDS = "LifeApp_Records"; 
const COLLECTION_SETTINGS = "LifeApp_Settings"; 

let state = {
    currentUser: null, recordsData: [], isSubmitting: false, isManageMode: false,
    sysSettings: {
        coinRates: { money: 100, calorie: 100, learning: 30, habit: 10 },
        customCats: { expense: [], income: [], food: [], exercise: [], learning: [], habit: [], sleep: [], mood: [] },
        quotes: []
    }
};

let chartInstances = { growth: null, finance: null, health: null };

const DEFAULT_CAT_MAP = {
    'learning': [ {val: 'eng_micro', text: '🔤 英文微接觸'}, {val: 'read_page', text: '📖 翻開書本/文獻'}, {val: 'tech_doc', text: '💻 架構與技術實作'} ],
    'habit': [ {val: 'water', text: '💧 喝水達標'}, {val: 'meditate', text: '🧘 冥想'}, {val: 'clean', text: '🧹 整理環境'} ],
    'expense': [ {val: 'food', text: '餐飲'}, {val: 'transport', text: '交通'}, {val: 'shopping', text: '購物'}, {val: 'entertainment', text: '娛樂'} ],
    'income': [ {val: 'salary', text: '薪資'}, {val: 'bonus', text: '獎金'}, {val: 'invest', text: '投資'} ],
    'food': [ {val: 'meal', text: '正餐'}, {val: 'snack', text: '零食/甜點'}, {val: 'drink', text: '飲料'} ],
    'exercise': [ {val: 'cardio', text: '有氧'}, {val: 'weight', text: '重訓'}, {val: 'stretch', text: '伸展/瑜珈'} ],
    'sleep': [ {val: 'night', text: '主睡眠'}, {val: 'nap', text: '午休小睡'} ],
    'mood': [ {val: '5', text: '🤩 充滿活力 (5分)'}, {val: '4', text: '🙂 穩定順暢 (4分)'}, {val: '3', text: '😐 平淡一般 (3分)'}, {val: '2', text: '😫 疲憊低迷 (2分)'}, {val: '1', text: '😭 徹底耗盡 (1分)'} ]
};

const DEFAULT_QUOTES = [
    "不管讀多深、讀多久，只要啟動了閱讀行為，就是前進。 -- 微學習心法",
    "別因為一次的失誤，就否定了之前所有的努力。 -- 覺察日記",
    "真正的自律，是允許自己偶爾的脆弱，然後繼續前進。 -- 心理學",
    "系統架構的優美，在於把複雜藏在看不見的地方，把簡單留給自己。 -- 開發者日常",
    "允許偶爾的空白，找回節奏比維持完美更重要。 -- 習慣心理學"
];

const BG_IMAGES = [
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1474015977011-fb317070189a?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=800&q=80"
];

const getLocalYMD = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const showToast = (msg, type = "success") => {
    const toastEl = document.getElementById('liveToast');
    document.getElementById('toast-body').innerText = msg;
    toastEl.className = `toast align-items-center border-0 text-bg-${type}`;
    new bootstrap.Toast(toastEl, { delay: 2500 }).show();
};

window.showConfirm = function(title, message, buttons) {
    document.getElementById('dc-title').innerText = title;
    document.getElementById('dc-message').innerHTML = message;
    const btnContainer = document.getElementById('dc-buttons');
    btnContainer.innerHTML = '';
    buttons.forEach(btn => {
        const buttonEl = document.createElement('button');
        buttonEl.className = `btn fw-bold ${btn.class}`;
        buttonEl.innerHTML = btn.text;
        if(btn.dismiss) buttonEl.setAttribute('data-bs-dismiss', 'modal');
        if(btn.onClick) {
            buttonEl.addEventListener('click', () => {
                btn.onClick();
                bootstrap.Modal.getInstance(document.getElementById('dynamicConfirmModal')).hide();
            });
        }
        btnContainer.appendChild(buttonEl);
    });
    bootstrap.Modal.getOrCreateInstance(document.getElementById('dynamicConfirmModal')).show();
};

window.refreshQuote = () => {
    const combinedQuotes = [...DEFAULT_QUOTES, ...(state.sysSettings.quotes || [])];
    const randQ = combinedQuotes[Math.floor(Math.random() * combinedQuotes.length)].split("--");
    document.getElementById('q-text').innerText = randQ[0].trim();
    document.getElementById('q-author').innerText = randQ[1] ? `-- ${randQ[1].trim()}` : '';
    const randBg = BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)];
    document.getElementById('quote-card').style.backgroundImage = `url('${randBg}')`;
};

// --- 💡 區間切換與 GA 自訂日期 ---
const rangeSelect = document.getElementById('overview-range');
const customStart = document.getElementById('custom-start-date');
const customEnd = document.getElementById('custom-end-date');
const customSep = document.getElementById('custom-date-sep');

function toggleCustomDateInputs() {
    if (rangeSelect.value === 'custom') {
        customStart.classList.remove('d-none');
        customEnd.classList.remove('d-none');
        customSep.classList.remove('d-none');
    } else {
        customStart.classList.add('d-none');
        customEnd.classList.add('d-none');
        customSep.classList.add('d-none');
    }
    updateUI(); 
}

rangeSelect.addEventListener('change', toggleCustomDateInputs);
customStart.addEventListener('change', updateUI);
customEnd.addEventListener('change', updateUI);

function getRangeBounds() {
    const rangeType = rangeSelect.value;
    const now = new Date();
    const todayStr = getLocalYMD(now);
    
    if (rangeType === 'week') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const startWeek = new Date(now.setDate(diff));
        const endWeek = new Date(startWeek);
        endWeek.setDate(startWeek.getDate() + 6);
        return { start: getLocalYMD(startWeek), end: getLocalYMD(endWeek), label: "本週", totalDays: 7 };
    }
    if (rangeType === 'month') {
        const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return { start: todayStr.substring(0, 7) + "-01", end: todayStr.substring(0, 7) + "-31", label: "本月", totalDays: totalDays };
    }
    if (rangeType === 'custom') {
        const start = customStart.value || todayStr;
        const end = customEnd.value || todayStr;
        const sDate = new Date(start);
        const eDate = new Date(end);
        const diffDays = Math.ceil(Math.abs(eDate - sDate) / (1000 * 60 * 60 * 24)) + 1;
        return { start: start, end: end, label: "自訂", totalDays: diffDays || 1 };
    }
}

function updateFormUI() {
    const typeSelect = document.getElementById('input-type');
    const categorySelect = document.getElementById('input-category');
    const amtInput = document.getElementById('input-amount');
    
    const type = typeSelect.value;
    let optionsHtml = DEFAULT_CAT_MAP[type].map(c => `<option value="${c.val}">${c.text}</option>`).join('');
    
    if (state.sysSettings.customCats[type] && state.sysSettings.customCats[type].length > 0) {
        optionsHtml += `<optgroup label="自訂分類">`;
        optionsHtml += state.sysSettings.customCats[type].map(c => `<option value="custom_${c}">${c}</option>`).join('');
        optionsHtml += `</optgroup>`;
    }
    categorySelect.innerHTML = optionsHtml;
    
    if (type === 'mood' || type === 'habit' || type === 'learning') {
        document.getElementById('amount-container').style.display = 'none';
        amtInput.removeAttribute('required');
        amtInput.value = type === 'mood' ? "0" : "1"; 
    } else {
        document.getElementById('amount-container').style.display = 'block';
        amtInput.setAttribute('required', 'true');
        amtInput.value = "";
    }
}
document.getElementById('input-type').addEventListener('change', updateFormUI);

function updateUI() {
    updateStats(); 
    renderAnalyses(); 
    renderHeatmap(); 
    renderTables();
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
}

function updateStats() {
    const bounds = getRangeBounds();
    document.querySelectorAll('.range-label').forEach(el => el.innerText = bounds.label);
    
    let tExpense = 0, tIncome = 0, tFood = 0, tBurn = 0, tLearning = 0, tHabit = 0;
    let activeDates = new Set();

    state.recordsData.forEach(r => {
        if (r.date >= bounds.start && r.date <= bounds.end) {
            activeDates.add(r.date);
            if (r.type === 'expense') tExpense += r.amount;
            if (r.type === 'income') tIncome += r.amount;
            if (r.type === 'food') tFood += r.amount;
            if (r.type === 'exercise') tBurn += r.amount;
            if (r.type === 'learning') tLearning += r.amount;
            if (r.type === 'habit') tHabit += r.amount;
        }
    });

    document.getElementById('stat-saving').innerText = (tIncome - tExpense).toLocaleString();
    document.getElementById('stat-saving').className = `mt-2 mb-0 ${(tIncome - tExpense) >= 0 ? 'val-income' : 'val-expense'}`;
    document.getElementById('stat-expense').innerText = tExpense.toLocaleString();
    document.getElementById('stat-income').innerText = tIncome.toLocaleString();

    const deficit = tBurn - tFood; 
    document.getElementById('stat-calorie').innerText = deficit > 0 ? `+${deficit}` : deficit;
    document.getElementById('stat-calorie').className = `mt-2 mb-0 ${deficit >= 0 ? 'val-exercise' : 'val-expense'}`;
    document.getElementById('stat-food').innerText = tFood;
    document.getElementById('stat-burn').innerText = tBurn;

    document.getElementById('stat-learning').innerText = tLearning;
    document.getElementById('stat-habit').innerText = tHabit;

    const activeDaysCount = activeDates.size;
    const totalDays = bounds.totalDays;
    const progressPct = (activeDaysCount / totalDays) * 100;
    
    document.getElementById('stat-active-days').innerText = activeDaysCount;
    document.getElementById('stat-total-days').innerText = totalDays;
    const bar = document.getElementById('stat-active-bar');
    bar.style.width = `${progressPct}%`;
    bar.className = `progress-bar ${progressPct >= 80 ? 'bg-success' : (progressPct >= 50 ? 'bg-warning' : 'bg-secondary')}`;
}

function renderAnalyses() {
    const bounds = getRangeBounds();
    let rangeRecords = state.recordsData
        .filter(r => r.date >= bounds.start && r.date <= bounds.end)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    // 1. 🌱 成長分析 (Growth)
    let learnCount = 0, habitCount = 0;
    let growthLabels = [], growthData = [], gTooltips = [], gTotal = 0;
    rangeRecords.forEach(r => {
        if (r.type === 'learning') learnCount += r.amount;
        if (r.type === 'habit') habitCount += r.amount;
        if (r.type === 'learning' || r.type === 'habit') {
            gTotal += r.amount;
            growthLabels.push(r.date.substring(5));
            growthData.push(gTotal);
            gTooltips.push(r.note || r.categoryText);
        }
    });
    document.getElementById('ana-learn-total').innerText = `${learnCount} 次`;
    document.getElementById('ana-habit-total').innerText = `${habitCount} 次`;
    drawChart('chart-growth', 'growth', '累積成長 (次)', growthLabels, growthData, gTooltips, '#39c5bb', 'rgba(57,197,187,0.1)');

    // 2. 💳 財務分析 (Finance)
    let expenses = {}, topCat = "無", topAmt = 0;
    let finLabels = [], finData = [], fTooltips = [], netWorth = 0;
    rangeRecords.forEach(r => {
        if (r.type === 'expense') {
            expenses[r.categoryText] = (expenses[r.categoryText] || 0) + r.amount;
            if (expenses[r.categoryText] > topAmt) { topAmt = expenses[r.categoryText]; topCat = r.categoryText; }
            netWorth -= r.amount;
            finLabels.push(r.date.substring(5));
            finData.push(netWorth);
            fTooltips.push(`支出: ${r.amount} (${r.categoryText})`);
        }
        if (r.type === 'income') {
            netWorth += r.amount;
            finLabels.push(r.date.substring(5));
            finData.push(netWorth);
            fTooltips.push(`收入: ${r.amount} (${r.categoryText})`);
        }
    });
    document.getElementById('ana-net-worth').innerText = netWorth >= 0 ? `+${netWorth}` : netWorth;
    document.getElementById('ana-top-expense').innerText = `${topCat}`;
    drawChart('chart-finance', 'finance', '累積淨值', finLabels, finData, fTooltips, '#58a6ff', 'rgba(88,166,255,0.1)');

    // 3. 💪 健康分析 (Health)
    let hlLabels = [], healData = [], hTooltips = [], totalDeficit = 0;
    rangeRecords.forEach(r => {
        if (r.type === 'exercise') {
            totalDeficit += r.amount;
            hlLabels.push(r.date.substring(5));
            healData.push(totalDeficit);
            hTooltips.push(`消耗: ${r.amount}`);
        }
        if (r.type === 'food') {
            totalDeficit -= r.amount;
            hlLabels.push(r.date.substring(5));
            healData.push(totalDeficit);
            hTooltips.push(`攝取: ${r.amount}`);
        }
    });
    document.getElementById('ana-total-deficit').innerText = totalDeficit > 0 ? `+${totalDeficit}` : totalDeficit;
    let fatLost = (totalDeficit / 7700).toFixed(2);
    if (fatLost > 0.05) { document.getElementById('ana-fat-loss').innerText = `🔥 甩掉 ${fatLost} kg`; } 
    else if (totalDeficit > 0) { document.getElementById('ana-fat-loss').innerText = `🧋 抵消 ${Math.floor(totalDeficit/500)} 杯珍奶`; } 
    else { document.getElementById('ana-fat-loss').innerText = `保持平衡`; }
    drawChart('chart-health', 'health', '累積赤字 (卡)', hlLabels, healData, hTooltips, '#3fb950', 'rgba(63,185,80,0.1)');

    // 4. 🌟 狀態分析 (Life - Emoji Bars)
    let highEnergyDays = new Set(), sleepSum = 0, sleepCount = 0;
    let moodCounts = {5:0, 4:0, 3:0, 2:0, 1:0};
    rangeRecords.forEach(r => {
        if (r.type === 'mood') {
            moodCounts[r.amount]++;
            if (r.amount >= 4) highEnergyDays.add(r.date);
        }
        if (r.type === 'sleep') { sleepSum += r.amount; sleepCount++; }
    });
    document.getElementById('ana-high-energy').innerText = `${highEnergyDays.size} 天`;
    document.getElementById('ana-sleep-avg').innerText = sleepCount > 0 ? (sleepSum/sleepCount).toFixed(1) + ' 小時' : '0 小時';

    let moodTotal = Object.values(moodCounts).reduce((a, b) => a + b, 0) || 1;
    let moodHtml = '';
    const moodConfig = [
        {val: 5, emoji: '🤩', color: 'bg-primary'}, {val: 4, emoji: '🙂', color: 'bg-success'},
        {val: 3, emoji: '😐', color: 'bg-warning'}, {val: 2, emoji: '😫', color: 'bg-danger'}, {val: 1, emoji: '😭', color: 'bg-secondary'}
    ];
    moodConfig.forEach(m => {
        let pct = (moodCounts[m.val] / moodTotal) * 100;
        moodHtml += `
            <div class="d-flex align-items-center" style="font-size: 0.85rem;">
                <span class="me-2" style="width: 25px;">${m.emoji}</span>
                <div class="progress flex-grow-1" style="height: 10px; background-color: var(--border-color);">
                    <div class="progress-bar ${m.color}" style="width: ${pct}%"></div>
                </div>
                <span class="ms-2 text-muted" style="width: 25px; text-align: right;">${moodCounts[m.val]}</span>
            </div>
        `;
    });
    document.getElementById('ana-mood-bars').innerHTML = moodHtml;
}

function drawChart(canvasId, instanceKey, label, labels, data, tooltips, borderColor, bgColor) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (chartInstances[instanceKey]) chartInstances[instanceKey].destroy();
    if(labels.length === 0) { labels = ['無']; data = [0]; tooltips = ['無資料']; }

    chartInstances[instanceKey] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                borderColor: borderColor,
                backgroundColor: bgColor,
                borderWidth: 2, pointRadius: 3, fill: true, tension: 0.3, pointBackgroundColor: '#fff'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { footer: (t) => "📝 " + tooltips[t[0].dataIndex] } }
            },
            scales: {
                x: { ticks: { color: '#8b949e', maxTicksLimit: 7 }, grid: { display: false } },
                y: { ticks: { color: '#8b949e' }, grid: { color: '#30363d' } }
            }
        }
    });
}

// 💡 匯出 CSV 邏輯
document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (!state.recordsData || state.recordsData.length === 0) {
        showToast("目前沒有資料可以匯出", "warning"); return;
    }
    const btn = document.getElementById('btn-export-csv');
    const originalText = btn.innerText;
    btn.innerText = "⏳ 處理中...";
    btn.disabled = true;

    try {
        let csvContent = "\uFEFF"; 
        csvContent += "日期,類型(Type),次分類(Category),數值(Amount),備註細節(Note)\n";

        state.recordsData.forEach(r => {
            let safeNote = r.note ? `"${r.note.replace(/"/g, '""').replace(/\n/g, ' ')}"` : "";
            let row = `${r.date},${r.type},${r.categoryText || r.category},${r.amount},${safeNote}`;
            csvContent += row + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `LifeTracker_Export_${getLocalYMD()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("✅ CSV 匯出成功！");
    } catch (error) {
        showToast("匯出失敗", "danger");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

function renderTables() {
    const finBody = document.getElementById('table-finance-body');
    const healBody = document.getElementById('table-health-body');
    const growBody = document.getElementById('table-growth-body');
    const lifeBody = document.getElementById('table-life-body');
    
    let finHtml = "", healHtml = "", growHtml = "", lifeHtml = "";

    const typeMap = {
        'expense': { icon: '💸', color: 'val-expense', unit: '' },
        'income': { icon: '💰', color: 'val-income', unit: '' },
        'food': { icon: '🍱', color: 'val-food', unit: ' 大卡' },
        'exercise': { icon: '🏃', color: 'val-exercise', unit: ' 大卡' },
        'learning': { icon: '📚', color: 'val-growth', unit: ' 次' },
        'habit': { icon: '✅', color: 'val-growth', unit: ' 次' },
        'sleep': { icon: '💤', color: 'val-life', unit: ' 小時' },
        'mood': { icon: '🌟', color: 'val-life', unit: ' 分' }
    };

    state.recordsData.forEach(r => {
        const conf = typeMap[r.type];
        let displayVal = (r.type === 'expense' || r.type === 'income') ? r.amount.toLocaleString() : r.amount;
        let noteStr = r.note ? `<br><small class="text-muted">${r.note}</small>` : "";
        if (r.type === 'mood') displayVal = ['😭', '😫', '😐', '🙂', '🤩'][r.amount - 1] || r.amount;

        const opCell = state.isManageMode 
            ? `<td class="text-center"><input type="checkbox" class="form-check-input cb-record-item" value="${r.id}" style="cursor: pointer; transform: scale(1.2);"></td>`
            : ``;

        const tr = `
            <tr>
                <td class="text-muted" style="white-space: nowrap;">${r.date.substring(5)}</td>
                <td class="text-start">
                    ${conf.icon} <span class="category-badge">${r.categoryText || '未分類'}</span>
                    ${noteStr}
                </td>
                <td class="text-end pe-3 ${conf.color}">${displayVal}${conf.unit}</td>
                ${opCell}
            </tr>
        `;
        
        if (r.type === 'expense' || r.type === 'income') finHtml += tr;
        else if (r.type === 'food' || r.type === 'exercise') healHtml += tr;
        else if (r.type === 'learning' || r.type === 'habit') growHtml += tr;
        else lifeHtml += tr;
    });

    const thead = `<tr><th>日期</th><th>項目足跡</th><th class="text-end pe-3">數值</th>${state.isManageMode ? '<th class="text-center">選取</th>' : ''}</tr>`;

    finBody.innerHTML = finHtml ? thead + finHtml : `<tr><td colspan="4" class="text-muted text-center py-4">尚無足跡</td></tr>`;
    healBody.innerHTML = healHtml ? thead + healHtml : `<tr><td colspan="4" class="text-muted text-center py-4">尚無足跡</td></tr>`;
    growBody.innerHTML = growHtml ? thead + growHtml : `<tr><td colspan="4" class="text-muted text-center py-4">尚無足跡</td></tr>`;
    lifeBody.innerHTML = lifeHtml ? thead + lifeHtml : `<tr><td colspan="4" class="text-muted text-center py-4">尚無足跡</td></tr>`;
}

function renderHeatmap() {
    const container = document.getElementById('heatmap-grid');
    container.innerHTML = "";
    let dateCounts = {};
    state.recordsData.forEach(r => { dateCounts[r.date] = (dateCounts[r.date] || 0) + 1; });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);
    startDate.setDate(startDate.getDate() - startDate.getDay()); 

    const today = new Date();
    const fragment = document.createDocumentFragment();

    let ptr = new Date(startDate);
    while (ptr <= today) {
        const dStr = getLocalYMD(ptr);
        const count = dateCounts[dStr] || 0;
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        if (count === 1) cell.classList.add('hc-1');
        else if (count === 2) cell.classList.add('hc-2');
        else if (count >= 3 && count <= 4) cell.classList.add('hc-3');
        else if (count > 4) cell.classList.add('hc-4');
        else cell.classList.add('hc-0');

        cell.setAttribute('data-bs-toggle', 'tooltip');
        cell.setAttribute('data-bs-title', count > 0 ? `${dStr} : 累積了 ${count} 步足跡` : `${dStr} : 尚無足跡`);
        fragment.appendChild(cell);
        ptr.setDate(ptr.getDate() + 1);
    }
    container.appendChild(fragment);

    setTimeout(() => { document.getElementById('heatmap-scroller').scrollLeft = document.getElementById('heatmap-scroller').scrollWidth; }, 100);
}

// ... 下方程式碼與先前一致，包含設定載入 loadSettings()、儲存 saveSettingsData()、Auth 狀態監聽 onAuthStateChanged() 等等 ...

async function loadSettings() {
    if (!state.currentUser) return;
    const docRef = doc(db, COLLECTION_SETTINGS, state.currentUser.uid + "_life");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        state.sysSettings.coinRates = { ...state.sysSettings.coinRates, ...(data.coinRates || {}) };
        state.sysSettings.customCats = { ...state.sysSettings.customCats, ...(data.customCats || {}) };
        state.sysSettings.quotes = data.quotes || [];
    }
    updateSettingsModalUI();
}

async function saveSettingsData() {
    const docRef = doc(db, COLLECTION_SETTINGS, state.currentUser.uid + "_life");
    await setDoc(docRef, state.sysSettings, { merge: true });
    updateFormUI(); 
}

function updateSettingsModalUI() {
    document.getElementById('set-rate-money').value = state.sysSettings.coinRates.money;
    document.getElementById('set-rate-calorie').value = state.sysSettings.coinRates.calorie;
    document.getElementById('set-rate-learn').value = state.sysSettings.coinRates.learning;
    document.getElementById('set-rate-habit').value = state.sysSettings.coinRates.habit;
    renderCustomCatList();
    renderQuoteList();
}

document.getElementById('btn-save-settings').addEventListener('click', async () => {
    state.sysSettings.coinRates.money = parseInt(document.getElementById('set-rate-money').value) || 100;
    state.sysSettings.coinRates.calorie = parseInt(document.getElementById('set-rate-calorie').value) || 100;
    state.sysSettings.coinRates.learning = parseInt(document.getElementById('set-rate-learn').value) || 30;
    state.sysSettings.coinRates.habit = parseInt(document.getElementById('set-rate-habit').value) || 10;
    await saveSettingsData();
    showToast("✅ 設定儲存成功");
    bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
});

document.getElementById('btn-add-custom-cat').addEventListener('click', async () => {
    const type = document.getElementById('set-cat-type').value;
    const name = document.getElementById('set-cat-name').value.trim();
    if (name && !state.sysSettings.customCats[type].includes(name)) {
        state.sysSettings.customCats[type].push(name);
        document.getElementById('set-cat-name').value = "";
        await saveSettingsData();
        renderCustomCatList();
    }
});

window.removeCustomCat = async (type, index) => {
    state.sysSettings.customCats[type].splice(index, 1);
    await saveSettingsData();
    renderCustomCatList();
};

function renderCustomCatList() {
    const list = document.getElementById('custom-cat-list');
    list.innerHTML = "";
    const typeSelect = document.getElementById('set-cat-type');
    const typeNames = Array.from(typeSelect.options).reduce((acc, opt) => ({...acc, [opt.value]: opt.text}), {});

    Object.keys(state.sysSettings.customCats).forEach(type => {
        state.sysSettings.customCats[type].forEach((catName, idx) => {
            const li = document.createElement('li');
            li.className = "list-group-item d-flex justify-content-between align-items-center bg-dark text-light border-secondary";
            li.innerHTML = `<span><span class="badge bg-secondary me-2">${typeNames[type] || type}</span> ${catName}</span>
                            <button class="btn btn-sm btn-outline-danger py-0" onclick="removeCustomCat('${type}', ${idx})">✖</button>`;
            list.appendChild(li);
        });
    });
}
document.getElementById('set-cat-type').addEventListener('change', renderCustomCatList);

document.getElementById('btn-add-quote').addEventListener('click', async () => {
    const quoteInput = document.getElementById('set-custom-quote');
    const text = quoteInput.value.trim();
    if (text && !state.sysSettings.quotes.includes(text)) {
        state.sysSettings.quotes.push(text);
        quoteInput.value = "";
        await saveSettingsData();
        renderQuoteList();
        window.refreshQuote(); 
    }
});

window.removeQuote = async (index) => {
    state.sysSettings.quotes.splice(index, 1);
    await saveSettingsData();
    renderQuoteList();
};

function renderQuoteList() {
    const list = document.getElementById('custom-quote-list');
    list.innerHTML = "";
    (state.sysSettings.quotes || []).forEach((qText, idx) => {
        const li = document.createElement('li');
        li.className = "list-group-item d-flex justify-content-between align-items-center bg-dark text-light border-secondary";
        li.innerHTML = `<span class="text-truncate me-2">${qText}</span>
                        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="removeQuote(${idx})">✖</button>`;
        list.appendChild(li);
    });
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        state.currentUser = user;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        
        const todayYMD = getLocalYMD();
        const dateInput = document.getElementById('input-date');
        customStart.value = todayYMD; // 初始化 GA 起始時間
        customEnd.value = todayYMD;   // 初始化 GA 結束時間
        dateInput.value = todayYMD;
        dateInput.max = todayYMD;
        
        await loadSettings(); 
        updateFormUI();
        window.refreshQuote();
        await fetchInitialData(); 
    } else {
        state.currentUser = null;
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

async function fetchInitialData() {
    if (!state.currentUser) return;
    try {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        
        const LIFE_UID = state.currentUser.uid + "_life"; 
        const q = query(collection(db, COLLECTION_RECORDS), where("uid", "==", LIFE_UID));
        const snapshot = await getDocs(q);
        
        state.recordsData = [];
        snapshot.forEach(doc => {
            let data = doc.data();
            data.id = doc.id;
            if (data.date >= getLocalYMD(oneYearAgo)) state.recordsData.push(data);
        });
        
        state.recordsData.sort((a, b) => new Date(b.date) - new Date(a.date) || b.timestamp - a.timestamp);
        updateUI(); 
    } catch (error) { 
        showToast("資料同步失敗，將使用離線快取", "warning"); 
    }
}

document.getElementById('form-record').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(state.isSubmitting) return; 
    state.isSubmitting = true;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerText = "儲存中...";

    const type = document.getElementById('input-type').value;
    const categorySelect = document.getElementById('input-category');
    const category = categorySelect.value;
    let categoryText = categorySelect.options[categorySelect.selectedIndex].text;
    
    if(category.startsWith("custom_")) categoryText = category.replace("custom_", "🔸 ");
    
    let rawAmount = parseFloat(document.getElementById('input-amount').value);
    if (isNaN(rawAmount) || rawAmount < 0 || rawAmount > 9999999) rawAmount = 0;

    let amountToSave = rawAmount;
    if (type === 'mood') amountToSave = parseFloat(category);
    if (type === 'habit' || type === 'learning') amountToSave = 1;

    const newRecord = {
        uid: state.currentUser.uid + "_life",
        date: document.getElementById('input-date').value,
        type: type,
        category: category,
        categoryText: categoryText,
        amount: amountToSave,
        note: document.getElementById('input-note').value.trim(),
        timestamp: Date.now()
    };

    try {
        const docRef = await addDoc(collection(db, COLLECTION_RECORDS), newRecord);
        newRecord.id = docRef.id;
        
        state.recordsData.push(newRecord);
        state.recordsData.sort((a, b) => new Date(b.date) - new Date(a.date) || b.timestamp - a.timestamp);
        updateUI();
        
        document.getElementById('input-amount').value = "";
        document.getElementById('input-note').value = "";
        bootstrap.Modal.getInstance(document.getElementById('recordModal')).hide();
        showToast("✅ 足跡已登錄");
    } catch (err) { 
        showToast("寫入失敗", "danger"); 
    } finally { 
        state.isSubmitting = false;
        btn.innerText = "💾 儲存紀錄"; 
    }
});

window.deleteRecord = (id) => {
    showConfirm("移除足跡", "確定要刪除這筆紀錄嗎？", [
        { text: "💥 刪除", class: "btn-danger", onClick: async () => {
            try {
                await deleteDoc(doc(db, COLLECTION_RECORDS, id));
                state.recordsData = state.recordsData.filter(r => r.id !== id);
                updateUI();
                showToast("✅ 已移除");
            } catch(e) { showToast("刪除失敗", "danger"); }
        }},
        { text: "取消", class: "btn-light", dismiss: true }
    ]);
};

document.getElementById('btn-toggle-manage').addEventListener('click', () => {
    state.isManageMode = true;
    document.getElementById('btn-toggle-manage').classList.add('d-none');
    document.getElementById('manage-bar').classList.remove('d-none');
    document.querySelectorAll('.action-lock').forEach(el => el.classList.add('disabled-mode'));
    renderTables();
});

document.getElementById('btn-cancel-manage').addEventListener('click', () => {
    state.isManageMode = false;
    document.getElementById('btn-toggle-manage').classList.remove('d-none');
    document.getElementById('manage-bar').classList.add('d-none');
    document.querySelectorAll('.action-lock').forEach(el => el.classList.remove('disabled-mode'));
    renderTables();
});

document.getElementById('btn-batch-delete').addEventListener('click', () => {
    const checkedBoxes = document.querySelectorAll(".cb-record-item:checked");
    if(checkedBoxes.length === 0) { showToast("請先勾選項目！", "warning"); return; }
    
    showConfirm("批次刪除", `確定要刪除選取的 <strong class="text-danger">${checkedBoxes.length}</strong> 筆足跡嗎？`, [
        { text: "💥 確認批次刪除", class: "btn-danger", onClick: async () => {
            const btn = document.getElementById('btn-batch-delete');
            btn.disabled = true; btn.innerText = "刪除中...";
            try {
                const batch = writeBatch(db);
                let idsToDelete = [];
                checkedBoxes.forEach(cb => {
                    batch.delete(doc(db, COLLECTION_RECORDS, cb.value));
                    idsToDelete.push(cb.value);
                });
                await batch.commit();
                
                state.recordsData = state.recordsData.filter(r => !idsToDelete.includes(r.id));
                updateUI();
                
                document.getElementById('btn-cancel-manage').click();
                showToast(`✅ 成功刪除 ${checkedBoxes.length} 筆資料`, "success");
            } catch(e) { showToast("批次刪除失敗", "danger"); }
            finally { btn.disabled = false; btn.innerText = "刪除選取項目"; }
        }},
        { text: "取消", class: "btn-light", dismiss: true }
    ]);
});

document.getElementById('btn-login').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('btn-logout').addEventListener('click', () => {
    showConfirm("登出", "確定要登出您的帳號嗎？", [
        { text: "登出", class: "btn-danger", onClick: () => signOut(auth) },
        { text: "取消", class: "btn-light", dismiss: true }
    ]);
});
