const voiceBtn = document.getElementById('voice-btn');
const voiceFeedbackEl = document.getElementById('voice-feedback');
const voiceTextEl = document.getElementById('voice-text');
const tooltipEl = document.querySelector('.fab-tooltip');

// Check browser support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    if(tooltipEl) tooltipEl.innerText = "Desteklenmiyor";
    voiceBtn.disabled = true;
    voiceBtn.style.opacity = 0.5;
} else {
    const recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.continuous = false;
    recognition.interimResults = false;

    voiceBtn.addEventListener('click', () => {
        try {
            recognition.start();
        } catch(e) {
            console.log("Zaten dinliyor olabilir", e);
        }
    });

    recognition.onstart = function() {
        voiceBtn.classList.add('recording');
        if(tooltipEl) tooltipEl.innerText = "Dinliyorum...";
        voiceFeedbackEl.classList.remove('hidden');
        voiceTextEl.innerText = "Sizi dinliyorum...";
    };

    recognition.onspeechend = function() {
        recognition.stop();
        resetVoiceBtn();
    };

    recognition.onerror = function(event) {
        console.error('Speech error', event.error);
        voiceTextEl.innerText = "Bir hata oluştu veya ses anlaşılamadı.";
        resetVoiceBtn();
        setTimeout(() => voiceFeedbackEl.classList.add('hidden'), 3000);
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript.toLowerCase();
        voiceTextEl.innerText = `"${transcript}"`;
        
        processCommand(transcript);
        
        setTimeout(() => {
            voiceFeedbackEl.classList.add('hidden');
        }, 4000);
    };

    function resetVoiceBtn() {
        voiceBtn.classList.remove('recording');
        if(tooltipEl) tooltipEl.innerText = "Sesli Asistan";
    }
}

// Logic to interpret the command
function processCommand(text) {
    // 1. Extract the number (amount)
    // Looking for a number followed by lira, tl or nothing if context is clear
    // Match any sequence of digits. For simplicity, just get the first number
    const matchAmount = text.match(/(\d+)/);
    
    if(!matchAmount) {
        alert("Seste bir tutar (rakam) algılanamadı. Örn: 'Süt 50 lira ürün ekle'");
        return;
    }
    
    let amountStr = matchAmount[0];
    let amount = parseInt(amountStr, 10);
    
    let cleanText = text.replace(amountStr, '');
    
    // Check if they said "bin" meaning thousands (e.g. 30 bin = 30000)
    if (cleanText.match(/\bbin\b/)) {
        amount = amount * 1000;
        cleanText = cleanText.replace(/\bbin\b/g, '');
    }
    
    cleanText = cleanText.replace(/\b(lira|tl|türk lirası|liralık)\b/g, '');
    
    // 2. Determine Intent (Income, Expense, Product)
    const isIncome = text.includes('gelir');
    const isExpense = text.includes('gider');
    const isProduct = text.includes('ürün') || text.includes('aldım') || text.includes('aldık');
    
    // Clean intent keywords
    cleanText = cleanText.replace(/\b(gelir|gider|ürün|ekle|aldım|aldık)\b/g, '').replace(/\s{2,}/g, ' ').trim();
    
    // Fallback desc
    const desc = cleanText || "Sesli Komut İşlemi";
    
    // We try to match with a category if possible (simple heuristic)
    let matchedCategory = "Diğer";
    const allExpCats = ['emrah', 'sandviç', 'yemek', 'migros', 'metro', 'dükkan', 'Ev', 'Kişisel', 'fırça', 'yasar', 'meron', 'Barut', 'Part', 'Kahve', 'kira', 'Ekrem abi', 'Türkmenler', 'Kap', 'Temizlik', 'Çikolata', 'maaş', 'harun'];
    for(let c of allExpCats) {
        if(desc.toLowerCase().includes(c.toLowerCase())) {
            matchedCategory = c;
            break;
        }
    }

    if (isIncome) {
        addTransaction('income', amount, desc, desc.toLowerCase().includes('kart') ? 'Kart' : 'Nakit');
    } 
    else if (isProduct || isExpense) {
        addTransaction('expense', amount, desc, matchedCategory);
    }
    else {
        const confirmProduct = confirm(`Ses algılandı: "${desc}" için ${amount} ₺ harcama mı eklensin?`);
        if(confirmProduct) {
            addTransaction('expense', amount, desc, matchedCategory);
        }
    }
}
