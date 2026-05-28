// Default Shared Sandbox Firebase Configuration
const defaultFirebaseConfig = {
    apiKey: "AIzaSyDW0-_Xzvwvkm9wpZ9j2ihDQmIAalrn7lM",
    authDomain: "test-560c6.firebaseapp.com",
    databaseURL: "https://test-560c6-default-rtdb.firebaseio.com",
    projectId: "test-560c6",
    storageBucket: "test-560c6.firebasestorage.app",
    messagingSenderId: "580954040987",
    appId: "1:580954040987:web:a2f08eaeba5e130abbf43e",
    measurementId: "G-Y5VQJL4Z2Y"
};

const PLANS_PRICING = {
    "non-reserved": {
        "1": 700,
        "3": 1900,
        "6": 3600
    },
    "reserved": {
        "1": 1000,
        "3": 2700,
        "6": 5000
    }
};

let database = null;
let seatsCount = {
    total: 400,
    occupied: 280,
    vacant: 120
};

// Fetch Firebase Configuration
function getFirebaseConfig() {
    let storedConfig = null;
    try {
        storedConfig = localStorage.getItem('custom_firebase_config');
    } catch(e) {}
    
    if (storedConfig) {
        try {
            const parsed = JSON.parse(storedConfig);
            if (parsed.apiKey === "AIzaSyA4c3BfU2FuZGJveEtleS1EZW1vMTIzNDU") {
                localStorage.removeItem("custom_firebase_config");
                return defaultFirebaseConfig;
            }
            return parsed;
        } catch(e) {}
    }
    
    return defaultFirebaseConfig;
}

// Load custom settings (Library Name, Phone, Address) from localStorage
function loadCustomSettings() {
    try {
        const localData = localStorage.getItem("study_cafe_state");
        if (localData) {
            const state = JSON.parse(localData);
            if (state.settings) {
                const libName = state.settings.libraryName || "The Study Cafe";
                const libPhone = state.settings.phone || "9876543210";
                const libAddress = state.settings.address || "Maitri Nagar Road, near Risali Sector, Bhilai, Chhattisgarh - 490006";
                
                // Update Logo
                document.querySelectorAll(".logo-text span").forEach(el => {
                    el.textContent = libName;
                });
                document.querySelectorAll("footer strong").forEach(el => {
                    el.textContent = libName;
                });
                
                // Update Contact details
                const addrEl = document.getElementById("live-lib-address");
                const phoneEl = document.getElementById("live-lib-phone");
                if (addrEl) addrEl.textContent = libAddress;
                if (phoneEl) phoneEl.textContent = "+91 " + libPhone.replace(/(\d{5})(\d{5})/, "$1 $2");
                
                // Update CTAs hrefs
                const callBtn = document.getElementById("action-call");
                const whatsappBtn = document.getElementById("action-whatsapp");
                if (callBtn) callBtn.href = `tel:+91${libPhone}`;
                if (whatsappBtn) {
                    whatsappBtn.href = `https://wa.me/91${libPhone}?text=Hi,%20I%20am%20interested%20in%20joining%20${encodeURIComponent(libName)}.%20Please%20share%20seat%20availability.`;
                }
            }
        }
    } catch(e) {
        console.warn("Failed to load local custom settings:", e);
    }
}

// Update the circular gauge and text stats
function updateStatsUI(vacant, occupied) {
    const total = vacant + occupied;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    
    // UI updates
    const vacantEl = document.getElementById("live-vacant");
    const occupiedEl = document.getElementById("live-occupied");
    const percentEl = document.getElementById("live-percent");
    const fillEl = document.getElementById("live-progress-bar");
    
    if (vacantEl) vacantEl.textContent = vacant;
    if (occupiedEl) occupiedEl.textContent = occupied;
    if (percentEl) percentEl.textContent = `${occupancyRate}%`;
    
    if (fillEl) {
        const circumference = 201; // 2 * pi * 32
        const offset = circumference - (occupancyRate / 100) * circumference;
        fillEl.style.strokeDashoffset = offset;
    }
}

// Fetch dynamic seat status from Firebase
function initSeatsListener() {
    const config = getFirebaseConfig();
    
    if (window.firebase && window.firebase.initializeApp) {
        try {
            const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
            database = app.database();
            
            // Listen to real-time seat assignments
            database.ref("study_cafe_system/seats").on("value", (snapshot) => {
                const seats = snapshot.val();
                if (seats) {
                    let vacant = 0;
                    let occupied = 0;
                    
                    Object.values(seats).forEach(seat => {
                        if (seat.status === "vacant") {
                            vacant++;
                        } else {
                            occupied++;
                        }
                    });
                    
                    // Fallback to total 400 seats if DB is partially loaded
                    if (vacant + occupied < 10) {
                        loadOfflineFallback();
                    } else {
                        updateStatsUI(vacant, occupied);
                    }
                } else {
                    loadOfflineFallback();
                }
            }, (error) => {
                console.warn("Firebase value listen failed:", error);
                loadOfflineFallback();
            });
        } catch (error) {
            console.error("Firebase init failed in landing page:", error);
            loadOfflineFallback();
        }
    } else {
        loadOfflineFallback();
    }
}

// Fallback to local storage seats state or mock counters
function loadOfflineFallback() {
    try {
        const localData = localStorage.getItem("study_cafe_state");
        if (localData) {
            const state = JSON.parse(localData);
            if (state.seats && state.seats.length > 0) {
                let vacant = 0;
                let occupied = 0;
                state.seats.forEach(seat => {
                    if (seat.status === "vacant") {
                        vacant++;
                    } else {
                        occupied++;
                    }
                });
                updateStatsUI(vacant, occupied);
                return;
            }
        }
    } catch(e){}
    
    // Default static fallback if completely offline
    updateStatsUI(120, 280);
}

// Pricing Toggle System
function initPricingToggle() {
    const pricingSwitch = document.getElementById("pricing-switch");
    const labelGeneral = document.getElementById("label-general");
    const labelReserved = document.getElementById("label-reserved");
    
    const price1m = document.getElementById("price-1m");
    const price3m = document.getElementById("price-3m");
    const price6m = document.getElementById("price-6m");
    
    const desc1 = document.getElementById("plan-desc-1-seat");
    const desc3 = document.getElementById("plan-desc-3-seat");
    const desc6 = document.getElementById("plan-desc-6-seat");
    
    if (!pricingSwitch) return;
    
    pricingSwitch.addEventListener("change", function() {
        const type = this.checked ? "reserved" : "non-reserved";
        
        if (this.checked) {
            labelReserved.classList.add("active");
            labelGeneral.classList.remove("active");
        } else {
            labelGeneral.classList.add("active");
            labelReserved.classList.remove("active");
        }
        
        // Update price display
        if (price1m) price1m.textContent = PLANS_PRICING[type]["1"];
        if (price3m) price3m.textContent = PLANS_PRICING[type]["3"];
        if (price6m) price6m.textContent = PLANS_PRICING[type]["6"];
        
        // Update shift lists
        const descText = this.checked 
            ? '<i class="fa-solid fa-circle-check"></i> Dedicated personal seat reservation' 
            : '<i class="fa-solid fa-circle-check"></i> Flexible seat assignment';
            
        if (desc1) desc1.innerHTML = descText;
        if (desc3) desc3.innerHTML = descText;
        if (desc6) desc6.innerHTML = descText;
    });
}

// FAQ Accordion System
function initFAQAccordion() {
    const triggers = document.querySelectorAll(".faq-trigger");
    triggers.forEach(trigger => {
        trigger.addEventListener("click", function() {
            const item = this.parentElement;
            const content = this.nextElementSibling;
            const isActive = item.classList.contains("active");
            
            // Close all items
            document.querySelectorAll(".faq-item").forEach(el => {
                el.classList.remove("active");
                el.querySelector(".faq-content").style.maxHeight = null;
            });
            
            if (!isActive) {
                item.classList.add("active");
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    });
}

// Initialize landing components on load
window.addEventListener("DOMContentLoaded", () => {
    loadCustomSettings();
    initPricingToggle();
    initFAQAccordion();
    initSeatsListener();
});
