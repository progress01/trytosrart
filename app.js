import { db, auth, provider, signInWithPopup, onAuthStateChanged, signOut } from './firebase-config.js';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const COLLECTION_RECORDS = "LifeApp_Records"; 

// 🎯 前端狀態管理 (Local State Management)
let state = {
    currentUser: null,
    recordsData: [],
    isSubmitting: false, // 提交防呆鎖
    isManageMode: false
};

// 💡 工具函式
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

// 💡 初始載入與 Auth 狀態監聽
onAuthStateChanged(auth, async (user) => {
    if (user) {
        state.currentUser = user;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        
        // 防呆：日期不能選未來
        const todayYMD = getLocalYMD();
        const dateInput = document.getElementById('input-date');
        dateInput.value = todayYMD;
        dateInput.max = todayYMD;
        
        await fetchInitialData(); // 登入時抓取一次
    } else {
        state.currentUser = null;
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }
});

// 💡 核心改良：初次載入抓資料
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
        
        // 本地排序
        state.recordsData.sort((a, b) => new Date(b.date) - new Date(a.date) || b.timestamp - a.timestamp);
        updateUI(); // 驅動畫面渲染
    } catch (error) { 
        showToast("資料同步失敗，將使用離線快取", "warning"); 
    }
}

// 💡 核心改良：寫入資料庫並即時更新本地 State (不重新 Fetch)
document.getElementById('form-record').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(state.isSubmitting) return; // 防連點機制
    state.isSubmitting = true;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerText = "儲存中...";

    const type = document.getElementById('input-type').value;
    const categorySelect = document.getElementById('input-category');
    let categoryText = categorySelect.options[categorySelect.selectedIndex].text;
    
    // 防呆過濾：極端值清洗
    let rawAmount = parseFloat(document.getElementById('input-amount').value);
    if (isNaN(rawAmount) || rawAmount < 0 || rawAmount > 9999999) rawAmount = 0;

    let amountToSave = rawAmount;
    if (type === 'mood') amountToSave = parseFloat(categorySelect.value);
    if (type === 'habit' || type === 'learning') amountToSave = 1;

    const newRecord = {
        uid: state.currentUser.uid + "_life",
        date: document.getElementById('input-date').value,
        type: type,
        category: categorySelect.value,
        categoryText: categoryText,
        amount: amountToSave,
        note: document.getElementById('input-note').value.trim(),
        timestamp: Date.now()
    };

    try {
        const docRef = await addDoc(collection(db, COLLECTION_RECORDS), newRecord);
        newRecord.id = docRef.id;
        
        // 🚀 Optimistic Update: 直接推進陣列並重新渲染
        state.recordsData.push(newRecord);
        state.recordsData.sort((a, b) => new Date(b.date) - new Date(a.date) || b.timestamp - a.timestamp);
        updateUI();
        
        // 清空表單
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

// 💡 刪除紀錄：同樣操作本地 State
window.deleteRecord = async (id) => {
    if(!confirm("確定刪除此足跡？")) return;
    try {
        await deleteDoc(doc(db, COLLECTION_RECORDS, id));
        // 更新本地 State
        state.recordsData = state.recordsData.filter(r => r.id !== id);
        updateUI();
        showToast("🗑️ 已移除");
    } catch(e) { showToast("刪除失敗", "danger"); }
};

// ... 此處接續 UI 渲染邏輯 (updateStats, renderTables 等等) ...
function updateUI() {
    // 呼叫原本寫好的繪圖函式，餵給它 state.recordsData 即可
    // updateStats(state.recordsData);
    // renderTables(state.recordsData);
}

// 登入登出綁定
document.getElementById('btn-login').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));
