let savedCats = JSON.parse(localStorage.getItem('vb_categories'));
const defaultExpCats = ['emrah', 'sandviç', 'yemek', 'migros', 'metro', 'dükkan', 'Ev', 'Kişisel', 'fırça', 'yasar', 'meron', 'Barut', 'Part', 'Kahve', 'kira', 'Ekrem abi', 'Türkmenler', 'Kap', 'Temizlik', 'Çikolata', 'maaş', 'harun'];

if (!savedCats || !savedCats.expense.includes('emrah')) {
    savedCats = {
        income: ['Kart', 'Nakit'],
        expense: defaultExpCats
    };
    localStorage.setItem('vb_categories', JSON.stringify(savedCats));
}

let state = {
    transactions: JSON.parse(localStorage.getItem('vb_transactions')) || [],
    categories: savedCats
};
let isEditCategoryMode = false;
let currentReportDate = new Date(); // Tracks the currently shown month for reports
let isVisible = false;

function toggleVisibility() {
    isVisible = !isVisible;
    const btn = document.getElementById('toggle-vis-btn');
    if(btn) {
        btn.innerHTML = isVisible ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        if(isVisible) {
            btn.style.color = "var(--success)";
        } else {
            btn.style.color = "";
        }
    }
    render();
}

function setYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');
    document.getElementById('t-date').value = `${yyyy}-${mm}-${dd}`;
}

// DOM Elements
const totalBalanceEl = document.getElementById('total-balance');
const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const transactionsListEl = document.getElementById('transactions-list');
const aiPredictionsListEl = document.getElementById('ai-predictions-list');
const categoryContainer = document.getElementById('category-container');
const tCategoryInput = document.getElementById('t-category');
const categoryWarning = document.getElementById('category-warning');

// Save State
function saveState() {
    localStorage.setItem('vb_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('vb_categories', JSON.stringify(state.categories));
    render();
    renderReports();
}

// Format Amount Input on exactly typing
function formatAmountInput(inputEl) {
    let val = inputEl.value;
    // Remove taking out everything except digits
    val = val.replace(/\D/g, '');
    if(!val) { inputEl.value = ''; return; }
    
    // Add thousand separator dots
    inputEl.value = parseInt(val, 10).toLocaleString('tr-TR');
}

// Format Currency Output
function formatMoney(amount) {
    if(amount === 0) return '-';
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}
// Precise money for top cards
function formatMoneyPrecise(amount) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
}

function setTxType(type) {
    document.getElementById('t-type').value = type;
    document.getElementById('type-inc').classList.remove('active');
    document.getElementById('type-exp').classList.remove('active');
    if(type === 'income') document.getElementById('type-inc').classList.add('active');
    else document.getElementById('type-exp').classList.add('active');
    
    renderCategoryButtons(type);
}

// Render Categories for the Form
function renderCategoryButtons(type) {
    const list = state.categories[type];
    categoryContainer.innerHTML = '';
    tCategoryInput.value = '';
    
    list.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `cat-btn ${isEditCategoryMode ? 'shake' : ''}`;
        
        if (isEditCategoryMode) {
            btn.innerHTML = `<i class="fas fa-times text-danger" style="margin-right:3px;"></i> ${cat}`;
            btn.style.borderColor = 'var(--danger)';
            btn.onclick = () => deleteCategory(type, cat);
        } else {
            btn.innerText = cat;
            btn.onclick = (e) => {
                const amountStr = document.getElementById('t-amount').value;
                if(!amountStr) {
                    alert("Lütfen listeye eklemek için önce TUTAR (₺) değerini girin, ardından kategoriye tıklayın.");
                    return;
                }
                
                tCategoryInput.value = cat;
                categoryWarning.style.display = 'none';
                
                addManualTransaction();
            }
        }
        categoryContainer.appendChild(btn);
    });

    // Add "+" button if edit mode
    if(isEditCategoryMode) {
        const addBtn = document.createElement('button');
        addBtn.className = `cat-btn`;
        addBtn.style.background = 'rgba(255,255,255,0.1)';
        addBtn.innerHTML = `<i class="fas fa-plus"></i> Ekle`;
        addBtn.onclick = () => addCategory(type);
        categoryContainer.appendChild(addBtn);
    }
}

function toggleEditCategories() {
    isEditCategoryMode = !isEditCategoryMode;
    const currentType = document.getElementById('t-type').value;
    renderCategoryButtons(currentType);
}

function addCategory(type) {
    const newCat = prompt("Yeni kategori adı giriniz:");
    if(!newCat || newCat.trim() === '') return;
    
    const catClean = newCat.trim();
    if(!state.categories[type].includes(catClean)) {
        state.categories[type].push(catClean);
        saveState();
        renderCategoryButtons(type);
    }
}

function deleteCategory(type, catName) {
    if(confirm(`"${catName}" kategorisini silmek istediğinize emin misiniz?`)) {
        state.categories[type] = state.categories[type].filter(c => c !== catName);
        saveState();
        renderCategoryButtons(type);
    }
}

// Navigation Logic for Pivot Reports
function changeReportMonth(delta) {
    currentReportDate.setMonth(currentReportDate.getMonth() + delta);
    renderReports();
}

// Add Transaction
function addManualTransaction() {
    const type = document.getElementById('t-type').value;
    const amountStr = document.getElementById('t-amount').value;
    
    // Parse formatted string back to number (e.g. 20.000 -> 20000)
    const amount = parseFloat(amountStr.replace(/\./g, ''));
    
    const desc = document.getElementById('t-desc').value;
    const category = tCategoryInput.value;
    const manualDate = document.getElementById('t-date').value;

    if(!amount || isNaN(amount)) { alert("Lütfen geçerli bir tutar giriniz."); return; }
    if(!category) { categoryWarning.style.display = 'inline'; return; }

    let dateToSave;
    if (manualDate) {
        const [y, m, d] = manualDate.split('-');
        const localDate = new Date(y, m - 1, d, 12, 0, 0); // Noon to avoid timezone shift
        dateToSave = localDate.toISOString();
    } else {
        dateToSave = new Date().toISOString();
    }

    const newTx = {
        id: Date.now().toString(),
        type,
        amount,
        desc: desc || category,
        category,
        date: dateToSave
    };
    
    state.transactions.unshift(newTx);
    saveState();
    
    document.getElementById('t-amount').value = '';
    document.getElementById('t-desc').value = '';
    document.getElementById('t-date').value = '';
    tCategoryInput.value = '';
    renderCategoryButtons(type);
}

// Programmatic / Voice Add
function addTransaction(type, amount, desc, category) {
    const newTx = {
        id: Date.now().toString(),
        type,
        amount,
        desc: desc || category,
        category: category || 'Diğer',
        date: new Date().toISOString()
    };
    state.transactions.unshift(newTx);
    saveState();
}

function deleteTransaction(id) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveState();
}

function resetData() {
    if(confirm("Tüm veri ve geçmiş kayıtlarınız silinecek emin misiniz? (Tüm yılları kapsar)")) {
        state.transactions = [];
        saveState();
        currentReportDate = new Date(); // Reset to today
        renderReports();
    }
}

// Backup & Restore
function exportData() {
    const dataStr = JSON.stringify(state);
    const blob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `butcem-yedek-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedState = JSON.parse(e.target.result);
            if(importedState.transactions) {
                state = importedState;
                saveState();
                currentReportDate = new Date(); // Reset view to current timeline
                renderReports();
                alert("Yedek başarıyla yüklendi! Eski yıllar geri getirildi.");
            } else {
                alert("Geçersiz yedek dosyası!");
            }
        } catch(err) {
            alert("Dosya okunamadı. Format hatası.");
        }
    };
    reader.readAsText(file);
    // Reset file input so same file can trigger change again
    event.target.value = '';
}

// SMART AI LOGIC
function generateAIPredictions() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const recent = state.transactions.filter(t => new Date(t.date) >= thirtyDaysAgo && t.type === 'expense');
    
    const groups = {};
    recent.forEach(t => {
        const key = t.category;
        if(!groups[key]) groups[key] = [];
        groups[key].push(t);
    });
    
    const insights = [];
    for(const key in groups) {
        const txs = groups[key];
        txs.sort((a,b) => new Date(a.date) - new Date(b.date));
        
        if (txs.length >= 2) {
            const firstDate = new Date(txs[0].date);
            const lastDate = new Date(txs[txs.length - 1].date);
            const diffDays = Math.max((lastDate - firstDate) / (1000 * 60 * 60 * 24), 1);
            const totalAmount = txs.reduce((sum, t) => sum + t.amount, 0);
            const dailyAvg = totalAmount / diffDays;
            
            insights.push({ 
                category: key, 
                count: txs.length, 
                total: totalAmount, 
                daily: dailyAvg 
            });
        }
    }
    return insights.sort((a,b) => b.total - a.total);
}

function renderRecentDaysSummary() {
    const container = document.getElementById('recent-days-list');
    if (!container) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const daysData = [];
    for(let i=0; i<3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        daysData.push({
            dateObj: d,
            income: 0,
            expense: 0
        });
    }

    state.transactions.forEach(t => {
        const txDate = new Date(t.date);
        const txDay = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
        
        const diffDays = Math.round((today - txDay) / (1000 * 60 * 60 * 24));
        if(diffDays >= 0 && diffDays < 3) {
            if(t.type === 'income') daysData[diffDays].income += t.amount;
            else daysData[diffDays].expense += t.amount;
        }
    });

    let html = '';
    const dayNames = ['Bugün', 'Dün', 'Önceki Gün'];
    
    daysData.forEach((data, index) => {
        const dateStr = data.dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
        html += `
            <div class="list-item" style="padding: 0.4rem 0.6rem;">
                <div class="item-info">
                    <h4 style="font-size:0.85rem;">${dayNames[index]} <span class="cat-tag">${dateStr}</span></h4>
                </div>
                <div class="item-amount" style="display:flex; gap:1rem; font-size:0.85rem; justify-content:flex-end;">
                    <div style="text-align:right;"><span style="color:var(--text-muted); font-size:0.6rem; display:block;">GELİR</span><span class="inc" style="font-family: 'JetBrains Mono', monospace;">${formatMoneyPrecise(data.income)}</span></div>
                    <div style="text-align:right;"><span style="color:var(--text-muted); font-size:0.6rem; display:block;">GİDER</span><span class="exp" style="font-family: 'JetBrains Mono', monospace;">${formatMoneyPrecise(data.expense)}</span></div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Main Render
function render() {
    let income = 0; let expense = 0;
    state.transactions.forEach(t => {
        if(t.type === 'income') income += t.amount;
        else expense += t.amount;
    });
    
    totalIncomeEl.innerText = isVisible ? formatMoneyPrecise(income) : '*** ₺';
    totalExpenseEl.innerText = isVisible ? formatMoneyPrecise(expense) : '*** ₺';
    totalBalanceEl.innerText = isVisible ? formatMoneyPrecise(income - expense) : '*** ₺';
    
    renderRecentDaysSummary();
    
    transactionsListEl.innerHTML = '';
    if(state.transactions.length === 0) {
        transactionsListEl.innerHTML = `<div class="empty-state">İşlem yok.</div>`;
    } else {
        const displayData = [...state.transactions].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 15);
        displayData.forEach(t => {
            const isInc = t.type === 'income';
            transactionsListEl.innerHTML += `
                <div class="list-item">
                    <div class="item-info">
                        <h4>${t.desc} <span class="cat-tag">${t.category}</span></h4>
                        <p>${new Date(t.date).toLocaleDateString('tr-TR')}</p>
                    </div>
                    <div class="item-amount">
                        <span class="amount-val ${isInc ? 'inc' : 'exp'}">${isInc ? '+' : '-'}${formatMoneyPrecise(t.amount)}</span>
                        <button class="delete-btn" onclick="deleteTransaction('${t.id}')"><i class="fas fa-times"></i></button>
                    </div>
                </div>
            `;
        });
    }

    const insights = generateAIPredictions();
    aiPredictionsListEl.innerHTML = '';
    if(insights.length === 0) {
        aiPredictionsListEl.innerHTML = `<div class="empty-state" style="padding-top:2rem;">Gelecek tahminleri için veriler analiz ediliyor...</div>`;
    } else {
        let tableHTML = `<div class="pivot-wrapper" style="border:none; background:transparent;"><table class="pivot-table" style="width:100%;">
            <thead><tr><th style="text-align:left;">Kategori</th><th>Alım Sayısı</th><th>Toplam</th><th>Günlük Ort.</th></tr></thead><tbody>`;
        
        insights.forEach(insight => {
            tableHTML += `<tr>
                <td style="text-align:left;"><i class="fas fa-sparkles text-main" style="margin-right:4px;"></i> <strong>${insight.category}</strong></td>
                <td class="mono">${insight.count} Kez</td>
                <td class="td-val exp">${formatMoneyPrecise(insight.total)}</td>
                <td class="td-total exp" style="background:transparent;">${formatMoneyPrecise(insight.daily)}</td>
            </tr>`;
        });
        tableHTML += `</tbody></table></div>`;
        aiPredictionsListEl.innerHTML = tableHTML;
    }
}

// Render Reports (TRIPLE PIVOT TABLES)
function renderReports() {
    const containerEl = document.getElementById('pivot-container');
    const labelEl = document.getElementById('report-month-label');
    
    // Update the label
    const year = currentReportDate.getFullYear();
    const month = currentReportDate.getMonth();
    labelEl.innerText = currentReportDate.toLocaleString('tr-TR', { month: 'long', year: 'numeric' }).toUpperCase();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Filter txs to current viewed month
    let monthTxs = state.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });

    // Sub-function to build a single HTML matrix table string
    function buildMatrixHTML(title, txs, matrixColorClass) {
        const matrix = {};
        
        txs.forEach(t => {
            const cat = t.category || "Diğer";
            if(!matrix[cat]) { matrix[cat] = Array(daysInMonth).fill(0); }
            const dayIdx = new Date(t.date).getDate() - 1; 
            matrix[cat][dayIdx] += t.amount;
        });

        const categoryNames = Object.keys(matrix).sort();
        const colTotals = Array(daysInMonth).fill(0);
        let grandTotal = 0;

        let html = `<div style="margin-bottom: 2rem;">
            <h4 style="margin-bottom: 0.5rem; color: var(--text-muted);">${title}</h4>
            <table class="pivot-table"><thead><tr><th>Kategori</th>`;
        
        for(let d=1; d<=daysInMonth; d++) html += `<th>${d}</th>`;
        html += `<th>Toplam</th></tr></thead><tbody>`;

        if(categoryNames.length === 0) {
            html += `<tr><td colspan="${daysInMonth + 2}" class="empty-state">Kayıt bulunmuyor.</td></tr>`;
        } else {
            categoryNames.forEach(cat => {
                html += `<tr><th>${cat}</th>`;
                let rowSum = 0;
                for(let d=0; d<daysInMonth; d++) {
                    const val = matrix[cat][d];
                    rowSum += val;
                    colTotals[d] += val;
                    
                    const valStr = val === 0 ? '-' : formatMoney(val);
                    const tdClass = val === 0 ? 'td-zero' : `td-val ${matrixColorClass}`;
                    html += `<td class="${tdClass}">${valStr}</td>`;
                }
                grandTotal += rowSum;
                html += `<td class="td-total ${matrixColorClass}">${formatMoney(rowSum)}</td></tr>`;
            });

            // Total Row
            html += `<tr><th>Dağılım Toplamı</th>`;
            for(let d=0; d<daysInMonth; d++) {
                const val = colTotals[d];
                const valStr = val === 0 ? '-' : formatMoney(val);
                const tdClass = val === 0 ? 'td-zero' : `td-total ${matrixColorClass}`;
                html += `<td class="${tdClass}">${valStr}</td>`;
            }
            html += `<td class="td-total ${matrixColorClass}" style="font-size: 0.9rem;">${formatMoney(grandTotal)}</td></tr>`;
        }
        html += `</tbody></table></div>`;
        
        return { html, colTotals, grandTotal };
    }

    // 1. Build Expense Matrix
    const expTxs = monthTxs.filter(t => t.type === 'expense');
    const expData = buildMatrixHTML('🔴 GİDER Tablosu', expTxs, 'exp');

    // 2. Build Income Matrix
    const incTxs = monthTxs.filter(t => t.type === 'income');
    const incData = buildMatrixHTML('🟢 GELİR Tablosu', incTxs, 'inc');

    // 3. Build Summary Matrix
    let summaryHTML = `<div style="margin-bottom: 1rem;">
        <h4 style="margin-bottom: 0.5rem; color: var(--text-main);">📊 GÜNLÜK NET ÖZET</h4>
        <table class="pivot-table"><thead><tr><th>Kategori</th>`;
    for(let d=1; d<=daysInMonth; d++) summaryHTML += `<th>${d}</th>`;
    summaryHTML += `<th>Genel Toplam</th></tr></thead><tbody>`;

    // Row 1: Income
    summaryHTML += `<tr><th>Gelir</th>`;
    let totalIn = 0;
    for(let d=0; d<daysInMonth; d++) {
        const val = incData.colTotals[d];
        totalIn += val;
        summaryHTML += `<td class="${val===0 ? 'td-zero' : 'td-val inc'}">${val===0 ? '-': formatMoney(val)}</td>`;
    }
    summaryHTML += `<td class="td-total inc">${formatMoney(totalIn)}</td></tr>`;

    // Row 2: Expense
    summaryHTML += `<tr><th>Gider</th>`;
    let totalOut = 0;
    for(let d=0; d<daysInMonth; d++) {
        const val = expData.colTotals[d];
        totalOut += val;
        summaryHTML += `<td class="${val===0 ? 'td-zero' : 'td-val exp'}">${val===0 ? '-': formatMoney(val)}</td>`;
    }
    summaryHTML += `<td class="td-total exp">${formatMoney(totalOut)}</td></tr>`;

    // Row 3: Net Balance
    summaryHTML += `<tr><th style="font-size: 0.9rem; color: #fff; background: rgba(255,255,255,0.05);">NET</th>`;
    let totalNet = 0;
    for(let d=0; d<daysInMonth; d++) {
        const val = incData.colTotals[d] - expData.colTotals[d];
        totalNet += val;
        let colorCls = val === 0 ? 'td-zero' : (val > 0 ? 'inc' : 'exp');
        summaryHTML += `<td class="td-total ${colorCls}">${val===0 ? '-': formatMoney(Math.abs(val))}</td>`;
    }
    let gtColorCls = totalNet === 0 ? 'td-zero' : (totalNet > 0 ? 'inc' : 'exp');
    summaryHTML += `<td class="td-total ${gtColorCls}" style="font-size: 1rem;">${formatMoney(Math.abs(totalNet))}</td></tr>`;

    summaryHTML += `</tbody></table></div>`;

    // Inject all into container
    containerEl.innerHTML = expData.html + incData.html + summaryHTML;
}

// Boot Sequence
renderCategoryButtons('income'); 
render();
renderReports();
