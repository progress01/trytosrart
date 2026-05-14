import { db, auth, provider, signInWithPopup, onAuthStateChanged, signOut } from './firebase-config.js';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, getDoc, setDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const COLLECTION_RECORDS = "LifeApp_Records"; 
const COLLECTION_SETTINGS = "LifeApp_Settings"; 

let state = {
    currentUser: null, recordsData: [], isSubmitting: false, isManageMode: false,
    activeReminderIdx: null,
    sysSettings: {
        coinRates: { money: 100, calorie: 100, learning: 30, habit: 10 },
        budgets: { day: 500, week: 3500, month: 15000 },
        customCats: { expense: [], income: [], food: [], exercise: [], learning: [], habit: [], sleep: [], mood: [], extra_expense: [], extra_income: [], investment: [] },
        quotes: [],
        subscriptions: [],
        fundPools: {}, 
        reminders: []  
    }
};

let chartInstances = { growth: null, finance: null, health: null };

const DEFAULT_CAT_MAP = {
    'learning': [ {val: 'eng_micro', text: '🔤 英文微接觸'}, {val: 'read_page', text: '📖 翻開書本/文獻'}, {val: 'tech_doc', text: '💻 架構與技術實作'} ],
    'habit': [ {val: 'water', text: '💧 喝水達標'}, {val: 'meditate', text: '🧘 思考'}, {val: 'clean', text: '🧹 整理環境'} ],
    'expense': [ {val: 'food', text: '餐飲'}, {val: 'transport', text: '交通'}, {val: 'shopping', text: '購物'}, {val: 'entertainment', text: '娛樂'} ],
    'income': [ {val: 'salary', text: '一般薪資'}, {val: 'bonus', text: '一般獎金'} ],
    'extra_expense': [ {val: 'insurance', text: '保險/稅金'}, {val: 'medical', text: '醫療/意外'}, {val: 'large_buy', text: '大筆購物'} ],
    'extra_income': [ {val: 'bonus_extra', text: '大筆獎金/紅利'}, {val: 'passive', text: '利息/被動收入'} ],
    'investment': [ {val: 'stock', text: '股票/ETF'}, {val: 'saving', text: '定存/儲蓄帳戶'} ],
    'food': [ {val: 'meal', text: '正餐'}, {val: 'snack', text: '零食/甜點'}, {val: 'drink', text: '飲料'} ],
    'exercise': [ {val: 'cardio', text: '有氧'}, {val: 'weight', text: '重訓'}, {val: 'stretch', text: '伸展'} ],
    'sleep': [ {val: 'night', text: '主睡眠'}, {val: 'nap', text: '午休小睡'} ],
    'mood': [ {val: '5', text: '🤩 充滿活力 (5分)'}, {val: '4', text: '🙂 穩定順暢 (4分)'}, {val: '3', text: '😐 平淡一般 (3分)'}, {val: '2', text: '😫 疲憊低迷 (2分)'}, {val: '1', text: '😭 徹底耗盡 (1分)'} ]
};

const DEFAULT_QUOTES = [
    "To see the world, things dangerous to come to, to see behind walls, draw closer, to find each other, and to feel. That is the purpose of life. -- 白日夢冒險王",
    "You got a dream... You gotta protect it. People can't do somethin' themselves, they wanna tell you you can't do it. If you want somethin', go get it. Period. -- 當幸福來敲門",
    "Yesterday is history, tomorrow is a mystery, but today is a gift. That is why it is called the present. -- 功夫熊貓",
    "But it ain't about how hard you hit. It's about how hard you can get hit and keep moving forward. -- 洛基：勇者無懼",
    "Hope is a good thing, maybe the best of things, and no good thing ever dies. -- 刺激1995",
    "逃げるは恥だが役に立つ。(逃避雖可恥但有用。) -- 逃避雖可恥但有用",
    "Money is the most universal and most efficient system of mutual trust ever devised. -- 人類大歷史",
    "You can't go back and change the beginning, but you can start where you are and change the ending. -- 獅子、女巫、魔衣櫥",
    "인생은 속도가 아니라 방향이다. (人生不是速度，而是方向。) -- 機智醫生生活",
    "우리에게는 내일이 있잖아. (我們不是還有明天嗎。) -- 請回答1988",
    "I am not afraid of storms, for I am learning how to sail my ship. -- 小婦人",
    "Life was like a box of chocolates. You never know what you're gonna get. -- 阿甘正傳"
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
    if(!toastEl) return;
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

const quoteCardEl = document.getElementById('quote-card');
if (quoteCardEl) {
    quoteCardEl.addEventListener('click', window.refreshQuote);
}

const rangeSelect = document.getElementById('overview-range');
const customStart = document.getElementById('custom-start-date');
const customEnd = document.getElementById('custom-end-date');
const customSep = document.getElementById('custom-date-sep');

function toggleCustomDateInputs() {
    if(!rangeSelect || !customStart) return;
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

if(rangeSelect) rangeSelect.addEventListener('change', toggleCustomDateInputs);
if(customStart) customStart.addEventListener('change', updateUI);
if(customEnd) customEnd.addEventListener('change', updateUI);

function getRangeBounds() {
    if(!rangeSelect) return { start: getLocalYMD(), end: getLocalYMD(), label: "今日", totalDays: 1 };
    const rangeType = rangeSelect.value;
    const now = new Date();
    const todayStr = getLocalYMD(now);
    
    if (rangeType === 'day') return { start: todayStr, end: todayStr, label: "今日", totalDays: 1 };
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
    if(!typeSelect || !categorySelect) return;
    
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
        if (state.activeReminderIdx === null) amtInput.value = "";
    }
}
const typeSelectEl = document.getElementById('input-type');
if(typeSelectEl) typeSelectEl.addEventListener('change', updateFormUI);

function updateUI() {
    updateStats(); 
    renderAnalyses(); 
    renderHeatmap(); 
    renderTables();
    renderFundPool(); 
    renderReminders(); 
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
}

function updateStats() {
    const rangeType = rangeSelect ? rangeSelect.value : 'day';
    const bounds = getRangeBounds();
    document.querySelectorAll('.range-label').forEach(el => el.innerText = bounds.label);
    
    let tExpense = 0, tIncome = 0, tFood = 0, tBurn = 0, tLearning = 0, tHabit = 0;
    let tExtraExp = 0, tExtraInc = 0, tInvest = 0;
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
            
            if (r.type === 'extra_expense') tExtraExp += r.amount;
            if (r.type === 'extra_income') tExtraInc += r.amount;
            if (r.type === 'investment') tInvest += r.amount;
        }
    });

    let tSub = 0;
    if(state.sysSettings.subscriptions && state.sysSettings.subscriptions.length > 0) {
        const bStart = new Date(bounds.start);
        const bEnd = new Date(bounds.end);
        
        state.sysSettings.subscriptions.forEach(sub => {
            const sStart = new Date(sub.start);
            const sEnd = new Date(sub.end);
            
            if (sEnd > sStart) {
                const totalSubDays = Math.ceil((sEnd - sStart) / (1000 * 60 * 60 * 24)) + 1;
                const dailyRate = sub.amount / totalSubDays;
                
                const overlapStart = bStart > sStart ? bStart : sStart;
                const overlapEnd = bEnd < sEnd ? bEnd : sEnd;
                
                if(overlapStart <= overlapEnd) {
                    const overlapDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
                    tSub += (dailyRate * overlapDays); 
                }
            }
        });
    }
    tSub = Math.round(tSub);

    let budget = state.sysSettings.budgets[rangeType] || 0;
    if (rangeType === 'custom') budget = state.sysSettings.budgets.day * bounds.totalDays;

    if (rangeType === 'month') {
        const targetMonth = bounds.start.substring(0, 7); 
        if (state.sysSettings.fundPools && state.sysSettings.fundPools[targetMonth]) {
            const poolSum = state.sysSettings.fundPools[targetMonth].reduce((acc, curr) => acc + curr.amount, 0);
            if (poolSum > 0) budget = poolSum; 
        }
    }
    
    let balance = (budget + tIncome) - tExpense - tSub;
    
    const savingEl = document.getElementById('stat-saving');
    if(savingEl) {
        savingEl.innerText = balance.toLocaleString();
        savingEl.className = `mt-2 mb-0 ${balance >= 0 ? 'val-income' : 'val-expense'}`;
    }
    
    if(document.getElementById('stat-expense')) document.getElementById('stat-expense').innerText = tExpense.toLocaleString();
    if(document.getElementById('stat-budget')) document.getElementById('stat-budget').innerText = budget.toLocaleString();
    if(document.getElementById('stat-sub')) document.getElementById('stat-sub').innerText = tSub.toLocaleString();

    if(document.getElementById('ana-extra-net')) {
        let extNet = tExtraInc - tExtraExp;
        document.getElementById('ana-extra-net').innerText = extNet >= 0 ? `+${extNet.toLocaleString()}` : extNet.toLocaleString();
        document.getElementById('ana-extra-net').className = `mb-0 ${extNet >= 0 ? 'val-income' : 'val-expense'}`;
    }
    if(document.getElementById('ana-invest')) document.getElementById('ana-invest').innerText = tInvest.toLocaleString();

    const deficit = tBurn - tFood; 
    const calorieEl = document.getElementById('stat-calorie');
    if(calorieEl) {
        calorieEl.innerText = deficit > 0 ? `+${deficit}` : deficit;
        calorieEl.className = `mt-2 mb-0 ${deficit >= 0 ? 'val-exercise' : 'val-expense'}`;
    }
    if(document.getElementById('stat-food')) document.getElementById('stat-food').innerText = tFood;
    if(document.getElementById('stat-burn')) document.getElementById('stat-burn').innerText = tBurn;

    if(document.getElementById('stat-learning')) document.getElementById('stat-learning').innerText = tLearning;
    if(document.getElementById('stat-habit')) document.getElementById('stat-habit').innerText = tHabit;

    const activeDaysCount = activeDates.size;
    const totalDays = bounds.totalDays;
    const progressPct = (activeDaysCount / totalDays) * 100;
    
    if(document.getElementById('stat-active-days')) document.getElementById('stat-active-days').innerText = activeDaysCount;
    if(document.getElementById('stat-total-days')) document.getElementById('stat-total-days').innerText = totalDays;
    const bar = document.getElementById('stat-active-bar');
    if(bar) {
        bar.style.width = `${progressPct}%`;
        bar.className = `progress-bar ${progressPct >= 80 ? 'bg-success' : (progressPct >= 50 ? 'bg-warning' : 'bg-secondary')}`;
    }
}

function getActiveMonthString() {
    const bounds = getRangeBounds();
    return bounds.start.substring(0, 7); 
}

function renderFundPool() {
    const mStr = getActiveMonthString();
    const lbl = document.getElementById('fp-month-label');
    if(lbl) lbl.innerText = mStr;
    
    const list = document.getElementById('fp-list');
    if(!list) return;
    list.innerHTML = "";
    
    let total = 0;
    const pool = state.sysSettings.fundPools?.[mStr] || [];
    
    pool.forEach((item, idx) => {
        total += item.amount;
        const li = document.createElement('li');
        li.className = "list-group-item d-flex justify-content-between align-items-center px-2 py-1 border-secondary bg-dark text-light";
        li.innerHTML = `
            <div>
                <span class="fw-bold me-2">${item.name}</span>
                <span class="text-success small">+${item.amount.toLocaleString()}</span>
            </div>
            <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="removeFundItem('${mStr}', ${idx})">✖</button>
        `;
        list.appendChild(li);
    });

    if (pool.length === 0) {
        list.innerHTML = `<li class="list-group-item px-2 py-3 text-center text-muted border-secondary bg-dark">尚未設定本月資金池，系統將使用預設月預算</li>`;
    }

    const totalEl = document.getElementById('fp-total-amount');
    if(totalEl) totalEl.innerText = total.toLocaleString();

    // 💡 結算本月【總互動結果】
    let mInc = 0, mExp = 0, mExtraInc = 0, mExtraExp = 0, mInvest = 0;
    state.recordsData.forEach(r => {
        if (r.date.startsWith(mStr)) {
            if (r.type === 'income') mInc += r.amount;
            if (r.type === 'expense') mExp += r.amount;
            if (r.type === 'extra_income') mExtraInc += r.amount;
            if (r.type === 'extra_expense') mExtraExp += r.amount;
            if (r.type === 'investment') mInvest += r.amount;
        }
    });

    // 換算本月訂閱總額
    let mSub = 0;
    const mParts = mStr.split('-');
    if (mParts.length >= 2) {
        const y = parseInt(mParts[0]);
        const m = parseInt(mParts[1]) - 1; 
        const mStart = new Date(y, m, 1);
        const mEnd = new Date(y, m + 1, 0, 23, 59, 59);

        if(state.sysSettings.subscriptions && state.sysSettings.subscriptions.length > 0) {
            state.sysSettings.subscriptions.forEach(sub => {
                const sStart = new Date(sub.start);
                const sEnd = new Date(sub.end);
                
                if (sEnd > sStart) {
                    const totalSubDays = Math.ceil((sEnd - sStart) / (1000 * 60 * 60 * 24)) + 1;
                    const dailyRate = sub.amount / totalSubDays;
                    const overlapStart = mStart > sStart ? mStart : sStart;
                    const overlapEnd = mEnd < sEnd ? mEnd : sEnd;
                    
                    if(overlapStart <= overlapEnd) {
                        const overlapDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
                        mSub += (dailyRate * overlapDays); 
                    }
                }
            });
        }
    }
    mSub = Math.round(mSub);

    let baseBudget = total > 0 ? total : (state.sysSettings.budgets.month || 15000);
    let totalIn = baseBudget + mInc + mExtraInc; 
    let dailyOut = mExp + mSub;                  
    let largeOut = mExtraExp + mInvest;          
    let finalNet = totalIn - dailyOut - largeOut;

    // 計算水位條百分比
    let mathTotal = totalIn > (dailyOut + largeOut) ? totalIn : (dailyOut + largeOut);
    let mathTotalSafe = mathTotal === 0 ? 1 : mathTotal; 
    
    let safeNet = finalNet > 0 ? finalNet : 0; 
    let pctNet = (safeNet / mathTotalSafe) * 100;
    let pctDaily = (dailyOut / mathTotalSafe) * 100;
    let pctLarge = (largeOut / mathTotalSafe) * 100;

    // 💡 確保摘要面板渲染在正確位置 (fp-list 下方)
    let summaryContainer = document.getElementById('fp-interaction-summary');
    if (!summaryContainer) {
        summaryContainer = document.createElement('div');
        summaryContainer.id = 'fp-interaction-summary';
        summaryContainer.className = 'mt-3 p-3 bg-dark border border-secondary rounded text-start';
        // 將面板插入到 ul 清單的下方，避免在警示框內跑版
        const fpList = document.getElementById('fp-list');
        if (fpList) {
            fpList.insertAdjacentElement('afterend', summaryContainer);
        }
    }
    
    summaryContainer.innerHTML = `
        <div class="d-flex justify-content-between small mb-1" style="color: #8b949e;">
            <span>日常收支與訂閱：</span>
            <span class="${(mInc - dailyOut) >= 0 ? 'text-success' : 'text-warning'}">${(mInc - dailyOut) >= 0 ? '+' : ''}${(mInc - dailyOut).toLocaleString()}</span>
        </div>
        <div class="d-flex justify-content-between small mb-2" style="color: #8b949e;">
            <span>大額挪用與投資：</span>
            <span class="${(mExtraInc - largeOut) >= 0 ? 'text-success' : 'text-danger'}">${(mExtraInc - largeOut) >= 0 ? '+' : ''}${(mExtraInc - largeOut).toLocaleString()}</span>
        </div>

        <div class="progress mt-2 mb-3 shadow-sm" style="height: 12px; background-color: #1a1e24; border-radius: 6px; overflow: hidden; border: 1px solid #30363d;">
            <div class="progress-bar bg-success" style="width: ${pctNet}%" title="可用餘額"></div>
            <div class="progress-bar bg-warning" style="width: ${pctDaily}%; opacity: 0.9;" title="日常消耗"></div>
            <div class="progress-bar bg-danger" style="width: ${pctLarge}%; opacity: 0.8;" title="大額/投資消耗"></div>
        </div>

        <div class="d-flex justify-content-between align-items-center pt-2" style="border-top: 1px dashed #444;">
            <span class="fw-bold text-white small">本月真實總結餘：</span>
            <span class="fw-bold fs-5 ${finalNet >= 0 ? 'text-success' : 'text-danger'}">${finalNet >= 0 ? '+' : ''}${finalNet.toLocaleString()}</span>
        </div>
    `;
}

const btnAddFp = document.getElementById('btn-add-fp');
if(btnAddFp) {
    btnAddFp.addEventListener('click', async () => {
        const mStr = getActiveMonthString();
        const name = document.getElementById('fp-name').value.trim();
        const amt = parseInt(document.getElementById('fp-amount').value);
        
        if (name && amt > 0) {
            if(!state.sysSettings.fundPools) state.sysSettings.fundPools = {};
            if(!state.sysSettings.fundPools[mStr]) state.sysSettings.fundPools[mStr] = [];
            
            state.sysSettings.fundPools[mStr].push({ name, amount: amt });
            document.getElementById('fp-name').value = "";
            document.getElementById('fp-amount').value = "";
            
            await saveSettingsData();
            updateUI(); 
        } else {
            showToast("請輸入名稱與有效金額", "warning");
        }
    });
}

window.removeFundItem = async (mStr, idx) => {
    state.sysSettings.fundPools[mStr].splice(idx, 1);
    await saveSettingsData();
    updateUI();
};

function renderReminders() {
    const list = document.getElementById('reminder-list');
    if(!list) return;
    list.innerHTML = "";
    
    const reminders = state.sysSettings.reminders || [];
    reminders.sort((a, b) => new Date(a.date) - new Date(b.date)); 
    
    reminders.forEach((rem, idx) => {
        const li = document.createElement('li');
        li.className = "list-group-item d-flex justify-content-between align-items-center bg-dark text-light border-secondary p-2 mb-1 rounded";
        const icon = rem.type === 'expense' ? '💸' : '🍱';
        const color = rem.type === 'expense' ? 'text-warning' : 'text-info';
        
        li.innerHTML = `
            <div class="d-flex flex-column flex-grow-1 me-2">
                <div class="fw-bold"><span class="me-1">${icon}</span> ${rem.text}</div>
                <div class="small d-flex gap-2 text-muted">
                    <span>📅 ${rem.date || '無日期'}</span>
                    <span class="${color} fw-bold">${rem.amount}</span>
                </div>
            </div>
            <div class="d-flex gap-1">
                <button class="btn btn-sm btn-primary py-1 px-2 fw-bold shadow-sm" onclick="fulfillReminder(${idx})" title="轉換為實際記帳">✍️ 記帳</button>
                <button class="btn btn-sm btn-outline-secondary py-1 px-2" onclick="removeReminder(${idx})" title="刪除">✖</button>
            </div>
        `;
        list.appendChild(li);
    });

    if(reminders.length === 0) {
        list.innerHTML = `<li class="list-group-item text-center text-muted bg-dark border-0 py-3">目前沒有預期追蹤事項</li>`;
    }
}

const btnAddReminder = document.getElementById('btn-add-reminder');
if(btnAddReminder) {
    btnAddReminder.addEventListener('click', async () => {
        const text = document.getElementById('rem-text').value.trim();
        const type = document.getElementById('rem-type').value;
        const amount = parseFloat(document.getElementById('rem-amount').value);
        const date = document.getElementById('rem-date').value || getLocalYMD();

        if (text && amount > 0) {
            if(!state.sysSettings.reminders) state.sysSettings.reminders = [];
            state.sysSettings.reminders.push({ text, type, amount, date });
            
            document.getElementById('rem-text').value = "";
            document.getElementById('rem-amount').value = "";
            document.getElementById('rem-date').value = "";
            
            await saveSettingsData();
            renderReminders();
        } else {
            showToast("請填寫項目名稱與有效數值", "warning");
        }
    });
}

window.removeReminder = async (idx) => {
    state.sysSettings.reminders.splice(idx, 1);
    await saveSettingsData();
    renderReminders();
};

window.fulfillReminder = (idx) => {
    const rem = state.sysSettings.reminders[idx];
    
    const dateInput = document.getElementById('input-date');
    if(dateInput && rem.date) dateInput.value = rem.date;
    
    const typeSelect = document.getElementById('input-type');
    typeSelect.value = rem.type;
    updateFormUI(); 
    
    state.activeReminderIdx = idx;
    
    document.getElementById('input-amount').value = rem.amount;
    document.getElementById('input-note').value = rem.text;
    
    new bootstrap.Modal(document.getElementById('recordModal')).show();
};

document.getElementById('recordModal').addEventListener('hidden.bs.modal', () => {
    state.activeReminderIdx = null;
    document.getElementById('input-amount').value = "";
    document.getElementById('input-note').value = "";
});


function renderAnalyses() {
    const rangeType = rangeSelect ? rangeSelect.value : 'day';
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
    if(document.getElementById('ana-learn-total')) document.getElementById('ana-learn-total').innerText = `${learnCount} 次`;
    if(document.getElementById('ana-habit-total')) document.getElementById('ana-habit-total').innerText = `${habitCount} 次`;
    drawChart('chart-growth', 'growth', '累積成長 (次)', growthLabels, growthData, gTooltips, '#39c5bb', 'rgba(57,197,187,0.1)');

    // 2. 💳 財務分析 (Finance) 
    let expenses = {}, topCat = "無", topAmt = 0;
    let finLabels = [], finData = [], fTooltips = [];
    
    let currentBalance = state.sysSettings.budgets[rangeType] || 0;
    if (rangeType === 'custom') currentBalance = state.sysSettings.budgets.day * bounds.totalDays;
    
    rangeRecords.forEach(r => {
        if (r.type === 'expense') {
            expenses[r.categoryText] = (expenses[r.categoryText] || 0) + r.amount;
            if (expenses[r.categoryText] > topAmt) { topAmt = expenses[r.categoryText]; topCat = r.categoryText; }
            currentBalance -= r.amount;
            finLabels.push(r.date.substring(5));
            finData.push(currentBalance);
            fTooltips.push(`日常支出: ${r.amount} (${r.categoryText})`);
        }
        if (r.type === 'income') {
            currentBalance += r.amount;
            finLabels.push(r.date.substring(5));
            finData.push(currentBalance);
            fTooltips.push(`日常收入: ${r.amount} (${r.categoryText})`);
        }
    });
    const anaNetWorth = document.getElementById('ana-net-worth');
    if(anaNetWorth) {
        anaNetWorth.innerText = currentBalance >= 0 ? `+${currentBalance.toLocaleString()}` : currentBalance.toLocaleString();
        anaNetWorth.className = `mb-0 ${currentBalance >= 0 ? 'val-income' : 'val-expense'}`;
    }
    if(document.getElementById('ana-top-expense')) document.getElementById('ana-top-expense').innerText = `${topCat}`;
    drawChart('chart-finance', 'finance', '日常可用結餘', finLabels, finData, fTooltips, '#58a6ff', 'rgba(88,166,255,0.1)');

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
    if(document.getElementById('ana-total-deficit')) document.getElementById('ana-total-deficit').innerText = totalDeficit > 0 ? `+${totalDeficit}` : totalDeficit;
    
    let fatLost = (totalDeficit / 7700).toFixed(2);
    const fatLossEl = document.getElementById('ana-fat-loss');
    if(fatLossEl) {
        if (fatLost > 0.05) { fatLossEl.innerText = `🔥 甩掉 ${fatLost} kg`; } 
        else if (totalDeficit > 0) { fatLossEl.innerText = `🧋 抵消 ${Math.floor(totalDeficit/500)} 杯珍奶`; } 
        else { fatLossEl.innerText = `保持平衡`; }
    }
    drawChart('chart-health', 'health', '累積赤字 (卡)', hlLabels, healData, hTooltips, '#3fb950', 'rgba(63,185,80,0.1)');

    // 4. 🌟 狀態分析 (Life)
    let highEnergyDays = new Set(), sleepSum = 0, sleepCount = 0;
    let moodCounts = {5:0, 4:0, 3:0, 2:0, 1:0};
    rangeRecords.forEach(r => {
        if (r.type === 'mood') {
            moodCounts[r.amount]++;
            if (r.amount >= 4) highEnergyDays.add(r.date);
        }
        if (r.type === 'sleep') { sleepSum += r.amount; sleepCount++; }
    });
    if(document.getElementById('ana-high-energy')) document.getElementById('ana-high-energy').innerText = `${highEnergyDays.size} 天`;
    if(document.getElementById('ana-sleep-avg')) document.getElementById('ana-sleep-avg').innerText = sleepCount > 0 ? (sleepSum/sleepCount).toFixed(1) + ' 小時' : '0 小時';

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
    if(document.getElementById('ana-mood-bars')) document.getElementById('ana-mood-bars').innerHTML = moodHtml;
}

function drawChart(canvasId, instanceKey, label, labels, data, tooltips, borderColor, bgColor) {
    if (typeof Chart === 'undefined') return;
    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) return;
    
    const ctx = canvasEl.getContext('2d');
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

const btnExport = document.getElementById('btn-export-csv');
if (btnExport) {
    btnExport.addEventListener('click', () => {
        if (!state.recordsData || state.recordsData.length === 0) {
            showToast("目前沒有資料可以匯出", "warning"); return;
        }
        const originalText = btnExport.innerText;
        btnExport.innerText = "⏳ 處理中...";
        btnExport.disabled = true;

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
            btnExport.innerText = originalText;
            btnExport.disabled = false;
        }
    });
}

function renderTables() {
    const finBody = document.getElementById('table-finance-body');
    const healBody = document.getElementById('table-health-body');
    const growBody = document.getElementById('table-growth-body');
    const lifeBody = document.getElementById('table-life-body');
    if(!finBody) return;
    
    let finHtml = "", healHtml = "", growHtml = "", lifeHtml = "";

    const typeMap = {
        'expense': { icon: '💸', color: 'val-expense', unit: '' },
        'income': { icon: '💰', color: 'val-income', unit: '' },
        'extra_expense': { icon: '🏦', color: 'val-expense', unit: '' },
        'extra_income': { icon: '💵', color: 'val-income', unit: '' }, 
        'investment': { icon: '📈', color: 'val-growth', unit: '' }, 
        'food': { icon: '🍱', color: 'val-food', unit: ' 大卡' },
        'exercise': { icon: '🏃', color: 'val-exercise', unit: ' 大卡' },
        'learning': { icon: '📚', color: 'val-growth', unit: ' 次' },
        'habit': { icon: '✅', color: 'val-growth', unit: ' 次' },
        'sleep': { icon: '💤', color: 'val-life', unit: ' 小時' },
        'mood': { icon: '🌟', color: 'val-life', unit: ' 分' }
    };

    state.recordsData.forEach(r => {
        const conf = typeMap[r.type];
        let displayVal = (['expense', 'income', 'extra_expense', 'extra_income', 'investment'].includes(r.type)) ? r.amount.toLocaleString() : r.amount;
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
        
        if (['expense', 'income', 'extra_expense', 'extra_income', 'investment'].includes(r.type)) finHtml += tr;
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
    if(!container) return;
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

const btnReport = document.getElementById('btn-generate-report');
if(btnReport) {
    btnReport.addEventListener('click', () => {
        const rangeType = rangeSelect ? rangeSelect.value : 'day';
        const bounds = getRangeBounds();
        document.getElementById('report-range-label').innerText = bounds.label;
        document.getElementById('report-user-name').innerText = `👤 ${state.currentUser.displayName}`;

        let tExpense = 0, tIncome = 0, tFood = 0, tBurn = 0, tLearning = 0, tHabit = 0;
        let dayStats = {}; 

        state.recordsData.forEach(r => {
            if (r.date >= bounds.start && r.date <= bounds.end) {
                if(!dayStats[r.date]) dayStats[r.date] = { expense: 0, food: 0, goodDeeds: 0 };
                if (r.type === 'expense') { tExpense += r.amount; dayStats[r.date].expense += r.amount; }
                if (r.type === 'income') { tIncome += r.amount; dayStats[r.date].goodDeeds++; }
                if (r.type === 'food') { tFood += r.amount; dayStats[r.date].food += r.amount; }
                if (r.type === 'exercise') { tBurn += r.amount; dayStats[r.date].goodDeeds++; }
                if (r.type === 'learning') { tLearning += r.amount; dayStats[r.date].goodDeeds++; }
                if (r.type === 'habit') { tHabit += r.amount; dayStats[r.date].goodDeeds++; }
            }
        });

        let tSub = 0;
        if(state.sysSettings.subscriptions && state.sysSettings.subscriptions.length > 0) {
            const bStart = new Date(bounds.start);
            const bEnd = new Date(bounds.end);
            
            state.sysSettings.subscriptions.forEach(sub => {
                const sStart = new Date(sub.start);
                const sEnd = new Date(sub.end);
                
                if (sEnd > sStart) {
                    const totalSubDays = Math.ceil((sEnd - sStart) / (1000 * 60 * 60 * 24)) + 1;
                    const dailyRate = sub.amount / totalSubDays;
                    
                    const overlapStart = bStart > sStart ? bStart : sStart;
                    const overlapEnd = bEnd < sEnd ? bEnd : sEnd;
                    
                    if(overlapStart <= overlapEnd) {
                        const overlapDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
                        tSub += (dailyRate * overlapDays); 
                    }
                }
            });
        }
        tSub = Math.round(tSub);

        let slackDays = bounds.totalDays - Object.keys(dayStats).length; 
        Object.values(dayStats).forEach(ds => {
            if (ds.goodDeeds === 0 && (ds.expense > 2000 || ds.food > 2500)) slackDays++;
        });
        const slackRate = Math.round((slackDays / bounds.totalDays) * 100);

        let budget = state.sysSettings.budgets[rangeType] || 0;
        if (rangeType === 'custom') budget = state.sysSettings.budgets.day * bounds.totalDays;

        if (rangeType === 'month') {
            const targetMonth = bounds.start.substring(0, 7); 
            if (state.sysSettings.fundPools && state.sysSettings.fundPools[targetMonth]) {
                const poolSum = state.sysSettings.fundPools[targetMonth].reduce((acc, curr) => acc + curr.amount, 0);
                if (poolSum > 0) budget = poolSum; 
            }
        }
        
        let balance = (budget + tIncome) - tExpense - tSub;
        let calorieDeficit = tBurn - tFood;
        let lifeCoin = 0;

        const rates = state.sysSettings.coinRates;
        if(balance > 0) lifeCoin += Math.floor(balance / rates.money);
        if(calorieDeficit > 0) lifeCoin += Math.floor(calorieDeficit / rates.calorie);
        lifeCoin += (tLearning * rates.learning);
        lifeCoin += (tHabit * rates.habit);

        const card = document.getElementById('tier-card-container');
        const titleEl = document.getElementById('report-tier-title');
        card.className = "tier-card"; 
        
        let tierClass, titleClass, titleText; 
        
        let coinTarget = 100;
        if (rangeType === 'day') coinTarget = 15;
        if (rangeType === 'month') coinTarget = 400;
        if (rangeType === 'custom') coinTarget = 15 * bounds.totalDays;

        if (lifeCoin >= coinTarget * 1.5 && slackRate <= 20) {
            tierClass = "tier-s"; titleClass = "title-s"; titleText = "👑 究極自律神人 (S)";
        } else if (lifeCoin >= coinTarget) {
            tierClass = "tier-a"; titleClass = "title-a"; titleText = "🌟 優秀發揮 (A)";
        } else if (lifeCoin >= coinTarget * 0.5) {
            tierClass = "tier-b"; titleClass = "title-b"; titleText = "🙂 穩步前進 (B)";
        } else {
            tierClass = "tier-f"; titleClass = "title-f"; titleText = "🌚 徹底放飛 (F)";
        }

        card.classList.add(tierClass);
        titleEl.className = `tier-title ${titleClass}`;
        titleEl.innerText = titleText;

        document.getElementById('report-life-coin').innerText = lifeCoin;
        document.getElementById('report-net-finance').innerText = balance >= 0 ? `+${balance.toLocaleString()}` : balance.toLocaleString();
        document.getElementById('report-net-finance').className = `fw-bold fs-5 ${balance >= 0 ? 'text-success' : 'text-danger'}`;
        document.getElementById('report-net-calorie').innerText = calorieDeficit >= 0 ? `+${calorieDeficit}` : calorieDeficit;
        document.getElementById('report-net-calorie').className = `fw-bold fs-5 ${calorieDeficit >= 0 ? 'text-info' : 'text-danger'}`;
        document.getElementById('report-learning-hrs').innerText = tLearning;
        document.getElementById('report-slacking-rate').innerText = `${slackRate}%`;
    });
}

async function loadSettings() {
    if (!state.currentUser) return;
    const docRef = doc(db, COLLECTION_SETTINGS, state.currentUser.uid + "_life");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        state.sysSettings.budgets = { ...state.sysSettings.budgets, ...(data.budgets || {}) };
        state.sysSettings.coinRates = { ...state.sysSettings.coinRates, ...(data.coinRates || {}) };
        
        if(data.customCats) {
            Object.keys(data.customCats).forEach(k => {
                if(!state.sysSettings.customCats[k]) state.sysSettings.customCats[k] = [];
                state.sysSettings.customCats[k] = data.customCats[k];
            });
        }
        state.sysSettings.quotes = data.quotes || [];
        state.sysSettings.subscriptions = data.subscriptions || []; 
        state.sysSettings.fundPools = data.fundPools || {}; 
        state.sysSettings.reminders = data.reminders || []; 
    }
    updateSettingsModalUI();
}

async function saveSettingsData() {
    const docRef = doc(db, COLLECTION_SETTINGS, state.currentUser.uid + "_life");
    await setDoc(docRef, state.sysSettings, { merge: true });
    updateFormUI(); 
}

function updateSettingsModalUI() {
    if(document.getElementById('set-budget-day')) {
        document.getElementById('set-budget-day').value = state.sysSettings.budgets?.day || 500;
        document.getElementById('set-budget-week').value = state.sysSettings.budgets?.week || 3500;
        document.getElementById('set-budget-month').value = state.sysSettings.budgets?.month || 15000;
        document.getElementById('set-rate-money').value = state.sysSettings.coinRates.money;
        document.getElementById('set-rate-calorie').value = state.sysSettings.coinRates.calorie;
        document.getElementById('set-rate-learn').value = state.sysSettings.coinRates.learning;
        document.getElementById('set-rate-habit').value = state.sysSettings.coinRates.habit;
    }
    renderCustomCatList();
    renderQuoteList();
    renderSubList(); 
}

const btnSaveSettings = document.getElementById('btn-save-settings');
if(btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
        state.sysSettings.budgets = {
            day: parseInt(document.getElementById('set-budget-day').value) || 500,
            week: parseInt(document.getElementById('set-budget-week').value) || 3500,
            month: parseInt(document.getElementById('set-budget-month').value) || 15000
        };
        state.sysSettings.coinRates.money = parseInt(document.getElementById('set-rate-money').value) || 100;
        state.sysSettings.coinRates.calorie = parseInt(document.getElementById('set-rate-calorie').value) || 100;
        state.sysSettings.coinRates.learning = parseInt(document.getElementById('set-rate-learn').value) || 30;
        state.sysSettings.coinRates.habit = parseInt(document.getElementById('set-rate-habit').value) || 10;
        await saveSettingsData();
        showToast("✅ 設定儲存成功");
        bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
        
        updateUI();
        if(document.getElementById('reportModal') && document.getElementById('reportModal').classList.contains('show')) {
            document.getElementById('btn-generate-report').click();
        }
    });
}

const btnAddSub = document.getElementById('btn-add-sub');
if(btnAddSub) {
    btnAddSub.addEventListener('click', async () => {
        const name = document.getElementById('set-sub-name').value.trim();
        const amt = parseFloat(document.getElementById('set-sub-amount').value);
        const start = document.getElementById('set-sub-start').value;
        const end = document.getElementById('set-sub-end').value;
        
        if (new Date(end) <= new Date(start)) {
            showToast("到期日必須晚於起始日喔！", "warning");
            return;
        }

        if (name && amt > 0 && start && end) {
            if(!state.sysSettings.subscriptions) state.sysSettings.subscriptions = [];
            state.sysSettings.subscriptions.push({ name, amount: amt, start, end });
            
            document.getElementById('set-sub-name').value = "";
            document.getElementById('set-sub-amount').value = "";
            await saveSettingsData();
            renderSubList();
            updateUI();
        } else {
            showToast("請完整填寫訂閱資料與起訖日", "warning");
        }
    });
}

window.removeSub = async (index) => {
    state.sysSettings.subscriptions.splice(index, 1);
    await saveSettingsData();
    renderSubList();
    updateUI();
};

function renderSubList() {
    const list = document.getElementById('custom-sub-list');
    if(!list) return;
    list.innerHTML = "";
    (state.sysSettings.subscriptions || []).forEach((sub, idx) => {
        const li = document.createElement('li');
        li.className = "list-group-item d-flex justify-content-between align-items-center bg-dark text-light border-secondary";
        
        const sStart = new Date(sub.start);
        const sEnd = new Date(sub.end);
        let dailyHint = "";
        if (sEnd > sStart) {
            const days = Math.ceil((sEnd - sStart) / (1000 * 60 * 60 * 24)) + 1;
            dailyHint = `(約 ${Math.round(sub.amount / days)}/日)`;
        }

        li.innerHTML = `<div><span class="badge bg-warning text-dark me-2">總額 ${sub.amount}</span> 
                        <span class="fw-bold">${sub.name}</span> <span class="small text-muted">${dailyHint}</span>
                        <div class="small text-muted">${sub.start} ~ ${sub.end}</div></div>
                        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="removeSub(${idx})">✖</button>`;
        list.appendChild(li);
    });
}

const btnAddCustomCat = document.getElementById('btn-add-custom-cat');
if(btnAddCustomCat) {
    btnAddCustomCat.addEventListener('click', async () => {
        const type = document.getElementById('set-cat-type').value;
        const name = document.getElementById('set-cat-name').value.trim();
        if (name && !state.sysSettings.customCats[type].includes(name)) {
            state.sysSettings.customCats[type].push(name);
            document.getElementById('set-cat-name').value = "";
            await saveSettingsData();
            renderCustomCatList();
        }
    });
}

window.removeCustomCat = async (type, index) => {
    state.sysSettings.customCats[type].splice(index, 1);
    await saveSettingsData();
    renderCustomCatList();
};

function renderCustomCatList() {
    const list = document.getElementById('custom-cat-list');
    if(!list) return;
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
const setCatType = document.getElementById('set-cat-type');
if(setCatType) setCatType.addEventListener('change', renderCustomCatList);

const btnAddQuote = document.getElementById('btn-add-quote');
if(btnAddQuote) {
    btnAddQuote.addEventListener('click', async () => {
        const quoteInput = document.getElementById('set-custom-quote');
        const text = quoteInput.value.trim();
        
        if(!state.sysSettings.quotes) state.sysSettings.quotes = [];

        if (text && !state.sysSettings.quotes.includes(text)) {
            state.sysSettings.quotes.push(text);
            quoteInput.value = "";
            await saveSettingsData();
            renderQuoteList();
            window.refreshQuote(); 
        } else if (!text) {
            showToast("請輸入金句內容", "warning");
        } else {
            showToast("這句已經在清單中囉", "warning");
        }
    });
}

window.removeQuote = async (index) => {
    state.sysSettings.quotes.splice(index, 1);
    await saveSettingsData();
    renderQuoteList();
};

function renderQuoteList() {
    const list = document.getElementById('custom-quote-list');
    if(!list) return;
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
        if(customStart) customStart.value = todayYMD;
        if(customEnd) customEnd.value = todayYMD;   
        if(dateInput) {
            dateInput.value = todayYMD;
            dateInput.max = todayYMD;
        }
        
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
    } catch (error) { 
        console.error("Firebase Sync Error:", error);
        showToast("資料庫同步異常，請檢查網路連線", "warning"); 
    }

    try {
        updateUI(); 
    } catch (renderError) {
        console.error("畫面渲染錯誤:", renderError);
    }
}

const formRecord = document.getElementById('form-record');
if(formRecord) {
    formRecord.addEventListener('submit', async (e) => {
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
            
            if (state.activeReminderIdx !== null && state.activeReminderIdx !== undefined) {
                state.sysSettings.reminders.splice(state.activeReminderIdx, 1);
                state.activeReminderIdx = null; 
                saveSettingsData(); 
            }
            
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
}

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

const btnToggleManage = document.getElementById('btn-toggle-manage');
if(btnToggleManage) {
    btnToggleManage.addEventListener('click', () => {
        state.isManageMode = true;
        btnToggleManage.classList.add('d-none');
        document.getElementById('manage-bar').classList.remove('d-none');
        document.querySelectorAll('.action-lock').forEach(el => el.classList.add('disabled-mode'));
        renderTables();
    });
}

const btnCancelManage = document.getElementById('btn-cancel-manage');
if(btnCancelManage) {
    btnCancelManage.addEventListener('click', () => {
        state.isManageMode = false;
        document.getElementById('btn-toggle-manage').classList.remove('d-none');
        document.getElementById('manage-bar').classList.add('d-none');
        document.querySelectorAll('.action-lock').forEach(el => el.classList.remove('disabled-mode'));
        renderTables();
    });
}

const btnBatchDelete = document.getElementById('btn-batch-delete');
if(btnBatchDelete) {
    btnBatchDelete.addEventListener('click', () => {
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
}

document.getElementById('btn-login').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('btn-logout').addEventListener('click', () => {
    showConfirm("登出", "確定要登出您的帳號嗎？", [
        { text: "登出", class: "btn-danger", onClick: () => signOut(auth) },
        { text: "取消", class: "btn-light", dismiss: true }
    ]);
});
