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
let expenseChartInstance = null;

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

function setDayOffset(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
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

// --- AI ASSISTANT LOGIC ---
function openAIAssistantModal() {
    const modal = document.getElementById('ai-assistant-modal');
    const content = document.getElementById('ai-assistant-content');
    
    content.innerHTML = '<div style="text-align:center; padding: 3rem; color:var(--text-muted);"><i class="fas fa-circle-notch fa-spin fa-2x"></i><br><br>Veriler Analiz Ediliyor...</div>';
    modal.classList.remove('hidden');

    setTimeout(() => {
        content.innerHTML = buildComprehensiveAIReport();
    }, 50);
}

function closeAIAssistantModal() {
    const modal = document.getElementById('ai-assistant-modal');
    if(modal) modal.classList.add('hidden');
}

function closeAIAssistantModalOutside(event) {
    if (event.target.id === 'ai-assistant-modal') {
        closeAIAssistantModal();
    }
}

function buildComprehensiveAIReport() {
    const now = new Date();
    const clearTime = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = clearTime(now);
    
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const sameDayLastMonth = new Date(today); sameDayLastMonth.setMonth(sameDayLastMonth.getMonth() - 1);
    
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    let todayInc = 0, todayExp = 0;
    let yesterdayInc = 0;
    let lastMonthSameDayInc = 0;
    
    let last7Inc = 0, last7Exp = 0;
    let prev7Inc = 0, prev7Exp = 0;

    let currMonthExpGroups = {};
    let currMonthExpCounts = {};
    let prevMonthExpGroups = {};

    let currMonthIncGroups = {};
    let prevMonthIncGroups = {};

    state.transactions.forEach(t => {
        const tDate = clearTime(new Date(t.date));
        const amount = t.amount;
        const cat = t.category || "Diğer";
        const isInc = t.type === 'income';

        // Daily
        if (tDate.getTime() === today.getTime()) {
            if(isInc) todayInc += amount; else todayExp += amount;
        }
        if (tDate.getTime() === yesterday.getTime() && isInc) yesterdayInc += amount;
        if (tDate.getTime() === sameDayLastMonth.getTime() && isInc) lastMonthSameDayInc += amount;

        // Weekly
        if (tDate >= sevenDaysAgo && tDate <= today) {
            if(isInc) last7Inc += amount; else last7Exp += amount;
        } else if (tDate >= fourteenDaysAgo && tDate <= new Date(sevenDaysAgo.getTime() - 86400000)) {
            if(isInc) prev7Inc += amount; else prev7Exp += amount;
        }

        // Monthly (Current Month)
        if (tDate >= currentMonthStart && tDate <= today) {
            if(isInc) {
                currMonthIncGroups[cat] = (currMonthIncGroups[cat] || 0) + amount;
            } else {
                currMonthExpGroups[cat] = (currMonthExpGroups[cat] || 0) + amount;
                currMonthExpCounts[cat] = (currMonthExpCounts[cat] || 0) + 1;
            }
        }
        
        // Monthly (Previous Month)
        if (tDate >= prevMonthStart && tDate <= prevMonthEnd) {
            if(isInc) {
                prevMonthIncGroups[cat] = (prevMonthIncGroups[cat] || 0) + amount;
            } else {
                prevMonthExpGroups[cat] = (prevMonthExpGroups[cat] || 0) + amount;
            }
        }
    });

    const getTrendBadge = (curr, prev, isIncome) => {
        const diff = curr - prev;
        if (diff === 0) return `<div class="trend-badge trend-neutral">Aynı</div>`;
        const isUp = diff > 0;
        const isGood = isUp === isIncome; 
        const icon = isUp ? "fa-arrow-up" : "fa-arrow-down";
        const badgeColor = isGood ? "color:var(--success); background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3);" 
                                  : "color:var(--danger); background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3);";
        return `<div class="trend-badge" style="${badgeColor}"><i class="fas ${icon}"></i> ${formatMoneyPrecise(Math.abs(diff))}</div>`;
    };

    let html = "";

    // 1. Günlük Kazanç Analizi
    html += `<div class="ai-card">
        <h3 class="ai-card-title"><i class="fas fa-sun"></i> Günlük Kazanç Analizi</h3>
        <div class="ai-grid">
            <div class="ai-stat-box">
                <span class="ai-stat-label">Bugün Kazanç</span>
                <span class="ai-stat-val inc">${formatMoneyPrecise(todayInc)}</span>
            </div>
            <div class="ai-stat-box" style="justify-content:center;">
                <span class="ai-stat-label" style="margin-bottom:0.2rem;">Düne Göre Fark</span>
                ${getTrendBadge(todayInc, yesterdayInc, true)}
            </div>
        </div>
        <div class="ai-grid">
            <div class="ai-stat-box" style="grid-column: span 2; flex-direction:row; align-items:center; justify-content:space-between;">
                <span class="ai-stat-label">Geçen Ayın Aynı Gününe Göre Fark</span>
                ${getTrendBadge(todayInc, lastMonthSameDayInc, true)}
            </div>
        </div>
    </div>`;

    // 2. Haftalık Özet
    html += `<div class="ai-card">
        <h3 class="ai-card-title"><i class="fas fa-calendar-week"></i> Son 7 Günlük Özet</h3>
        <div class="list-item" style="padding: 0.6rem 0.8rem; background: rgba(255,255,255,0.03); margin-bottom:0.4rem;">
            <div class="item-info"><h4 style="font-size:0.9rem;">Toplam Gelir</h4><p style="font-size:0.75rem;">Önceki 7 gün: ${formatMoney(prev7Inc)}₺</p></div>
            ${getTrendBadge(last7Inc, prev7Inc, true)}
        </div>
        <div class="list-item" style="padding: 0.6rem 0.8rem; background: rgba(255,255,255,0.03);">
            <div class="item-info"><h4 style="font-size:0.9rem;">Toplam Gider</h4><p style="font-size:0.75rem;">Önceki 7 gün: ${formatMoney(prev7Exp)}₺</p></div>
            ${getTrendBadge(last7Exp, prev7Exp, false)}
        </div>
    </div>`;

    // 3. Gelir Analizi (Aylık)
    html += `<div class="ai-card">
        <h3 class="ai-card-title"><i class="fas fa-chart-line"></i> Bu Ayki Gelir Analizi</h3>`;
    let hasIncome = false;
    for (let cat in currMonthIncGroups) {
        hasIncome = true;
        let curr = currMonthIncGroups[cat];
        let prev = prevMonthIncGroups[cat] || 0;
        html += `<div class="list-item" style="padding: 0.6rem 0.8rem; background: rgba(255,255,255,0.03); margin-bottom:0.4rem;">
            <div class="item-info"><h4 style="font-size:0.9rem;">${cat}</h4><p style="font-size:0.75rem;">Geçen Ay: ${formatMoney(prev)}₺</p></div>
            ${getTrendBadge(curr, prev, true)}
        </div>`;
    }
    if (!hasIncome) html += `<div class="empty-state" style="padding:0.5rem;">Bu ay gelir kaydı yok.</div>`;
    html += `</div>`;

    // 4. Gider Analizi (Tekrar Edenler)
    html += `<div class="ai-card">
        <h3 class="ai-card-title"><i class="fas fa-sync-alt"></i> Düzenli Gider Analizi (3+ Alım)</h3>`;
    let hasRecurringExp = false;
    let recurringInsights = [];
    for (let cat in currMonthExpCounts) {
        if (currMonthExpCounts[cat] >= 3) {
            hasRecurringExp = true;
            let curr = currMonthExpGroups[cat];
            let prev = prevMonthExpGroups[cat] || 0;
            recurringInsights.push({ cat, curr, prev });
        }
    }
    
    if (!hasRecurringExp) {
        html += `<div class="empty-state" style="padding:0.5rem;">Bu ay 3 ve daha fazla kez tekrarlanan bir gider kaleminiz yok.</div>`;
    } else {
        recurringInsights.sort((a,b) => b.curr - a.curr).forEach(item => {
            html += `<div class="list-item" style="padding: 0.6rem 0.8rem; background: rgba(255,255,255,0.03); margin-bottom:0.4rem;">
                <div class="item-info"><h4 style="font-size:0.9rem;">${item.cat} <span class="cat-tag" style="background:rgba(239,68,68,0.15); color:var(--danger);">${currMonthExpCounts[item.cat]} kez</span></h4><p style="font-size:0.75rem;">Geçen Ay: ${formatMoney(item.prev)}₺</p></div>
                ${getTrendBadge(item.curr, item.prev, false)}
            </div>`;
        });
    }
    html += `</div>`;

    return html;
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

    let html = '<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:0.5rem;">';
    const dayNames = ['Bugün', 'Dün', 'Önceki Gün'];
    
    daysData.forEach((data, index) => {
        const dateStr = data.dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        html += `
            <div class="list-item" style="padding: 0.5rem; flex-direction:column; align-items:flex-start; justify-content:center; gap:0.4rem; background:rgba(255,255,255,0.02);">
                <h4 style="font-size:0.85rem; text-align:center; width:100%; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.3rem; margin-bottom:0.2rem;">${dayNames[index]} <span class="cat-tag" style="font-size:0.65rem;">${dateStr}</span></h4>
                <div style="display:flex; justify-content:space-between; width:100%; font-size:0.8rem;">
                    <span style="color:var(--text-muted); font-size:0.65rem;">GELİR</span>
                    <span class="inc mono">${formatMoneyPrecise(data.income)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; width:100%; font-size:0.8rem;">
                    <span style="color:var(--text-muted); font-size:0.65rem;">GİDER</span>
                    <span class="exp mono">${formatMoneyPrecise(data.expense)}</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
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

    // --- CHART & CATEGORY BUTTONS LOGIC ---
    renderChartAndCategoryButtons(expTxs);
}

function renderChartAndCategoryButtons(expTxs) {
    // 1. Group expenses by category
    const categoryTotals = {};
    expTxs.forEach(t => {
        const cat = t.category || "Diğer";
        if(!categoryTotals[cat]) categoryTotals[cat] = 0;
        categoryTotals[cat] += t.amount;
    });

    // 2. Sort categories by amount (descending)
    const sortedCategories = Object.keys(categoryTotals).sort((a,b) => categoryTotals[b] - categoryTotals[a]);
    
    // Prepare data for Chart.js
    const labels = [];
    const data = [];
    const backgroundColors = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', 
        '#10b981', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', 
        '#8b5cf6', '#d946ef', '#f43f5e', '#ec4899', '#9f1239'
    ];
    const bgColorsToUse = [];

    sortedCategories.forEach((cat, index) => {
        labels.push(cat);
        data.push(categoryTotals[cat]);
        bgColorsToUse.push(backgroundColors[index % backgroundColors.length]);
    });

    // 3. Render Chart
    const ctx = document.getElementById('expenseChart');
    if (ctx) {
        if (expenseChartInstance) {
            expenseChartInstance.destroy();
        }
        
        if (labels.length === 0) {
            // No data, clear canvas basically
            const context = ctx.getContext('2d');
            context.clearRect(0, 0, ctx.width, ctx.height);
            context.font = "14px Outfit";
            context.fillStyle = "#94a3b8";
            context.textAlign = "center";
            context.fillText("Bu ay gider kaydı bulunmuyor.", ctx.canvas.width/2, ctx.canvas.height/2);
        } else {
            const outLabelsPlugin = {
                id: 'outLabelsPlugin',
                afterDraw: (chart) => {
                    const chartCtx = chart.ctx;
                    const meta = chart.getDatasetMeta(0);
                    if(!meta.data || meta.data.length === 0) return;
                    
                    chartCtx.save();
                    meta.data.forEach((element, index) => {
                        const val = chart.data.datasets[0].data[index];
                        if(!val) return;
                        
                        const midAngle = element.startAngle + (element.endAngle - element.startAngle) / 2;
                        const radius = element.outerRadius;
                        const x = element.x;
                        const y = element.y;
                        
                        // Calculate line coordinates
                        const startX = x + Math.cos(midAngle) * radius;
                        const startY = y + Math.sin(midAngle) * radius;
                        
                        // Distance from chart edge
                        const extend = 15;
                        const elbowX = x + Math.cos(midAngle) * (radius + extend);
                        const elbowY = y + Math.sin(midAngle) * (radius + extend);
                        
                        const isRight = Math.cos(midAngle) >= 0;
                        const endX = elbowX + (isRight ? 15 : -15);
                        
                        chartCtx.beginPath();
                        chartCtx.moveTo(startX, startY);
                        chartCtx.lineTo(elbowX, elbowY);
                        chartCtx.lineTo(endX, elbowY);
                        chartCtx.strokeStyle = chart.data.datasets[0].backgroundColor[index];
                        chartCtx.lineWidth = 1.5;
                        chartCtx.stroke();
                        
                        chartCtx.font = "500 11px 'Outfit'";
                        chartCtx.fillStyle = "#cbd5e1"; // var(--text-muted)
                        chartCtx.textAlign = isRight ? 'left' : 'right';
                        chartCtx.textBaseline = 'middle';
                        
                        const textX = endX + (isRight ? 4 : -4);
                        chartCtx.fillText(chart.data.labels[index], textX, elbowY);
                    });
                    chartCtx.restore();
                }
            };

            expenseChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: bgColorsToUse,
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                plugins: [outLabelsPlugin],
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: 30 // Make room for the lines and text
                    },
                    plugins: {
                        legend: {
                            display: false // Hide default legend, we use buttons
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed !== null) {
                                        label += formatMoneyPrecise(context.parsed);
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    cutout: '70%'
                }
            });
        }
    }

    // 4. Render Category Buttons
    const buttonsContainer = document.getElementById('chart-category-buttons');
    if (buttonsContainer) {
        buttonsContainer.innerHTML = '';
        sortedCategories.forEach((cat, index) => {
            const amount = categoryTotals[cat];
            const color = bgColorsToUse[index];
            const btn = document.createElement('button');
            btn.className = 'cat-btn';
            btn.style.display = 'flex';
            btn.style.flexDirection = 'column';
            btn.style.alignItems = 'center';
            btn.style.gap = '0.2rem';
            btn.style.padding = '0.5rem 0.8rem';
            btn.style.borderLeft = `3px solid ${color}`;
            btn.style.background = 'rgba(255,255,255,0.05)';
            
            btn.innerHTML = `
                <span style="font-weight: 500;">${cat}</span>
                <span class="mono" style="font-size: 0.75rem; color: ${color};">${formatMoney(amount)} ₺</span>
            `;
            
            btn.onclick = () => openCategoryModal(cat, expTxs);
            buttonsContainer.appendChild(btn);
        });
    }
}

// --- MODAL LOGIC ---
function openCategoryModal(categoryName, monthTxs) {
    const modal = document.getElementById('category-modal');
    const titleEl = document.getElementById('modal-category-title');
    const listEl = document.getElementById('modal-transaction-list');
    const totalEl = document.getElementById('modal-total-amount');
    
    titleEl.innerHTML = `<i class="fas fa-box" style="margin-right:0.5rem; color:var(--primary);"></i> ${categoryName} Detayı`;
    
    // Filter transactions for this category
    const catTxs = monthTxs.filter(t => (t.category || "Diğer") === categoryName);
    
    // Sort by date descending
    catTxs.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    listEl.innerHTML = '';
    let totalAmount = 0;
    
    if (catTxs.length === 0) {
        listEl.innerHTML = `<div class="empty-state">Kayıt bulunamadı.</div>`;
    } else {
        catTxs.forEach(t => {
            totalAmount += t.amount;
            const dateStr = new Date(t.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });
            listEl.innerHTML += `
                <div class="list-item" style="padding: 0.8rem; margin-bottom: 0.4rem; background: rgba(0,0,0,0.3);">
                    <div class="item-info">
                        <h4 style="font-size: 0.95rem;">${t.desc}</h4>
                        <p style="font-size: 0.75rem;"><i class="far fa-calendar-alt"></i> ${dateStr}</p>
                    </div>
                    <div class="item-amount">
                        <span class="amount-val exp">${formatMoneyPrecise(t.amount)}</span>
                    </div>
                </div>
            `;
        });
    }
    
    totalEl.innerText = formatMoneyPrecise(totalAmount);
    modal.classList.remove('hidden');
}

function closeCategoryModal() {
    document.getElementById('category-modal').classList.add('hidden');
}

function closeCategoryModalOutside(event) {
    if (event.target.id === 'category-modal') {
        closeCategoryModal();
    }
}

// Boot Sequence
renderCategoryButtons('income'); 
render();
renderReports();
