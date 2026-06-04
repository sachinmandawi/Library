// Red Room - Admin Panel Logic (Shift-free, 4 Rooms, 369 Seats Version with Receipt & WhatsApp)

const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDW0-_Xzvwvkm9wpZ9j2ihDQmIAalrn7lM",
    authDomain: "test-560c6.firebaseapp.com",
    databaseURL: "https://test-560c6-default-rtdb.firebaseio.com",
    projectId: "test-560c6",
    storageBucket: "test-560c6.firebasestorage.app",
    messagingSenderId: "580954040987",
    appId: "1:580954040987:web:a2f08eaeba5e130abbf43e",
    measurementId: "G-Y5VQJL4Z2Y"
};

const PLANS = [
    { id: 'general-monthly', name: 'Non-Reserved Monthly', price: 700, type: 'non-reserved', duration: 1 },
    { id: 'premium-monthly', name: 'Reserved Monthly', price: 1000, type: 'reserved', duration: 1 },
    { id: 'general-quarterly', name: 'Non-Reserved Quarterly', price: 1900, type: 'non-reserved', duration: 3 },
    { id: 'premium-quarterly', name: 'Reserved Quarterly', price: 2700, type: 'reserved', duration: 3 },
    { id: 'general-halfyearly', name: 'Non-Reserved Half-Yearly', price: 3600, type: 'non-reserved', duration: 6 },
    { id: 'premium-halfyearly', name: 'Reserved Half-Yearly', price: 5000, type: 'reserved', duration: 6 }
];

// Security helper to escape HTML characters and prevent XSS
function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\//g, "&#x2F;");
}

// Helper to get room, seat number and display text from a seatId
function getSeatRoomAndNumber(seatId) {
    if (!seatId || seatId === "non-reserved") {
        return { room: 0, number: 0, text: "Non-Reserved" };
    }
    const seat = state.seats.find(s => s.id === seatId);
    if (seat) {
        return { room: seat.room, number: seat.number, text: `Room ${seat.room} - Seat ${seat.number}` };
    }
    // Fallback if seat is not found in state
    const globalSeatNum = parseInt(seatId.replace('seat_', ''));
    if (isNaN(globalSeatNum)) {
        return { room: 0, number: 0, text: seatId };
    }
    let room = 1;
    let number = globalSeatNum;
    if (globalSeatNum <= 69) {
        room = 1;
        number = globalSeatNum;
    } else if (globalSeatNum <= 169) {
        room = 2;
        number = globalSeatNum - 69;
    } else if (globalSeatNum <= 269) {
        room = 3;
        number = globalSeatNum - 169;
    } else {
        room = 4;
        number = globalSeatNum - 269;
    }
    return { room, number, text: `Room ${room} - Seat ${number}` };
}

// Helper to convert seatId to user-friendly "Room X - Seat Y"
function getSeatDisplayName(seatId) {
    return getSeatRoomAndNumber(seatId).text;
}

// Debounce helper to optimize search input calls
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

const debouncedRenderMemberTable = debounce(renderMemberTable, 250);

// Get plan name helper
function getPlanName(planId) {
    if (planId && planId.startsWith("demo-")) {
        return `Free Demo Pass (${planId.replace("demo-", "")} Days)`;
    }
    const plan = PLANS.find(p => p.id === planId);
    return plan ? plan.name : planId;
}

// Render installments inside the member form modal
function renderModalInstallments() {
    const container = document.getElementById("m-installments-list");
    if (!container) return;
    container.innerHTML = "";

    if (!currentModalInstallments || currentModalInstallments.length === 0) {
        container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 0.5rem 0;">No installments recorded.</div>`;
        return;
    }

    currentModalInstallments.forEach((inst, index) => {
        const dateStr = inst.date ? new Date(inst.date).toLocaleDateString('en-IN', {day:'2-digit', month:'2-digit', year:'numeric'}) : "";
        const div = document.createElement("div");
        div.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 0.35rem 0.5rem; background: rgba(255,255,255,0.03); border-radius: 4px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem; color: #fff; margin-bottom: 0.25rem;";
        div.innerHTML = `
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.1rem;">
                <div style="font-weight: 500;">₹${inst.amount} - ${escapeHTML(inst.method)}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted);">${escapeHTML(inst.note || 'No note')} | ${dateStr}</div>
            </div>
            <button type="button" onclick="removeInstallmentFromForm(${index})" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 0 0.25rem;">
                <i class="fa-solid fa-trash-can" style="font-size: 0.8rem;"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

// Recalculate installments totals
function recalculateModalInstallmentTotals() {
    const feeAmountInput = document.getElementById("m-fee-amount");
    const amountPaidInput = document.getElementById("m-amount-paid");
    const balanceAmountInput = document.getElementById("m-balance-amount");
    const paymentStatusInput = document.getElementById("m-payment");

    const feeAmount = parseFloat(feeAmountInput.value) || 0;
    
    // Sum up installments
    const totalPaid = currentModalInstallments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
    amountPaidInput.value = totalPaid;

    const remaining = feeAmount - totalPaid;
    balanceAmountInput.value = remaining >= 0 ? remaining : 0;

    if (remaining <= 0) {
        paymentStatusInput.value = "Paid";
    } else if (totalPaid > 0) {
        paymentStatusInput.value = "Partial";
    } else {
        paymentStatusInput.value = "Unpaid";
    }
}

// Add installment from modal form
function addInstallmentFromForm() {
    const amountInput = document.getElementById("new-inst-amount");
    const methodSelect = document.getElementById("new-inst-method");
    const noteInput = document.getElementById("new-inst-note");

    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
        showToast("Please enter a valid amount greater than 0", "error");
        return;
    }

    const newInst = {
        id: "pay_" + Date.now(),
        date: new Date().toISOString(),
        amount: amount,
        method: methodSelect.value,
        note: noteInput.value.trim()
    };

    currentModalInstallments.push(newInst);
    
    // Clear inputs
    amountInput.value = "";
    noteInput.value = "";

    renderModalInstallments();
    recalculateModalInstallmentTotals();
}

// Remove installment from modal form
function removeInstallmentFromForm(index) {
    if (confirm("Are you sure you want to delete this installment?")) {
        currentModalInstallments.splice(index, 1);
        renderModalInstallments();
        recalculateModalInstallmentTotals();
    }
}


// App State
let state = {
    seats: [],
    members: [],
    pending: [],
    complaints: [],
    settings: {
        libraryName: "Red Room",
        address: "1st Floor, Fancy Gift House, Near Madhurisha Hotel, Maitri Nagar, Risali, Bhilai - 490006",
        phone: "9876543210"
    }
};

let database = null;
let currentTab = "dashboard";
let isOfflineMode = false;
let broadcastChannel = null;
let currentReceiptMemberId = null; // Store active receipt student ID
let recentlyApprovedOrRejected = new Set(); // Track approved/rejected requests to prevent listener re-adds
let modalPhotoBase64 = null; // Store compressed profile picture in memory for new/edited members
let adminModalIsDemo = false;
let adminModalDemoDuration = 5;
let currentModalInstallments = [];

// Initialize Web Audio notification sound
function playNotificationSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        const playTone = (time, freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(0.12, time);
            gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(time);
            osc.stop(time + 0.3);
        };
        
        playTone(ctx.currentTime, 880); // A5
        playTone(ctx.currentTime + 0.12, 1046.5); // C6
    } catch (e) {
        console.warn("AudioContext block:", e);
    }
}

// Show custom toast alerts
function showToast(message, type = "info") {
    const holder = document.getElementById("toast-holder");
    if (!holder) return;
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let iconClass = "fa-info-circle";
    if (type === "success") iconClass = "fa-check-circle";
    if (type === "error") iconClass = "fa-exclamation-triangle";
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    holder.appendChild(toast);
    
    if (type === "info" || type === "success") {
        playNotificationSound();
    }
    
    setTimeout(() => {
        toast.style.animation = "slideInRight 0.25s reverse forwards";
        setTimeout(() => toast.remove(), 250);
    }, 4000);
}

// Generate default seats (369 seats total across 4 rooms: Room 1 has 69 seats, Rooms 2-4 have 100 seats each)
function generateDefaultSeats() {
    const seats = [];
    let seatIndex = 1;
    // Generate Room 1: 69 seats
    for (let s = 1; s <= 69; s++) {
        seats.push({
            id: `seat_${seatIndex++}`,
            number: s,
            room: 1,
            type: "general",
            status: "vacant",
            assignedMemberId: null
        });
    }
    // Generate Room 2, 3, 4: 100 seats each
    for (let r = 2; r <= 4; r++) {
        for (let s = 1; s <= 100; s++) {
            seats.push({
                id: `seat_${seatIndex++}`,
                number: s,
                room: r,
                type: "general",
                status: "vacant",
                assignedMemberId: null
            });
        }
    }
    return seats;
}

// Add Mock Members for demonstration if empty
function loadMockData() {
    state.seats = generateDefaultSeats();
    state.members = [];
    state.pending = [];
}

// Save all state into Local Storage
function saveStateToLocalStorage() {
    try {
        // Strip photo base64 strings from state before writing to localStorage to prevent QuotaExceededError (5MB limit)
        const storageState = {
            ...state,
            members: state.members.map(m => {
                const { photo, ...rest } = m;
                return rest;
            }),
            pending: state.pending.map(p => {
                const { photo, ...rest } = p;
                return rest;
            })
        };
        localStorage.setItem("study_cafe_state", JSON.stringify(storageState));
        if (broadcastChannel) {
            broadcastChannel.postMessage({
                type: "SEATS_UPDATED",
                seats: state.seats
            });
        }
    } catch(e){}
}

// Get active Firebase configuration
function getFirebaseConfig() {
    try {
        const custom = localStorage.getItem("custom_firebase_config");
        if (custom) {
            const parsed = JSON.parse(custom);
            // If the custom config points to the old sandbox demo key, discard it so we default to the new DB config
            if (parsed.apiKey === "AIzaSyA4c3BfU2FuZGJveEtleS1EZW1vMTIzNDU") {
                localStorage.removeItem("custom_firebase_config");
                return DEFAULT_FIREBASE_CONFIG;
            }
            return parsed;
        }
    } catch(e){}
    return DEFAULT_FIREBASE_CONFIG;
}

// Initialize application and database connections
function initApp() {
    const config = getFirebaseConfig();
    
    // Toggle login card reset link container if custom config is stored
    const customConfigStored = localStorage.getItem("custom_firebase_config") !== null;
    const authResetEl = document.getElementById("auth-reset-container");
    if (authResetEl) {
        authResetEl.style.display = customConfigStored ? "block" : "none";
    }
    
    // Set UI displays for inputs
    document.getElementById("fb-api-key").value = config.apiKey || "";
    document.getElementById("fb-auth-domain").value = config.authDomain || "";
    document.getElementById("fb-db-url").value = config.databaseURL || "";
    document.getElementById("fb-project-id").value = config.projectId || "";
    document.getElementById("fb-storage-bucket").value = config.storageBucket || "";
    
    // Load local storage fallback or mock data
    let localData = null;
    try {
        localData = localStorage.getItem("study_cafe_state");
    } catch(e){}
    
    if (localData) {
        try {
            state = JSON.parse(localData);
            // Reset to empty state if it's old mock data containing Rahul Sahu m_1
            if (state.members && state.members.some(m => m.id === "m_1" || m.name === "Rahul Sahu")) {
                loadMockData();
                saveStateToLocalStorage();
            } else if (!state.seats || state.seats.length !== 369) {
                state.seats = generateDefaultSeats();
                state.members.forEach(member => {
                    const seat = state.seats.find(s => s.id === member.seatId);
                    if (seat) {
                        seat.status = "occupied";
                        seat.assignedMemberId = member.id;
                    }
                });
            }
        } catch(e) {
            loadMockData();
            saveStateToLocalStorage();
        }
    } else {
        loadMockData();
        saveStateToLocalStorage();
    }
    
    // Initialize details
    document.getElementById("set-lib-name").value = state.settings.libraryName;
    document.getElementById("set-lib-phone").value = state.settings.phone || "9876543210";
    document.getElementById("set-lib-addr").value = state.settings.address;
    const qrLibTitle = document.getElementById("qr-lib-title");
    if (qrLibTitle) qrLibTitle.textContent = state.settings.libraryName;
    
    // Set max date limit on Member DOB input in the modal to prevent future birth dates
    const dobInput = document.getElementById("m-dob");
    if (dobInput) {
        dobInput.max = new Date().toISOString().split('T')[0];
    }
    
    // Try to load Firebase
    if (window.firebase && window.firebase.initializeApp && window.firebase.auth) {
        try {
            const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
            database = app.database();
            
            // Set up Firebase Authentication state observer
            firebase.auth().onAuthStateChanged(user => {
                const authOverlay = document.getElementById("auth-overlay");
                const appContainer = document.getElementById("app-container");
                
                if (user) {
                    // Logged in
                    if (authOverlay) authOverlay.style.display = "none";
                    if (appContainer) appContainer.style.display = "flex";
                    
                    const statusDot = document.getElementById("db-status-dot");
                    const statusText = document.getElementById("db-status-text");
                    if (statusDot) statusDot.className = "status-dot online";
                    if (statusText) statusText.textContent = config.apiKey === "AIzaSyA4c3BfU2FuZGJveEtleS1EZW1vMTIzNDU" ? "Demo Database" : "Private DB Connected";
                    
                    setupFirebaseListeners();
                    checkOfflinePendingBookings();
                } else {
                    // Logged out
                    if (authOverlay) authOverlay.style.display = "flex";
                    if (appContainer) appContainer.style.display = "none";
                    
                    // Detach listeners to prevent permission errors
                    if (database) {
                        database.ref("study_cafe_system").off();
                        database.ref("pending_bookings").off();
                    }
                }
            });
        } catch (err) {
            console.error("Firebase init failed, running in Offline Mode", err);
            enableOfflineMode();
        }
    } else {
        enableOfflineMode();
    }

    // Set up Broadcast Channel for local cross-tab sync
    if (window.BroadcastChannel) {
        broadcastChannel = new BroadcastChannel('study_cafe_db');
        broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.type === "NEW_BOOKING_REQUEST") {
                handleIncomingBooking(event.data.data);
            }
        };
    }
    
    checkOfflinePendingBookings();

    // Add image input change listener for compression
    const photoInput = document.getElementById("m-photo");
    if (photoInput) {
        photoInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const ctx = canvas.getContext("2d");
                    canvas.width = 600;
                    canvas.height = 600;
                    
                    // Center crop and draw to 600x600 canvas
                    const minDim = Math.min(img.width, img.height);
                    const sx = (img.width - minDim) / 2;
                    const sy = (img.height - minDim) / 2;
                    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 600, 600);
                    
                    modalPhotoBase64 = canvas.toDataURL("image/jpeg", 0.7);
                    
                    // Update visual UI preview
                    const placeholder = document.getElementById("m-photo-placeholder");
                    if (placeholder) placeholder.style.display = "none";
                    
                    const previewImg = document.getElementById("m-photo-preview");
                    if (previewImg) {
                        previewImg.src = modalPhotoBase64;
                        previewImg.style.display = "block";
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Set Default Tab
    switchTab("dashboard");
    

    
    refreshUI();
    updateRegistrationQR();
    // Setup Admin Modal Same as Recent Address checkbox logic
    const adminSameAddressCheck = document.getElementById("m-same-address");
    if (adminSameAddressCheck) {
        adminSameAddressCheck.addEventListener("change", function() {
            const permSection = document.getElementById("m-permanent-address-section");
            const permInputs = permSection.querySelectorAll("input");
            if (this.checked) {
                document.getElementById("m-permanent-street").value = document.getElementById("m-street").value;
                document.getElementById("m-permanent-city").value = document.getElementById("m-city").value;
                document.getElementById("m-permanent-state").value = document.getElementById("m-state").value;
                document.getElementById("m-permanent-zip").value = document.getElementById("m-zip").value;
                
                permInputs.forEach(input => {
                    input.required = false;
                    input.disabled = true;
                });
                permSection.style.opacity = "0.5";
            } else {
                permInputs.forEach(input => {
                    input.required = true;
                    input.disabled = false;
                });
                permSection.style.opacity = "1";
            }
        });
        
        const currentInputs = ["m-street", "m-city", "m-state", "m-zip"];
        currentInputs.forEach(id => {
            document.getElementById(id).addEventListener("input", function() {
                if (adminSameAddressCheck.checked) {
                    const permId = id === "m-street" ? "m-permanent-street" :
                                   id === "m-city" ? "m-permanent-city" :
                                   id === "m-state" ? "m-permanent-state" : "m-permanent-zip";
                    document.getElementById(permId).value = this.value;
                }
            });
        });
    }
    
    startLiveClock();
}

function enableOfflineMode() {
    isOfflineMode = true;
    
    // Hide auth screen and show container when running in offline fallback
    const authOverlay = document.getElementById("auth-overlay");
    const appContainer = document.getElementById("app-container");
    if (authOverlay) authOverlay.style.display = "none";
    if (appContainer) appContainer.style.display = "flex";
    
    const statusDot = document.getElementById("db-status-dot");
    const statusText = document.getElementById("db-status-text");
    if (statusDot) statusDot.className = "status-dot";
    if (statusText) statusText.textContent = "Offline Mode";
    showToast("Running in Local Offline Mode. Changes will save in this browser.", "info");
}

// Realtime sync listeners
function setupFirebaseListeners() {
    if (!database) return;
    
    const dbRef = database.ref("study_cafe_system");
    
    // Initialize database node if empty, or perform seat migration
    dbRef.once("value", snapshot => {
        if (!snapshot.exists()) {
            dbRef.set({
                settings: state.settings,
                seats: state.seats,
                members: state.members
            });
        } else {
            const val = snapshot.val();
            const seatsVal = val.seats;
            const membersVal = val.members ? Object.values(val.members) : [];
            
            if (!Array.isArray(seatsVal) || seatsVal.length !== 369) {
                console.warn(`Database seats length mismatch (${seatsVal ? seatsVal.length : 0} != 369). Running auto-migration...`);
                const defaultSeats = generateDefaultSeats();
                
                // Map existing member bookings onto the correct seats
                membersVal.forEach(member => {
                    if (member.seatId && member.seatId !== "non-reserved") {
                        const seat = defaultSeats.find(s => s.id === member.seatId);
                        if (seat) {
                            seat.status = "occupied";
                            seat.assignedMemberId = member.id;
                        }
                    }
                });
                
                dbRef.child("seats").set(defaultSeats);
            }
        }
    });
    
    // Listen to Seat mutations
    dbRef.child("seats").on("value", snapshot => {
        if (snapshot.exists()) {
            let seatsVal = snapshot.val();
            let changed = false;
            if (Array.isArray(seatsVal)) {
                seatsVal.forEach(seat => {
                    if (seat) {
                        const expectedNumber = seat.number > 100 ? (seat.number - (seat.room - 1) * 100) : seat.number;
                        if (seat.number !== expectedNumber) {
                            seat.number = expectedNumber;
                            changed = true;
                        }
                    }
                });
                if (changed) {
                    dbRef.child("seats").set(seatsVal);
                }
            }
            state.seats = seatsVal;
            saveStateToLocalStorage();
            renderSeatGrid();
            updateDashboardKPIs();
        }
    });

    // Listen to Member list
    dbRef.child("members").on("value", snapshot => {
        if (snapshot.exists()) {
            state.members = Object.values(snapshot.val());
        } else {
            state.members = [];
        }
        
        // Auto-update registered_phones in Firebase from Admin dashboard
        const regPhones = {};
        state.members.forEach(m => {
            if (m.phone) {
                const cleanPhone = m.phone.replace(/\D/g, "");
                const phone10 = cleanPhone.slice(-10);
                if (phone10.length === 10) {
                    regPhones[phone10] = {
                        status: m.status || "active"
                    };
                }
            }
        });
        dbRef.child("registered_phones").set(regPhones);
        state.registered_phones = regPhones;

        saveStateToLocalStorage();
        renderMemberTable();
        updateDashboardKPIs();
        renderDashboardAlerts();
        renderBirthdayAlerts();
        updateFeesBadge();
        if (currentTab === "fees") {
            renderFeesTab();
        }
    });

    // Listen to Pending requests
    database.ref("pending_bookings").on("value", snapshot => {
        const oldPendingCount = state.pending.length;
        if (snapshot.exists()) {
            const rawBookings = Object.entries(snapshot.val()).map(([key, val]) => ({...val, id: key}));
            
            // Auto-delete matching bookings from Firebase if they already exist as active members
            rawBookings.forEach(p => {
                const cleanPPhone = (p.phone || "").toString().replace(/[^0-9]/g, "");
                if (cleanPPhone.length > 0) {
                    const isAlreadyRegistered = state.members.some(m => {
                        const cleanMPhone = (m.phone || "").toString().replace(/[^0-9]/g, "");
                        const expiry = new Date(m.expiryDate);
                        return cleanMPhone === cleanPPhone && expiry >= new Date().setHours(0,0,0,0);
                    });
                    if (isAlreadyRegistered) {
                        database.ref("pending_bookings").child(p.id).remove()
                            .catch(err => console.warn("Failed to remove matching pending booking:", err));
                    }
                }
            });

            state.pending = rawBookings
                .filter(p => !recentlyApprovedOrRejected.has(p.id))
                .filter(p => {
                    const cleanPPhone = (p.phone || "").toString().replace(/[^0-9]/g, "");
                    if (cleanPPhone.length === 0) return true;
                    const isAlreadyRegistered = state.members.some(m => {
                        const cleanMPhone = (m.phone || "").toString().replace(/[^0-9]/g, "");
                        const expiry = new Date(m.expiryDate);
                        return cleanMPhone === cleanPPhone && expiry >= new Date().setHours(0,0,0,0);
                    });
                    return !isAlreadyRegistered;
                });
        } else {
            state.pending = [];
        }
        
        if (state.pending.length > oldPendingCount) {
            showToast("New Student Registration request received via QR!", "success");
        }
        
        saveStateToLocalStorage();
        updatePendingBadge();
        renderPendingRequests();
    });
    
    // Listen to Settings
    dbRef.child("settings").on("value", snapshot => {
        if (snapshot.exists()) {
            state.settings = snapshot.val();
            const qrLibTitle = document.getElementById("qr-lib-title");
            if (qrLibTitle) qrLibTitle.textContent = state.settings.libraryName;
            document.getElementById("set-lib-name").value = state.settings.libraryName;
            document.getElementById("set-lib-addr").value = state.settings.address;
            saveStateToLocalStorage();
        }
    });
    
    // Listen to Complaints
    dbRef.child("complaints").on("value", snapshot => {
        const oldPendingComplaintsCount = (state.complaints || []).filter(c => c && c.status === "pending").length;
        if (snapshot.exists()) {
            state.complaints = Object.entries(snapshot.val()).map(([key, val]) => ({...val, id: key}));
        } else {
            state.complaints = [];
        }
        
        const newPendingComplaintsCount = state.complaints.filter(c => c && c.status === "pending").length;
        if (newPendingComplaintsCount > oldPendingComplaintsCount) {
            showToast("New Student complaint ticket received!", "info");
        }
        
        saveStateToLocalStorage();
        updateComplaintsBadge();
        if (currentTab === "complaints") {
            renderComplaintsList();
        }
    });
    
    // Listeners for partial payments inside the admin student modal
    initModalPaymentListeners();
}

function initModalPaymentListeners() {
    const feeEl = document.getElementById("m-fee-amount");
    const paidEl = document.getElementById("m-amount-paid");
    const balEl = document.getElementById("m-balance-amount");
    const payStatusEl = document.getElementById("m-payment");
    
    if (feeEl && paidEl && balEl && payStatusEl) {
        const updateBalanceAndStatus = (fromStatusChange = false) => {
            const fee = parseFloat(feeEl.value) || 0;
            let paid = parseFloat(paidEl.value) || 0;
            
            if (fromStatusChange) {
                const status = payStatusEl.value;
                if (status === "Paid") {
                    paid = fee;
                    paidEl.value = fee;
                } else if (status === "Pending") {
                    paid = 0;
                    paidEl.value = 0;
                } else if (status === "Partial") {
                    if (paid >= fee || paid <= 0) {
                        paid = Math.floor(fee / 2);
                        paidEl.value = paid;
                    }
                }
            } else {
                if (paid > fee) {
                    paid = fee;
                    paidEl.value = fee;
                }
                if (paid < 0) {
                    paid = 0;
                    paidEl.value = 0;
                }
                
                // Update dropdown status based on input values
                if (paid === fee && fee > 0) {
                    payStatusEl.value = "Paid";
                } else if (paid === 0) {
                    payStatusEl.value = "Pending";
                } else {
                    payStatusEl.value = "Partial";
                }
            }
            
            balEl.value = fee - paid;
        };
        
        feeEl.addEventListener("input", () => updateBalanceAndStatus(false));
        paidEl.addEventListener("input", () => updateBalanceAndStatus(false));
        payStatusEl.addEventListener("change", () => updateBalanceAndStatus(true));
    }
}

// Handle data syncing when offline
function syncLocalToDatabase() {
    // Generate registered phone numbers lookup
    const regPhones = {};
    (state.members || []).forEach(m => {
        if (m.phone) {
            const cleanPhone = m.phone.replace(/\D/g, "");
            const phone10 = cleanPhone.slice(-10);
            if (phone10.length === 10) {
                regPhones[phone10] = {
                    status: m.status || "active"
                };
            }
        }
    });

    if (isOfflineMode || !database) {
        state.registered_phones = regPhones;
        saveStateToLocalStorage();
        return;
    }
    
    // Write individual nodes separately to avoid wiping out complaints/feedback nodes
    database.ref("study_cafe_system/settings").set(state.settings);
    database.ref("study_cafe_system/seats").set(state.seats);
    database.ref("study_cafe_system/members").set(state.members);
    database.ref("study_cafe_system/registered_phones").set(regPhones);
}

// Lightweight data patching for Firebase to write only modified nodes
function patchFirebaseData(changedMemberId = null, changedSeatIds = []) {
    // Generate registered phone numbers lookup
    const regPhones = {};
    (state.members || []).forEach(m => {
        if (m.phone) {
            const cleanPhone = m.phone.replace(/\D/g, "");
            const phone10 = cleanPhone.slice(-10);
            if (phone10.length === 10) {
                regPhones[phone10] = {
                    status: m.status || "active"
                };
            }
        }
    });

    state.registered_phones = regPhones;
    saveStateToLocalStorage();

    if (isOfflineMode || !database) return;
    
    // Write registered phones lookup
    database.ref("study_cafe_system/registered_phones").set(regPhones);

    // Patch member precisely
    if (changedMemberId) {
        const member = state.members.find(m => m.id === changedMemberId);
        if (member) {
            database.ref(`study_cafe_system/members/${member.id}`).set(member);
        } else {
            // Deleted
            database.ref(`study_cafe_system/members/${changedMemberId}`).remove();
        }
    }

    // Patch seats precisely
    if (changedSeatIds && changedSeatIds.length > 0) {
        changedSeatIds.forEach(seatId => {
            const idx = state.seats.findIndex(s => s.id === seatId);
            if (idx !== -1) {
                database.ref(`study_cafe_system/seats/${idx}`).set(state.seats[idx]);
            }
        });
    }
}

// Check for local offline pending submissions
function checkOfflinePendingBookings() {
    try {
        const localPending = JSON.parse(localStorage.getItem("offline_pending_bookings") || "[]");
        if (localPending.length > 0) {
            localPending.forEach(booking => {
                handleIncomingBooking(booking);
            });
            localStorage.removeItem("offline_pending_bookings");
        }
    } catch(e){}
}

// Insert booking submission
function handleIncomingBooking(booking) {
    const exists = state.pending.some(p => p.phone === booking.phone && p.timestamp === booking.timestamp);
    if (exists) return;
    
    // Check if phone matches any active member
    const cleanPhone = (booking.phone || "").toString().replace(/[^0-9]/g, "");
    if (cleanPhone.length > 0) {
        const isAlreadyRegistered = state.members.some(m => {
            const cleanMPhone = (m.phone || "").toString().replace(/[^0-9]/g, "");
            const expiry = new Date(m.expiryDate);
            return cleanMPhone === cleanPhone && expiry >= new Date().setHours(0,0,0,0);
        });
        if (isAlreadyRegistered) return;
    }

    state.pending.push(booking);
    showToast(`New Registration Alert: ${booking.name}`, "success");
    
    if (!isOfflineMode && database) {
        database.ref("pending_bookings").push(booking);
    } else {
        saveStateToLocalStorage();
        updatePendingBadge();
        renderPendingRequests();
    }
}

// View Switches
function switchTab(tabId) {
    currentTab = tabId;
    
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });
    document.getElementById(`nav-${tabId}`).classList.add("active");
    
    document.querySelectorAll(".content-section").forEach(sec => {
        sec.classList.remove("active");
    });
    document.getElementById(`section-${tabId}`).classList.add("active");
    
    if (tabId === "dashboard") {
        updateDashboardKPIs();
        renderDashboardAlerts();
        renderBirthdayAlerts();
    } else if (tabId === "seats") {
        renderSeatGrid();
    } else if (tabId === "members") {
        renderMemberTable();
    } else if (tabId === "pending") {
        renderPendingRequests();
    } else if (tabId === "birthdays") {
        renderBirthdayAlerts();
    } else if (tabId === "fees") {
        renderFeesTab();
    } else if (tabId === "settings") {
        updateRegistrationQR();
    } else if (tabId === "complaints") {
        renderComplaintsList();
    }
}

// Refresh Dashboard metrics
function updateDashboardKPIs() {
    const activeMembers = state.members.filter(m => {
        const expiry = new Date(m.expiryDate);
        return expiry >= new Date().setHours(0,0,0,0);
    });
    const activeMembersCount = activeMembers.length;

    const totalSeats = state.seats.length;
    document.getElementById("kpi-occupancy").textContent = `${activeMembersCount} / ${totalSeats}`;
    
    // Count Reserved vs Non-Reserved Members
    const reservedMembersCount = activeMembers.filter(m => m.seatId !== "non-reserved").length;
    document.getElementById("kpi-reserved").textContent = `${reservedMembersCount} Active`;

    const nonReservedMembersCount = activeMembersCount - reservedMembersCount;
    document.getElementById("kpi-general").textContent = `${nonReservedMembersCount} Active`;
    
    // Calculated Revenue
    const totalRevenue = state.members
        .filter(m => m.paymentStatus === "Paid")
        .reduce((sum, m) => sum + parseInt(m.feeAmount || 0), 0);
    
    document.getElementById("kpi-revenue").textContent = `₹${totalRevenue}`;
    
    // Update plan duration progress bars
    const planContainer = document.getElementById("plan-summary-container");
    if (planContainer) {
        planContainer.innerHTML = "";
        
        const durations = [
            { label: "1 Month Package", val: 1, color: "var(--accent-emerald)" },
            { label: "3 Months Package", val: 3, color: "var(--accent-blue)" },
            { label: "6 Months Package", val: 6, color: "var(--accent-rose)" }
        ];
        
        durations.forEach(dur => {
            const count = state.members.filter(m => m.duration === dur.val && new Date(m.expiryDate) >= new Date().setHours(0,0,0,0)).length;
            const percentage = activeMembersCount > 0 ? Math.round((count / activeMembersCount) * 100) : 0;
            
            const row = document.createElement("div");
            row.innerHTML = `
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.4rem;">
                    <span style="font-weight: 500;">${dur.label}</span>
                    <span style="color: var(--text-muted); font-weight: 600;">${count} Students (${percentage}%)</span>
                </div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 20px; overflow: hidden;">
                    <div style="width: ${percentage}%; height: 100%; background: ${dur.color}; border-radius: 20px; transition: width 0.5s ease;"></div>
                </div>
            `;
            planContainer.appendChild(row);
        });
    }

    // Calculate Room-wise occupancy
    for (let r = 1; r <= 4; r++) {
        const roomOccupants = state.members.filter(m => {
            const seat = state.seats.find(s => s.id === m.seatId);
            const expiry = new Date(m.expiryDate);
            return seat && seat.room === r && expiry >= new Date().setHours(0,0,0,0);
        }).length;
        
        const badge = document.getElementById(`room${r}-badge`);
        const progress = document.getElementById(`room${r}-progress`);
        const text = document.getElementById(`room${r}-text`);
        
        const maxSeats = r === 1 ? 69 : 100;
        
        if (badge) badge.textContent = `${roomOccupants} / ${maxSeats}`;
        if (progress) progress.style.width = `${(roomOccupants / maxSeats) * 100}%`;
        if (text) text.textContent = `${roomOccupants} Active Student${roomOccupants === 1 ? '' : 's'}`;
    }
}

// Render expiry alerts
function renderDashboardAlerts() {
    const list = document.getElementById("expiry-alert-list");
    list.innerHTML = "";
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const alertMembers = state.members.map(member => {
        const expiry = new Date(member.expiryDate);
        const timeDiff = expiry.getTime() - today.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        return { ...member, daysLeft: daysDiff };
    }).filter(m => m.daysLeft <= 3)
      .sort((a, b) => a.daysLeft - b.daysLeft);
      
    if (alertMembers.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-circle-check" style="color: var(--accent-emerald);"></i>
                <p>All memberships are up to date. No pending renewals!</p>
            </div>
        `;
        return;
    }
    
    alertMembers.forEach(member => {
        const item = document.createElement("div");
        const isExpired = member.daysLeft < 0;
        
        item.className = `alert-item ${isExpired ? 'expired' : ''}`;
        
        let displayDaysText = "";
        if (isExpired) {
            displayDaysText = `Expired ${Math.abs(member.daysLeft)}d ago`;
        } else if (member.daysLeft === 0) {
            displayDaysText = "Expires Today";
        } else if (member.daysLeft === 1) {
            displayDaysText = "1 Day Left";
        } else {
            displayDaysText = `${member.daysLeft} Days Left`;
        }
        
        const alertAvatarLetter = member.name ? member.name.charAt(0).toUpperCase() : '?';
        const safeAlertPhoto = member.photo && (member.photo.startsWith("data:image/") || member.photo.startsWith("http")) ? member.photo : "";
        const alertAvatarStyle = safeAlertPhoto ? `background-image: url('${safeAlertPhoto}'); background-size: cover; background-position: center; color: transparent; border: 1px solid var(--border-color);` : '';
        const alertAvatarContent = safeAlertPhoto ? '' : alertAvatarLetter;
        const clickableClass = safeAlertPhoto ? 'clickable-avatar' : '';
        const onclickAttr = safeAlertPhoto ? `onclick="openLightbox('${safeAlertPhoto}')"` : '';
        
        const seatInfoText = getSeatDisplayName(member.seatId);
        
        item.innerHTML = `
            <div class="alert-avatar ${clickableClass}" ${onclickAttr} style="${alertAvatarStyle}">${alertAvatarContent}</div>
            <div class="alert-details">
                <div class="alert-name">${escapeHTML(member.name)}</div>
                <div class="alert-info">${escapeHTML(seatInfoText)} • ${escapeHTML(member.phone)}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <div class="alert-expiry-days ${isExpired ? 'expired' : ''}">${displayDaysText}</div>
                <button class="btn-whatsapp-remind" onclick="sendExpiryReminder('${member.id}')" title="Send WhatsApp Reminder" style="background: rgba(37, 211, 102, 0.15); color: #25D366; border: 1px solid rgba(37, 211, 102, 0.3); border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s; font-weight: 500;" onmouseover="this.style.background='rgba(37, 211, 102, 0.25)'" onmouseout="this.style.background='rgba(37, 211, 102, 0.15)'">
                    <i class="fa-brands fa-whatsapp"></i> Remind
                </button>
            </div>
        `;
        list.appendChild(item);
    });
}

// Render birthday alerts in the new Birthdays tab
function renderBirthdayAlerts() {
    const todayList = document.getElementById("birthday-tab-list");
    const upcomingList = document.getElementById("upcoming-birthday-list");
    const badge = document.getElementById("birthday-badge-count");
    
    if (!todayList || !upcomingList) return;
    
    todayList.innerHTML = "";
    upcomingList.innerHTML = "";
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const currentMonth = today.getMonth() + 1; // 1-indexed
    const currentDate = today.getDate();
    
    // 1. Today's Birthdays
    const birthdayMembers = state.members.filter(member => {
        if (!member.dob) return false;
        const parts = member.dob.split('-');
        if (parts.length === 3) {
            const birthMonth = parseInt(parts[1], 10);
            const birthDate = parseInt(parts[2], 10);
            return birthMonth === currentMonth && birthDate === currentDate;
        }
        return false;
    });
    
    // Update Sidebar Badge Count
    if (badge) {
        if (birthdayMembers.length > 0) {
            badge.textContent = birthdayMembers.length;
            badge.style.display = "inline-block";
        } else {
            badge.style.display = "none";
        }
    }
    
    // Render Today's Birthdays
    if (birthdayMembers.length === 0) {
        todayList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-gift" style="color: var(--text-muted); opacity: 0.5;"></i>
                <p>No birthdays today.</p>
            </div>
        `;
    } else {
        birthdayMembers.forEach(member => {
            const item = document.createElement("div");
            item.className = "alert-item birthday";
            
            const avatarLetter = member.name ? member.name.charAt(0).toUpperCase() : '?';
            const safePhoto = member.photo && (member.photo.startsWith("data:image/") || member.photo.startsWith("http")) ? member.photo : "";
            const avatarStyle = safePhoto ? `background-image: url('${safePhoto}'); background-size: cover; background-position: center; color: transparent; border: 1px solid var(--border-color);` : '';
            const avatarContent = safePhoto ? '' : avatarLetter;
            const clickableClass = safePhoto ? 'clickable-avatar' : '';
            const onclickAttr = safePhoto ? `onclick="openLightbox('${safePhoto}')"` : '';
            
            const seatInfoText = getSeatDisplayName(member.seatId);
            
            item.innerHTML = `
                <div class="alert-avatar ${clickableClass}" ${onclickAttr} style="${avatarStyle}">${avatarContent}</div>
                <div class="alert-details">
                    <div class="alert-name" style="font-weight: 600; color: #fff;">${escapeHTML(member.name)} 🎂</div>
                    <div class="alert-info">${escapeHTML(seatInfoText)} • ${escapeHTML(member.phone)}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="btn-whatsapp-remind" onclick="sendBirthdayWish('${member.id}')" title="Send WhatsApp Wish" style="background: rgba(236, 72, 153, 0.15); color: #ec4899; border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 4px; padding: 4px 8px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s; font-weight: 500;" onmouseover="this.style.background='rgba(236, 72, 153, 0.25)'" onmouseout="this.style.background='rgba(236, 72, 153, 0.15)'">
                        <i class="fa-brands fa-whatsapp"></i> Wish
                    </button>
                </div>
            `;
            todayList.appendChild(item);
        });
    }
    
    // 2. Upcoming Birthdays (Next 7 Days)
    const upcomingMembers = [];
    state.members.forEach(member => {
        if (!member.dob) return;
        const parts = member.dob.split('-');
        if (parts.length === 3) {
            const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed for Date constructor
            const birthDate = parseInt(parts[2], 10);
            
            // Create a target date for this year's birthday
            const bdayThisYear = new Date(today.getFullYear(), birthMonth, birthDate);
            bdayThisYear.setHours(0,0,0,0);
            
            // If the birthday already passed this year, check next year
            let diffDays = Math.ceil((bdayThisYear.getTime() - today.getTime()) / (1000 * 3600 * 24));
            if (diffDays < 0) {
                const bdayNextYear = new Date(today.getFullYear() + 1, birthMonth, birthDate);
                diffDays = Math.ceil((bdayNextYear.getTime() - today.getTime()) / (1000 * 3600 * 24));
            }
            
            // We want upcoming birthdays in the next 7 days, excluding today (diffDays === 0)
            if (diffDays > 0 && diffDays <= 7) {
                upcomingMembers.push({ ...member, daysUntil: diffDays, birthMonth, birthDate });
            }
        }
    });
    
    // Sort upcoming birthdays by days remaining
    upcomingMembers.sort((a, b) => a.daysUntil - b.daysUntil);
    
    if (upcomingMembers.length === 0) {
        upcomingList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-calendar" style="color: var(--text-muted); opacity: 0.5;"></i>
                <p>No upcoming birthdays in the next 7 days.</p>
            </div>
        `;
    } else {
        upcomingMembers.forEach(member => {
            const item = document.createElement("div");
            item.className = "alert-item";
            
            const avatarLetter = member.name ? member.name.charAt(0).toUpperCase() : '?';
            const safePhoto = member.photo && (member.photo.startsWith("data:image/") || member.photo.startsWith("http")) ? member.photo : "";
            const avatarStyle = safePhoto ? `background-image: url('${safePhoto}'); background-size: cover; background-position: center; color: transparent; border: 1px solid var(--border-color);` : '';
            const avatarContent = safePhoto ? '' : avatarLetter;
            const clickableClass = safePhoto ? 'clickable-avatar' : '';
            const onclickAttr = safePhoto ? `onclick="openLightbox('${safePhoto}')"` : '';
            
            const seatInfoText = getSeatDisplayName(member.seatId);
            
            const bdayString = new Date(today.getFullYear(), member.birthMonth, member.birthDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short'
            });
            
            const daysText = member.daysUntil === 1 ? "Tomorrow" : `in ${member.daysUntil} days`;
            
            item.innerHTML = `
                <div class="alert-avatar ${clickableClass}" ${onclickAttr} style="${avatarStyle}">${avatarContent}</div>
                <div class="alert-details">
                    <div class="alert-name" style="font-weight: 600; color: #fff;">${escapeHTML(member.name)}</div>
                    <div class="alert-info">${escapeHTML(seatInfoText)} • ${escapeHTML(member.phone)}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="alert-expiry-days" style="color: var(--accent-blue); background: rgba(59, 130, 246, 0.08); border-left-color: var(--accent-blue); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
                        ${escapeHTML(bdayString)} (${daysText})
                    </div>
                </div>
            `;
            upcomingList.appendChild(item);
        });
    }
}

// Render interactive seat boxes filtered by Room
function createSeatBox(seat, today) {
    const box = document.createElement("div");
    box.className = "seat-box";
    box.setAttribute("id", `seatbox_${seat.id}`);
    
    let seatStatus = seat.status || "vacant";
    let activeOccupantId = seat.assignedMemberId;
    
    if (seatStatus === "occupied" && activeOccupantId) {
        const member = state.members.find(m => m.id === activeOccupantId);
        if (member) {
            const expiry = new Date(member.expiryDate);
            const daysDiff = Math.ceil((expiry.getTime() - today) / (1000 * 3600 * 24));
            if (daysDiff <= 3) {
                seatStatus = "expiring";
            }
        } else {
            seatStatus = "vacant";
            seat.status = "vacant";
            seat.assignedMemberId = null;
        }
    }
    
    box.classList.add(seatStatus);
    
    if (seatStatus === "occupied" || seatStatus === "expiring") {
        if (seat.type === "reserved") {
            box.classList.add("reserved-seat");
        } else {
            box.classList.add("general-seat");
        }
    }
    
    const numSpan = document.createElement("span");
    numSpan.className = "seat-num";
    numSpan.textContent = seat.number;
    box.appendChild(numSpan);
    
    box.onclick = () => openSeatActionsModal(seat.id);
    return box;
}

function renderPhysicalLayoutRoom1(grid, roomSeats, today) {
    grid.classList.add("physical-layout-active");
    
    const container = document.createElement("div");
    container.className = "physical-layout-container";
    
    // Filter roomSeats to ensure we only render up to seat 69
    const activeSeats = roomSeats.filter(s => s.number <= 69);
    
    // Sort roomSeats by number to ensure they are sequential
    activeSeats.sort((a, b) => a.number - b.number);
    
    // 1. Top Row (66 to 69 - Ordered right 66 to left 69 -> 69, 68, 67, 66)
    const topRow = document.createElement("div");
    topRow.className = "layout-row top-row";
    const topBlock = document.createElement("div");
    topBlock.className = "top-block";
    const topSlices = activeSeats.slice(65, 69).reverse();
    topSlices.forEach(seat => {
        topBlock.appendChild(createSeatBox(seat, today));
    });
    topRow.appendChild(topBlock);
    container.appendChild(topRow);
    
    // 2. Horizontal Walkway
    const walkway1 = document.createElement("div");
    walkway1.className = "layout-walkway horizontal-walkway";
    walkway1.textContent = "Walkway";
    container.appendChild(walkway1);
    
    // 3. Middle Section
    const middleSection = document.createElement("div");
    middleSection.className = "layout-middle-section";
    
    // Left Column (1 to 17 - Bottom to top -> Reversed 17 down to 1)
    const leftCol = document.createElement("div");
    leftCol.className = "layout-column left-column";
    const leftSlices = activeSeats.slice(0, 17).reverse();
    leftSlices.forEach(seat => {
        leftCol.appendChild(createSeatBox(seat, today));
    });
    middleSection.appendChild(leftCol);
    
    // Walkway
    const walkwayV1 = document.createElement("div");
    walkwayV1.className = "layout-walkway vertical-walkway";
    walkwayV1.textContent = "Walkway";
    middleSection.appendChild(walkwayV1);
    
    // Middle Double Column
    const midDouble = document.createElement("div");
    midDouble.className = "layout-middle-double-block";
    
    // Middle Left (18 to 32 - Top to bottom -> Normal 18 to 32)
    const midLeftCol = document.createElement("div");
    midLeftCol.className = "layout-column mid-left-column";
    const midLeftSlices = activeSeats.slice(17, 32);
    midLeftSlices.forEach(seat => {
        midLeftCol.appendChild(createSeatBox(seat, today));
    });
    midDouble.appendChild(midLeftCol);
    
    // Partition line
    const partition = document.createElement("div");
    partition.className = "layout-partition";
    midDouble.appendChild(partition);
    
    // Middle Right (33 to 47 - Bottom to top -> Reversed 47 down to 33)
    const midRightCol = document.createElement("div");
    midRightCol.className = "layout-column mid-right-column";
    const midRightSlices = activeSeats.slice(32, 47).reverse();
    midRightSlices.forEach(seat => {
        midRightCol.appendChild(createSeatBox(seat, today));
    });
    midDouble.appendChild(midRightCol);
    
    middleSection.appendChild(midDouble);
    
    // Walkway
    const walkwayV2 = document.createElement("div");
    walkwayV2.className = "layout-walkway vertical-walkway";
    walkwayV2.textContent = "Walkway";
    middleSection.appendChild(walkwayV2);
    
    // Right Column (48 to 65 - Bottom to top -> Reversed 65 down to 48)
    const rightCol = document.createElement("div");
    rightCol.className = "layout-column right-column";
    const rightSlices = activeSeats.slice(47, 65).reverse();
    rightSlices.forEach(seat => {
        rightCol.appendChild(createSeatBox(seat, today));
    });
    middleSection.appendChild(rightCol);
    
    container.appendChild(middleSection);
    
    // 4. Bottom Walkway & Gate
    const bottomSection = document.createElement("div");
    bottomSection.className = "layout-bottom-section";
    
    const bottomWalkway = document.createElement("div");
    bottomWalkway.className = "layout-walkway horizontal-walkway bottom-walkway";
    bottomWalkway.textContent = "Walkway";
    bottomSection.appendChild(bottomWalkway);
    
    const gate = document.createElement("div");
    gate.className = "layout-gate";
    gate.textContent = "Gate 🚪";
    bottomSection.appendChild(gate);
    
    container.appendChild(bottomSection);
    
    grid.appendChild(container);
}

function renderStandardGridLayout(grid, roomSeats, today) {
    grid.classList.remove("physical-layout-active");
    roomSeats.forEach(seat => {
        grid.appendChild(createSeatBox(seat, today));
    });
}

function renderSeatGrid() {
    const grid = document.getElementById("seat-grid");
    if (!grid) return;
    grid.innerHTML = "";
    
    const selectedRoom = parseInt(document.getElementById("seat-filter-room").value) || 1;
    const today = new Date().setHours(0,0,0,0);
    
    const roomSeats = state.seats.filter(s => s.room === selectedRoom);
    
    if (selectedRoom === 1) {
        renderPhysicalLayoutRoom1(grid, roomSeats, today);
    } else {
        renderStandardGridLayout(grid, roomSeats, today);
    }
}

// Render Member directory table
function renderMemberTable() {
    const tbody = document.getElementById("member-table-body");
    tbody.innerHTML = "";
    
    const searchVal = document.getElementById("member-search").value.toLowerCase().trim();
    const validityFilter = document.getElementById("filter-validity").value;
    const typeFilter = document.getElementById("filter-type").value;
    const roomFilter = document.getElementById("filter-room").value;
    const examFilter = document.getElementById("filter-exam").value;
    const paymentFilter = document.getElementById("filter-payment").value;
    const paymentMethodFilter = document.getElementById("filter-payment-method").value;
    const durationFilter = document.getElementById("filter-duration").value;
    
    let filteredMembers = state.members;
    
    if (searchVal) {
        filteredMembers = filteredMembers.filter(m => 
            m.name.toLowerCase().includes(searchVal) || 
            m.phone.includes(searchVal) || 
            getSeatDisplayName(m.seatId).toLowerCase().includes(searchVal)
        );
    }
    
    // 1. Validity filter
    const today = new Date().setHours(0,0,0,0);
    if (validityFilter !== "all") {
        filteredMembers = filteredMembers.filter(m => {
            const expiry = new Date(m.expiryDate);
            const daysDiff = Math.ceil((expiry.getTime() - today) / (1000 * 3600 * 24));
            if (validityFilter === "active") {
                return daysDiff >= 0;
            } else if (validityFilter === "expiring") {
                return daysDiff >= 0 && daysDiff <= 3;
            } else if (validityFilter === "expired") {
                return daysDiff < 0;
            }
            return true;
        });
    }

    // 2. Seat Type Filter (Reserved vs Non-Reserved)
    if (typeFilter !== "all") {
        filteredMembers = filteredMembers.filter(m => {
            if (typeFilter === "non-reserved") {
                return m.seatId === "non-reserved";
            } else if (typeFilter === "reserved") {
                return m.seatId !== "non-reserved";
            }
            return true;
        });
    }

    // Room filter
    if (roomFilter !== "all") {
        filteredMembers = filteredMembers.filter(m => {
            const seat = state.seats.find(s => s.id === m.seatId);
            return seat && seat.room === parseInt(roomFilter);
        });
    }

    // 3. Exam filter
    if (examFilter !== "all") {
        filteredMembers = filteredMembers.filter(m => m.targetExam === examFilter);
    }
    
    // 4. Payment status filter
    if (paymentFilter !== "all") {
        filteredMembers = filteredMembers.filter(m => m.paymentStatus === paymentFilter);
    }

    // 5. Payment method filter
    if (paymentMethodFilter !== "all") {
        filteredMembers = filteredMembers.filter(m => m.paymentMethod === paymentMethodFilter);
    }

    // 6. Plan package duration filter
    if (durationFilter !== "all") {
        filteredMembers = filteredMembers.filter(m => m.duration === parseInt(durationFilter));
    }
    
    filteredMembers.sort((a, b) => b.timestamp - a.timestamp);
    
    if (filteredMembers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fa-solid fa-users-slash"></i>
                    <p>No members found matching the selected criteria.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    filteredMembers.forEach(member => {
        const tr = document.createElement("tr");
        const seat = state.seats.find(s => s.id === member.seatId);
        
        const startDateFmt = new Date(member.startDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
        const expiryDateFmt = new Date(member.expiryDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
        
        const todayZero = new Date();
        todayZero.setHours(0,0,0,0);
        const isExpired = new Date(member.expiryDate) < todayZero;
        
        let expiryStatusText = 'Active';
        if (isExpired) {
            const timeDiff = todayZero.getTime() - new Date(member.expiryDate).getTime();
            const daysExpired = Math.ceil(timeDiff / (1000 * 3600 * 24));
            expiryStatusText = `Expired (${daysExpired}d ago)`;
        }
        
        const avatarLetter = member.name ? member.name.charAt(0).toUpperCase() : '?';
        // Prevent payload execution inside style URLs (only permit safe characters/base64 strings or clean URIs)
        const safePhoto = member.photo && (member.photo.startsWith("data:image/") || member.photo.startsWith("http")) ? member.photo : "";
        const avatarStyle = safePhoto ? `background-image: url('${safePhoto}'); background-size: cover; background-position: center; color: transparent; border: 1px solid var(--border-color);` : '';
        const avatarContent = safePhoto ? '' : avatarLetter;
        const clickableClass = safePhoto ? 'clickable-avatar' : '';
        const onclickAttr = safePhoto ? `onclick="openLightbox('${safePhoto}')"` : '';
        
        let seatDisplayHTML = "";
        const isDemoMember = member.status === "demo" || member.status === "demo-expired";
        let badgeClass = isDemoMember ? (member.status === "demo" ? "demo" : "demo-expired") : "";
        let badgeLabel = isDemoMember ? (member.status === "demo" ? "Free Demo" : "Demo Expired") : "";
        
        if (member.seatId === "non-reserved") {
            seatDisplayHTML = `
                <strong style="color: #fff;">Non-Reserved</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top:1px;">Flexible</div>
                <span class="badge ${isDemoMember ? badgeClass : 'general'}" style="display:block; width:fit-content; margin-top:2px;">
                    ${isDemoMember ? badgeLabel : 'Non-Reserved'}
                </span>
            `;
        } else {
            const seatInfo = getSeatRoomAndNumber(member.seatId);
            const plan = PLANS.find(p => p.id === member.planId);
            const isReserved = plan ? plan.type === "reserved" : (seat ? seat.type === "reserved" : false);
            seatDisplayHTML = `
                <strong style="color: #fff;">Seat ${seatInfo.number}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top:1px;">Room ${seatInfo.room}</div>
                <span class="badge ${isDemoMember ? badgeClass : (isReserved ? 'reserved' : 'general')}" style="display:block; width:fit-content; margin-top:2px;">
                    ${isDemoMember ? badgeLabel : (isReserved ? "Cabin" : "Non-Reserved")}
                </span>
            `;
        }
        
        let planLabel = "";
        if (isDemoMember) {
            planLabel = `Free Demo Pass (${member.demoDuration || 5} Days)`;
        } else {
            planLabel = PLANS.find(p => p.id === member.planId)?.name || 'Custom Plan';
        }
        
        tr.innerHTML = `
            <td>
                <div class="member-profile">
                    <div class="member-avatar ${clickableClass}" ${onclickAttr} style="${avatarStyle}">${avatarContent}</div>
                    <div>
                        <div class="member-name">${escapeHTML(member.name)}</div>
                        <div class="member-phone">${escapeHTML(member.phone)}</div>
                    </div>
                </div>
            </td>
            <td>
                ${seatDisplayHTML}
            </td>
            <td>
                <div>₹${member.feeAmount}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 1px;">
                    ${escapeHTML(planLabel)} (${escapeHTML(member.paymentMethod || 'Cash')})
                </div>
            </td>
            <td>
                <div style="font-size: 0.85rem;">${startDateFmt} to ${expiryDateFmt}</div>
                <span style="font-size: 0.75rem; font-weight:600; color: ${isExpired ? 'var(--accent-rose)' : 'var(--text-muted)'}; margin-top:2px; display:inline-block;">
                    ${expiryStatusText}
                </span>
            </td>
            <td>
                <span class="badge ${member.paymentStatus === 'Paid' ? 'paid' : 'pending'}" style="cursor:pointer;" onclick="togglePaymentStatus('${member.id}')">
                    ${member.paymentStatus}
                </span>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="btn-icon-only btn-secondary" onclick="openReceiptModal('${member.id}')" title="Receipt Invoice">
                        <i class="fa-solid fa-file-invoice" style="color: var(--accent-emerald);"></i>
                    </button>
                    <button class="btn-icon-only btn-secondary" onclick="sendExpiryReminder('${member.id}')" title="Send WhatsApp Reminder">
                        <i class="fa-brands fa-whatsapp" style="color: #25D366;"></i>
                    </button>
                    <button class="btn-icon-only btn-secondary" onclick="openEditMemberModal('${member.id}')" title="Edit Member">
                        <i class="fa-solid fa-pen" style="color: var(--accent-blue);"></i>
                    </button>
                    ${isDemoMember ? `
                    <button class="btn-icon-only btn-secondary" onclick="openConvertDemoModal('${member.id}')" title="Convert to Permanent">
                        <i class="fa-solid fa-user-check" style="color: var(--accent-amber);"></i>
                    </button>
                    ` : `
                    <button class="btn-icon-only btn-secondary" onclick="renewMembershipPrompt('${member.id}')" title="Renew Membership">
                        <i class="fa-solid fa-arrows-rotate" style="color: var(--accent-emerald);"></i>
                    </button>
                    `}
                    <button class="btn-icon-only btn-secondary" onclick="deleteMember('${member.id}')" title="Delete Record">
                        <i class="fa-solid fa-trash" style="color: var(--accent-rose);"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Clear all search and filter dropdowns
function clearAllFilters() {
    document.getElementById("member-search").value = "";
    document.getElementById("filter-validity").value = "all";
    document.getElementById("filter-type").value = "all";
    document.getElementById("filter-room").value = "all";
    document.getElementById("filter-exam").value = "all";
    document.getElementById("filter-payment").value = "all";
    document.getElementById("filter-payment-method").value = "all";
    document.getElementById("filter-duration").value = "all";
    
    renderMemberTable();
}

// Render pending QR requests table
function renderPendingRequests() {
    const tbody = document.getElementById("pending-table-body");
    tbody.innerHTML = "";
    
    if (state.pending.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <i class="fa-solid fa-circle-check" style="color: var(--accent-emerald);"></i>
                    <p>No pending registration requests. Paste the QR code at reception to accept entries!</p>
                </td>
            </tr>
        `;
        return;
    }
    
    state.pending.sort((a, b) => b.timestamp - a.timestamp);
    
    state.pending.forEach(req => {
        const tr = document.createElement("tr");
        const dateSubmitted = new Date(req.timestamp).toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'});
        let seatDetailsHTML = "";
        if (req.seatId === "non-reserved") {
            seatDetailsHTML = `<div style="font-size: 0.75rem; color: #fff; margin-top: 5px;">Requested: <strong>Non-Reserved</strong></div>`;
        } else {
            const seatInfo = getSeatRoomAndNumber(req.seatId);
            seatDetailsHTML = `<div style="font-size: 0.75rem; color: #fff; margin-top: 5px;">Requested: <strong>Room ${seatInfo.room} - Seat ${seatInfo.number}</strong></div>`;
        }
        
        const reqAvatarLetter = req.name ? req.name.charAt(0).toUpperCase() : '?';
        const safeReqPhoto = req.photo && (req.photo.startsWith("data:image/") || req.photo.startsWith("http")) ? req.photo : "";
        const reqAvatarStyle = safeReqPhoto ? `background-image: url('${safeReqPhoto}'); background-size: cover; background-position: center; color: transparent; border: 1px solid var(--border-color);` : 'color: var(--accent-amber);';
        const reqAvatarContent = safeReqPhoto ? '' : reqAvatarLetter;
        const clickableClass = safeReqPhoto ? 'clickable-avatar' : '';
        const onclickAttr = safeReqPhoto ? `onclick="openLightbox('${safeReqPhoto}')"` : '';
        
        const isDemoReq = req.bookingType === "demo";
        tr.innerHTML = `
            <td>
                <div class="member-profile">
                    <div class="member-avatar ${clickableClass}" ${onclickAttr} style="${reqAvatarStyle}">${reqAvatarContent}</div>
                    <div>
                        <div class="member-name">${escapeHTML(req.name)} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">(${escapeHTML(req.gender || 'N/A')})</span></div>
                        <div class="member-phone">${escapeHTML(req.phone)}</div>
                    </div>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top:5px;">
                    Father: <strong>${escapeHTML(req.fatherName || 'N/A')}</strong> (${escapeHTML(req.fatherPhone || 'N/A')})
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top:2px;">
                    Mother: <strong>${escapeHTML(req.motherName || 'N/A')}</strong> (${escapeHTML(req.motherPhone || 'N/A')})
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top:2px;">
                    Email: <strong>${escapeHTML(req.email || 'N/A')}</strong>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top:2px;">Submitted today at ${dateSubmitted}</div>
            </td>
            <td>
                <span class="badge ${isDemoReq ? 'demo' : (req.seatType === 'reserved' ? 'reserved' : 'general')}">
                    ${isDemoReq ? 'Demo Session' : (req.seatType === 'reserved' ? 'Reserved' : 'Non-Reserved')}
                </span>
                ${seatDetailsHTML}
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px;">Pay via: <strong>${isDemoReq ? 'Free Trial' : escapeHTML(req.paymentMethod || 'Cash')}</strong></div>
            </td>
            <td><strong style="color: #fff;">${isDemoReq ? `${req.demoDuration || 5} Day(s)` : `${req.duration} Month(s)`}</strong></td>
            <td>
                <span style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">Aadhaar: ${escapeHTML(req.govId || 'N/A')}</span>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Current: ${escapeHTML(req.currentAddress)}">
                    Addr: ${escapeHTML(req.currentAddress || 'N/A')}
                </div>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="btn btn-primary" onclick="approvePendingRequest('${req.id}')" style="padding: 0.4rem 0.8rem; font-size:0.8rem;">
                        <i class="fa-solid fa-check"></i> Assign Seat & Approve
                    </button>
                    <button class="btn btn-secondary" onclick="rejectPendingRequest('${req.id}')" style="padding: 0.4rem 0.8rem; font-size:0.8rem;">
                        <i class="fa-solid fa-times" style="color: var(--accent-rose);"></i> Reject
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updatePendingBadge() {
    const badge = document.getElementById("pending-count");
    if (!badge) return;
    
    const count = state.pending.length;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }
}

function refreshUI() {
    checkDemoExpirations();
    updateDashboardKPIs();
    renderDashboardAlerts();
    renderBirthdayAlerts();
    renderSeatGrid();
    renderMemberTable();
    updatePendingBadge();
    renderPendingRequests();
    updateFeesBadge();
    if (currentTab === "fees") {
        renderFeesTab();
    }
}

// Modal actions
function openModal(modalId) {
    document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
    if (modalId === "modal-member") {
        document.getElementById("form-member").onsubmit = handleMemberFormSubmit;
    }
}

// Member Registration Modal logic
function openAddMemberModal() {
    adminModalIsDemo = false;
    adminModalDemoDuration = 5;
    
    // Reset readonly/disabled fee fields
    document.getElementById("m-fee-amount").readOnly = false;
    document.getElementById("m-amount-paid").readOnly = false;
    document.getElementById("m-payment").disabled = false;
    document.getElementById("m-payment-method").disabled = false;
    
    document.getElementById("modal-member-title").textContent = "Add New Member";
    document.getElementById("form-member").reset();
    document.getElementById("form-member").onsubmit = handleMemberFormSubmit;
    document.getElementById("edit-member-id").value = "";
    
    // Reset permanent address fields states
    const adminSameAddressCheck = document.getElementById("m-same-address");
    if (adminSameAddressCheck) {
        adminSameAddressCheck.checked = false;
        const permSection = document.getElementById("m-permanent-address-section");
        if (permSection) {
            permSection.style.opacity = "1";
            const permInputs = permSection.querySelectorAll("input");
            permInputs.forEach(input => {
                input.disabled = false;
                input.required = true;
            });
        }
    }
    
    document.getElementById("m-start-date").value = new Date().toISOString().split('T')[0];
    
    // Clear photo preview
    modalPhotoBase64 = null;
    document.getElementById("m-photo-placeholder").style.display = "block";
    const previewImg = document.getElementById("m-photo-preview");
    if (previewImg) {
        previewImg.src = "";
        previewImg.style.display = "none";
    }
    
    onModalSeatTypeChange();
    
    // Clear installments and hide section for new members
    currentModalInstallments = [];
    const instSection = document.getElementById("m-installments-section");
    if (instSection) {
        instSection.style.display = "none";
    }

    openModal("modal-member");
}

function openEditMemberModal(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    adminModalIsDemo = (member.planId && member.planId.startsWith("demo")) || member.status === "demo" || member.status === "demo-expired";
    adminModalDemoDuration = member.demoDuration || (member.planId && member.planId.startsWith("demo-") ? parseInt(member.planId.replace("demo-", "")) : 5) || 5;
    
    // Toggle readonly/disabled states for fee & payment fields depending on demo status
    if (adminModalIsDemo) {
        document.getElementById("m-fee-amount").readOnly = true;
        document.getElementById("m-amount-paid").readOnly = true;
        document.getElementById("m-payment").disabled = true;
        document.getElementById("m-payment-method").disabled = true;
        
        document.getElementById("modal-member-title").textContent = member.status === "demo-expired" ? "Edit Expired Demo Info" : "Edit Free Demo Info";
    } else {
        document.getElementById("m-fee-amount").readOnly = false;
        // m-amount-paid is readOnly because it calculates from installments
        document.getElementById("m-amount-paid").readOnly = true;
        document.getElementById("m-payment").disabled = false;
        document.getElementById("m-payment-method").disabled = false;
        
        document.getElementById("modal-member-title").textContent = "Edit Member Info";
    }
    
    document.getElementById("edit-member-id").value = member.id;
    document.getElementById("form-member").onsubmit = handleMemberFormSubmit;
    
    // Set photo preview from member photo
    modalPhotoBase64 = member.photo || null;
    const previewImg = document.getElementById("m-photo-preview");
    const placeholder = document.getElementById("m-photo-placeholder");
    if (modalPhotoBase64) {
        if (placeholder) placeholder.style.display = "none";
        if (previewImg) {
            previewImg.src = modalPhotoBase64;
            previewImg.style.display = "block";
        }
    } else {
        if (placeholder) placeholder.style.display = "block";
        if (previewImg) {
            previewImg.src = "";
            previewImg.style.display = "none";
        }
    }
    
    document.getElementById("m-name").value = member.name;
    document.getElementById("m-phone").value = member.phone;
    document.getElementById("m-gender").value = member.gender || "";
    document.getElementById("m-email").value = member.email || "";
    
    document.getElementById("m-father-name").value = member.fatherName || "";
    document.getElementById("m-father-phone").value = member.fatherPhone || "";
    document.getElementById("m-mother-name").value = member.motherName || "";
    document.getElementById("m-mother-phone").value = member.motherPhone || "";
    
    document.getElementById("m-street").value = member.street || member.currentAddress || "";
    document.getElementById("m-city").value = member.city || "";
    document.getElementById("m-state").value = member.state || "";
    document.getElementById("m-zip").value = member.zip || "";
    
    document.getElementById("m-permanent-street").value = member.permanentStreet || member.permanentAddress || member.currentAddress || "";
    document.getElementById("m-permanent-city").value = member.permanentCity || "";
    document.getElementById("m-permanent-state").value = member.permanentState || "";
    document.getElementById("m-permanent-zip").value = member.permanentZip || "";
    
    // Check if permanent address matches current address to toggle checkbox
    const isSame = (member.street === member.permanentStreet &&
                    member.city === member.permanentCity &&
                    member.state === member.permanentState &&
                    member.zip === member.permanentZip &&
                    member.street !== undefined && member.street !== "") ||
                   (member.permanentAddress === member.currentAddress && member.currentAddress !== undefined && member.currentAddress !== "");
                   
    const adminSameAddressCheck = document.getElementById("m-same-address");
    if (adminSameAddressCheck) {
        adminSameAddressCheck.checked = isSame;
        const permSection = document.getElementById("m-permanent-address-section");
        const permInputs = permSection.querySelectorAll("input");
        if (isSame) {
            permInputs.forEach(input => {
                input.required = false;
                input.disabled = true;
            });
            permSection.style.opacity = "0.5";
        } else {
            permInputs.forEach(input => {
                input.required = true;
                input.disabled = false;
            });
            permSection.style.opacity = "1";
        }
    }
    
    // Pre-fill emergency contact & target exam fields
    document.getElementById("m-emergency-name").value = member.emergencyName || "";
    document.getElementById("m-emergency-relation").value = member.emergencyRelation || "Mother";
    document.getElementById("m-emergency-phone").value = member.emergencyPhone || "";
    document.getElementById("m-target-exam").value = member.targetExam || "UPSC";
    
    document.getElementById("m-seat-type").value = state.seats.find(s => s.id === member.seatId)?.type || "non-reserved";
    
    onModalSeatTypeChange();
    
    document.getElementById("m-plan").value = member.planId;
    document.getElementById("m-dob").value = member.dob || "";
    document.getElementById("m-gov-id").value = member.govId || "";
    document.getElementById("m-start-date").value = member.startDate;
    document.getElementById("m-expiry-date").value = member.expiryDate;
    document.getElementById("m-fee-amount").value = member.feeAmount;
    const amountPaid = member.amountPaid !== undefined ? member.amountPaid : (member.paymentStatus === "Paid" ? member.feeAmount : 0);
    const balanceAmount = member.balanceAmount !== undefined ? member.balanceAmount : (member.feeAmount - amountPaid);
    document.getElementById("m-amount-paid").value = amountPaid;
    document.getElementById("m-balance-amount").value = balanceAmount;
    document.getElementById("m-payment").value = member.paymentStatus;
    document.getElementById("m-payment-method").value = member.paymentMethod || "Cash";
    
    // Set amount paid as read-only since it calculates from installments
    document.getElementById("m-amount-paid").readOnly = true;

    // Load installments
    let invoices = member.invoices || [];
    if (invoices.length === 0) {
        // Fallback for old data
        const fallbackPayments = member.payments || [];
        if (fallbackPayments.length === 0 && (amountPaid > 0)) {
            fallbackPayments.push({
                id: "pay_" + (member.timestamp || Date.now()),
                date: member.startDate ? new Date(member.startDate).toISOString() : new Date().toISOString(),
                amount: amountPaid,
                method: member.paymentMethod || "Cash",
                note: "Initial Payment"
            });
        }
        currentModalInstallments = [...fallbackPayments];
    } else {
        // Load payments from active invoice
        const activeInvoice = invoices.find(inv => inv.timestamp === member.timestamp) || invoices[invoices.length - 1];
        currentModalInstallments = activeInvoice && activeInvoice.payments ? [...activeInvoice.payments] : [];
    }
    
    const instSection = document.getElementById("m-installments-section");
    if (instSection) {
        instSection.style.display = "block";
    }
    renderModalInstallments();
    
    onModalSeatVacancyChange(member.seatId);
    
    openModal("modal-member");
}

// Handle seat type toggles in modal
function onModalSeatTypeChange() {
    const seatType = document.getElementById("m-seat-type").value;
    const planSelect = document.getElementById("m-plan");
    const seatGroup = document.getElementById("m-seat-id-group");
    const seatSelect = document.getElementById("m-seat-id");
    
    planSelect.innerHTML = "";
    if (adminModalIsDemo) {
        const opt = document.createElement("option");
        opt.value = `demo-${adminModalDemoDuration}`;
        opt.textContent = `Free Demo Pass (${adminModalDemoDuration} Days)`;
        planSelect.appendChild(opt);
    } else {
        PLANS.filter(p => p.type === seatType).forEach(plan => {
            const opt = document.createElement("option");
            opt.value = plan.id;
            opt.textContent = `${plan.name} - ₹${plan.price}`;
            planSelect.appendChild(opt);
        });
    }
    
    if (seatType === "non-reserved") {
        if (seatGroup) seatGroup.style.display = "none";
        if (seatSelect) {
            seatSelect.removeAttribute("required");
            seatSelect.innerHTML = '<option value="non-reserved" selected>Non-Reserved</option>';
        }
    } else {
        if (seatGroup) seatGroup.style.display = "block";
        if (seatSelect) {
            seatSelect.setAttribute("required", "required");
        }
        onModalSeatVacancyChange();
    }
    
    onModalPlanChange();
}

function onModalPlanChange() {
    if (adminModalIsDemo) {
        document.getElementById("m-fee-amount").value = 0;
        document.getElementById("m-fee-amount").readOnly = true;
        document.getElementById("m-amount-paid").value = 0;
        document.getElementById("m-amount-paid").readOnly = true;
        document.getElementById("m-balance-amount").value = 0;
        
        const payStatusEl = document.getElementById("m-payment");
        const payMethodEl = document.getElementById("m-payment-method");
        if (payStatusEl) {
            payStatusEl.value = "Paid";
            payStatusEl.disabled = true;
        }
        if (payMethodEl) {
            payMethodEl.value = "Free Demo";
            payMethodEl.disabled = true;
        }
    } else {
        document.getElementById("m-fee-amount").readOnly = false;
        document.getElementById("m-amount-paid").readOnly = false;
        const payStatusEl = document.getElementById("m-payment");
        const payMethodEl = document.getElementById("m-payment-method");
        if (payStatusEl) payStatusEl.disabled = false;
        if (payMethodEl) payMethodEl.disabled = false;
        
        const planId = document.getElementById("m-plan").value;
        const plan = PLANS.find(p => p.id === planId);
        if (plan) {
            document.getElementById("m-fee-amount").value = plan.price;
        }
    }
    calculateExpiryDate();
}

// Expiry date calculation
function calculateExpiryDate() {
    const startDateVal = document.getElementById("m-start-date").value;
    const planId = document.getElementById("m-plan").value;
    
    if (!startDateVal || !planId) return;
    
    const startDate = new Date(startDateVal);
    
    if (adminModalIsDemo) {
        const durationDays = parseInt(planId.replace("demo-", "")) || adminModalDemoDuration || 5;
        startDate.setDate(startDate.getDate() + durationDays);
    } else {
        const plan = PLANS.find(p => p.id === planId);
        if (!plan) return;
        startDate.setMonth(startDate.getMonth() + plan.duration);
    }
    
    document.getElementById("m-expiry-date").value = startDate.toISOString().split('T')[0];
}

// Generate vacant seats list grouped by Rooms
function onModalSeatVacancyChange(keepSeatId = null) {
    const seatType = document.getElementById("m-seat-type").value;
    if (seatType === "non-reserved") return;
    const seatSelect = document.getElementById("m-seat-id");
    
    seatSelect.innerHTML = "";
    
    const vacantSeats = state.seats.filter(seat => {
        if (seat.status === "maintenance") return false;
        return seat.status === "vacant" || seat.id === keepSeatId;
    });
    
    if (vacantSeats.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "❌ No Vacant Seats available";
        seatSelect.appendChild(opt);
    } else {
        for (let r = 1; r <= 4; r++) {
            const roomSeats = vacantSeats.filter(s => s.room === r);
            if (roomSeats.length > 0) {
                const group = document.createElement("optgroup");
                group.label = `Room ${r}`;
                
                roomSeats.forEach(seat => {
                    const opt = document.createElement("option");
                    opt.value = seat.id;
                    opt.textContent = `Seat ${seat.number}`;
                    if (seat.id === keepSeatId) {
                        opt.selected = true;
                    }
                    group.appendChild(opt);
                });
                seatSelect.appendChild(group);
            }
        }
    }
}


// Add or update student
async function handleMemberFormSubmit(event) {
    event.preventDefault();
    
    if (!modalPhotoBase64) {
        showToast("Please upload a student profile picture.", "error");
        return;
    }
    
    const editId = document.getElementById("edit-member-id").value;
    const name = document.getElementById("m-name").value.trim();
    const phone = document.getElementById("m-phone").value.trim();
    const gender = document.getElementById("m-gender").value;
    const email = document.getElementById("m-email").value.trim();
    const fatherName = document.getElementById("m-father-name").value.trim();
    const fatherPhone = document.getElementById("m-father-phone").value.trim();
    const motherName = document.getElementById("m-mother-name").value.trim();
    const motherPhone = document.getElementById("m-mother-phone").value.trim();
    
    const street = document.getElementById("m-street").value.trim();
    const city = document.getElementById("m-city").value.trim();
    const stateVal = document.getElementById("m-state").value.trim();
    const zip = document.getElementById("m-zip").value.trim();
    
    const sameAddressCheck = document.getElementById("m-same-address");
    if (sameAddressCheck && sameAddressCheck.checked) {
        document.getElementById("m-permanent-street").value = street;
        document.getElementById("m-permanent-city").value = city;
        document.getElementById("m-permanent-state").value = stateVal;
        document.getElementById("m-permanent-zip").value = zip;
    }
    
    const permanentStreet = document.getElementById("m-permanent-street").value.trim();
    const permanentCity = document.getElementById("m-permanent-city").value.trim();
    const permanentState = document.getElementById("m-permanent-state").value.trim();
    const permanentZip = document.getElementById("m-permanent-zip").value.trim();
    
    const emergencyName = document.getElementById("m-emergency-name").value.trim();
    const emergencyRelation = document.getElementById("m-emergency-relation").value;
    const emergencyPhone = document.getElementById("m-emergency-phone").value.trim();
    const targetExam = document.getElementById("m-target-exam").value;
    const dob = document.getElementById("m-dob").value;
    
    const seatId = document.getElementById("m-seat-id").value;
    const seatType = document.getElementById("m-seat-type").value;
    const planId = document.getElementById("m-plan").value;
    const govId = document.getElementById("m-gov-id").value.trim();
    const startDate = document.getElementById("m-start-date").value;
    const expiryDate = document.getElementById("m-expiry-date").value;
    const feeAmount = parseInt(document.getElementById("m-fee-amount").value) || 0;
    const amountPaid = parseInt(document.getElementById("m-amount-paid").value) || 0;
    const balanceAmount = parseInt(document.getElementById("m-balance-amount").value) || 0;
    const paymentStatus = document.getElementById("m-payment").value;
    const paymentMethod = document.getElementById("m-payment-method").value;
    
    // Strict client-side validations
    if (!name) {
        showToast("Please enter student Name.", "error");
        return;
    }
    if (!/^[0-9]{10}$/.test(phone)) {
        showToast("Please enter a valid 10-digit Student Mobile Number.", "error");
        return;
    }
    if (!gender) {
        showToast("Please select Gender.", "error");
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast("Please enter a valid Email Address.", "error");
        return;
    }
    if (!/^[0-9]{12}$/.test(govId)) {
        showToast("Please enter a valid 12-digit Aadhaar Number.", "error");
        return;
    }
    if (!fatherName) {
        showToast("Please enter Father's Name.", "error");
        return;
    }
    if (!/^[0-9]{10}$/.test(fatherPhone)) {
        showToast("Please enter a valid 10-digit Father's Mobile Number.", "error");
        return;
    }
    if (!motherName) {
        showToast("Please enter Mother's Name.", "error");
        return;
    }
    if (!/^[0-9]{10}$/.test(motherPhone)) {
        showToast("Please enter a valid 10-digit Mother's Mobile Number.", "error");
        return;
    }
    if (!emergencyName) {
        showToast("Please enter Emergency Contact Name.", "error");
        return;
    }
    if (!/^[0-9]{10}$/.test(emergencyPhone)) {
        showToast("Please enter a valid 10-digit Emergency Mobile Number.", "error");
        return;
    }
    if (!street) {
        showToast("Please enter Recent Street Address.", "error");
        return;
    }
    if (!city) {
        showToast("Please enter Recent City / Town.", "error");
        return;
    }
    if (!stateVal) {
        showToast("Please enter Recent State.", "error");
        return;
    }
    if (!/^[0-9]{6}$/.test(zip)) {
        showToast("Please enter a valid 6-digit Recent Zip/Postal Code.", "error");
        return;
    }
    if (!permanentStreet) {
        showToast("Please enter Permanent Street Address.", "error");
        return;
    }
    if (!permanentCity) {
        showToast("Please enter Permanent City / Town.", "error");
        return;
    }
    if (!permanentState) {
        showToast("Please enter Permanent State.", "error");
        return;
    }
    if (!/^[0-9]{6}$/.test(permanentZip)) {
        showToast("Please enter a valid 6-digit Permanent Zip/Postal Code.", "error");
        return;
    }
    if (!dob) {
        showToast("Please select Date of Birth.", "error");
        return;
    }
    
    if (!seatId) {
        showToast("Cannot register: No seat assigned.", "error");
        return;
    }
    
    let duration;
    if (adminModalIsDemo) {
        duration = parseInt(planId.replace("demo-", "")) || adminModalDemoDuration || 5;
    } else {
        const plan = PLANS.find(p => p.id === planId);
        duration = plan ? plan.duration : 1;
    }
    
    let originalMember = null;
    let originalSeatId = null;

    if (editId) {
        originalMember = state.members.find(m => m.id === editId);
        if (originalMember) {
            originalSeatId = originalMember.seatId;
        }
    }
    
    // Concurrency Check: Check if seat is occupied by another student on Firebase
    if (seatId && seatId !== "non-reserved" && seatId !== originalSeatId && database && !isOfflineMode) {
        const seatIdx = state.seats.findIndex(s => s.id === seatId);
        if (seatIdx !== -1) {
            try {
                const snapshot = await database.ref(`study_cafe_system/seats/${seatIdx}`).once("value");
                const val = snapshot.val();
                if (val && val.status === "occupied" && val.assignedMemberId !== editId) {
                    showToast(`Failed to Save: Seat ${val.number} has just been occupied by another student! Please select a different seat.`, "error");
                    return;
                }
            } catch (err) {
                console.warn("Live seat check failed:", err);
            }
        }
    }
    
    const currentAddressConcated = `${street}, ${city}, ${stateVal} - ${zip}`;
    const permanentAddressConcated = `${permanentStreet}, ${permanentCity}, ${permanentState} - ${permanentZip}`;
    
    const memberId = editId || `m_${Date.now()}`;
    const memberObj = {
        id: memberId,
        name: name,
        phone: phone,
        dob: dob,
        gender: gender,
        email: email,
        fatherName: fatherName,
        fatherPhone: fatherPhone,
        motherName: motherName,
        motherPhone: motherPhone,
        street: street,
        city: city,
        state: stateVal,
        zip: zip,
        permanentStreet: permanentStreet,
        permanentCity: permanentCity,
        permanentState: permanentState,
        permanentZip: permanentZip,
        currentAddress: currentAddressConcated,
        permanentAddress: permanentAddressConcated,
        
        emergencyName: emergencyName,
        emergencyRelation: emergencyRelation,
        emergencyPhone: emergencyPhone,
        targetExam: targetExam,
        
        seatId: seatId,
        planId: planId,
        duration: duration,
        govId: govId,
        startDate: startDate,
        expiryDate: expiryDate,
        feeAmount: feeAmount,
        amountPaid: amountPaid,
        balanceAmount: balanceAmount,
        paymentStatus: paymentStatus,
        paymentMethod: paymentMethod,
        photo: modalPhotoBase64,
        status: adminModalIsDemo ? (originalMember && originalMember.status === "demo-expired" ? "demo-expired" : "demo") : (originalMember ? (originalMember.status || "active") : "active"),
        demoDuration: adminModalIsDemo ? duration : 0,
        demoStartDate: adminModalIsDemo ? startDate : null,
        demoEndDate: adminModalIsDemo ? expiryDate : null,
        timestamp: editId ? originalMember.timestamp : Date.now()
    };
    
    // Manage Invoice History and Installments
    if (!editId) {
        // New Registration
        const invoiceId = "inv_" + Date.now();
        const initPayments = [];
        if (amountPaid > 0) {
            initPayments.push({
                id: "pay_" + Date.now(),
                date: new Date().toISOString(),
                amount: amountPaid,
                method: paymentMethod,
                note: "Initial Payment"
            });
        }
        const newInvoice = {
            id: invoiceId,
            timestamp: Date.now(),
            planName: getPlanName(planId),
            planId: planId,
            seatId: seatId,
            startDate: startDate,
            expiryDate: expiryDate,
            feeAmount: feeAmount,
            amountPaid: amountPaid,
            balanceAmount: balanceAmount,
            paymentStatus: paymentStatus,
            paymentMethod: paymentMethod,
            payments: initPayments
        };
        memberObj.invoices = [newInvoice];
        memberObj.payments = [...initPayments];
        memberObj.timestamp = newInvoice.timestamp;
    } else if (originalMember) {
        let invoices = originalMember.invoices || [];
        if (invoices.length === 0) {
            // Build fallback for backward compatibility
            const origPaid = originalMember.amountPaid !== undefined ? originalMember.amountPaid : (originalMember.paymentStatus === "Paid" ? (originalMember.feeAmount || 0) : 0);
            const fallbackPayments = originalMember.payments || [];
            if (fallbackPayments.length === 0 && origPaid > 0) {
                fallbackPayments.push({
                    id: "pay_" + (originalMember.timestamp || Date.now()),
                    date: originalMember.startDate ? new Date(originalMember.startDate).toISOString() : new Date().toISOString(),
                    amount: origPaid,
                    method: originalMember.paymentMethod || "Cash",
                    note: "Initial Payment"
                });
            }
            invoices.push({
                id: "inv_" + (originalMember.timestamp || Date.now()),
                timestamp: originalMember.timestamp || Date.now(),
                planName: getPlanName(originalMember.planId),
                planId: originalMember.planId,
                seatId: originalMember.seatId,
                startDate: originalMember.startDate,
                expiryDate: originalMember.expiryDate,
                feeAmount: originalMember.feeAmount || 0,
                amountPaid: origPaid,
                balanceAmount: originalMember.balanceAmount !== undefined ? originalMember.balanceAmount : ((originalMember.feeAmount || 0) - origPaid),
                paymentStatus: originalMember.paymentStatus,
                paymentMethod: originalMember.paymentMethod || "Cash",
                payments: fallbackPayments
            });
        }

        const isDemoConversion = ((originalMember.status === "demo" || originalMember.status === "demo-expired") && memberObj.status === "active");
        const isRenewal = (originalMember.startDate !== startDate || originalMember.expiryDate !== expiryDate || originalMember.planId !== planId);

        if (isRenewal || isDemoConversion) {
            // New Term billing cycle
            const invoiceId = "inv_" + Date.now();
            const newInvoice = {
                id: invoiceId,
                timestamp: Date.now(),
                planName: getPlanName(planId),
                planId: planId,
                seatId: seatId,
                startDate: startDate,
                expiryDate: expiryDate,
                feeAmount: feeAmount,
                amountPaid: amountPaid,
                balanceAmount: balanceAmount,
                paymentStatus: paymentStatus,
                paymentMethod: paymentMethod,
                payments: currentModalInstallments.length > 0 ? [...currentModalInstallments] : [
                    {
                        id: "pay_" + Date.now(),
                        date: new Date().toISOString(),
                        amount: amountPaid,
                        method: paymentMethod,
                        note: isDemoConversion ? "Demo Converted" : "Renewal Payment"
                    }
                ]
            };
            invoices.push(newInvoice);
            memberObj.invoices = invoices;
            memberObj.payments = [...newInvoice.payments];
            memberObj.timestamp = newInvoice.timestamp;
        } else {
            // Updating active plan details or installments
            let activeInvoice = invoices.find(inv => inv.timestamp === originalMember.timestamp) || invoices[invoices.length - 1];
            if (activeInvoice) {
                activeInvoice.planName = getPlanName(planId);
                activeInvoice.planId = planId;
                activeInvoice.seatId = seatId;
                activeInvoice.startDate = startDate;
                activeInvoice.expiryDate = expiryDate;
                activeInvoice.feeAmount = feeAmount;
                activeInvoice.amountPaid = amountPaid;
                activeInvoice.balanceAmount = balanceAmount;
                activeInvoice.paymentStatus = paymentStatus;
                activeInvoice.paymentMethod = paymentMethod;
                activeInvoice.payments = [...currentModalInstallments];
            }
            memberObj.invoices = invoices;
            memberObj.payments = [...currentModalInstallments];
        }
    }
    
    // Clear old seat status if editing
    if (editId && originalMember && originalSeatId && originalSeatId !== "non-reserved") {
        const oldSeat = state.seats.find(s => s.id === originalSeatId);
        if (oldSeat) {
            oldSeat.status = "vacant";
            oldSeat.assignedMemberId = null;
        }
    }
    
    // Update New Seat status
    let newSeat = null;
    if (seatId && seatId !== "non-reserved") {
        newSeat = state.seats.find(s => s.id === seatId);
        if (newSeat) {
            newSeat.status = "occupied";
            newSeat.type = seatType;
            newSeat.assignedMemberId = memberId;
        }
    }
    
    // Update state members array
    if (editId) {
        const idx = state.members.findIndex(m => m.id === editId);
        if (idx !== -1) state.members[idx] = memberObj;
    } else {
        state.members.push(memberObj);
    }
    
    // Auto-remove any pending requests with the same phone number (no matter how added)
    if (!editId && state.pending && state.pending.length > 0) {
        const cleanPhone = phone.replace(/[^0-9]/g, "");
        const matchingPending = state.pending.find(p => {
            const pPhone = (p.phone || "").toString().replace(/[^0-9]/g, "");
            return pPhone === cleanPhone && cleanPhone.length > 0;
        });
        if (matchingPending) {
            removePendingRequest(matchingPending.id);
        }
    }
    
    // Precise database patch instead of syncLocalToDatabase()
    const affectedSeatIds = [];
    if (originalSeatId && originalSeatId !== "non-reserved") affectedSeatIds.push(originalSeatId);
    if (seatId && seatId !== "non-reserved") affectedSeatIds.push(seatId);
    
    patchFirebaseData(memberId, affectedSeatIds);
    
    closeModal("modal-member");
    showToast(editId ? "Student updated successfully!" : "Student registered successfully!", "success");
    
    // Switch map room visual filter to matches student's room
    if (newSeat) {
        document.getElementById("seat-filter-room").value = newSeat.room;
    }
    
    // Renders receipt automatically upon registration submission
    if (!editId) {
        setTimeout(() => {
            openReceiptModal(memberId);
        }, 400);
    }
    
    refreshUI();
}

// Toggle payment statuses
function togglePaymentStatus(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    member.paymentStatus = member.paymentStatus === "Paid" ? "Pending" : "Paid";
    
    // Also update the active invoice payment status
    if (member.invoices && member.invoices.length > 0) {
        let activeInvoice = member.invoices.find(inv => inv.timestamp === member.timestamp) || member.invoices[member.invoices.length - 1];
        if (activeInvoice) {
            activeInvoice.paymentStatus = member.paymentStatus;
        }
    }
    
    patchFirebaseData(memberId);
    showToast(`Payment marked as ${member.paymentStatus} for ${member.name}`, "info");
    refreshUI();
}

// Quick renewal prompt
function renewMembershipPrompt(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    openEditMemberModal(memberId);
    
    const nextStart = new Date(member.expiryDate);
    nextStart.setDate(nextStart.getDate() + 1);
    document.getElementById("m-start-date").value = nextStart.toISOString().split('T')[0];
    document.getElementById("m-payment").value = "Paid";
    
    calculateExpiryDate();
    showToast(`Reviewing renewal for ${member.name}. Start date set to next term.`, "info");
}

// Send automated WhatsApp expiry reminder in English
function sendExpiryReminder(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const expiry = new Date(member.expiryDate);
    const timeDiff = expiry.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    const seatText = getSeatDisplayName(member.seatId);
    
    const libName = state.settings.libraryName || "Red Room";
    const formattedExpiryDate = new Date(member.expiryDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    
    let daysStatus = "";
    if (daysDiff === 0) {
        daysStatus = "Expires Today";
    } else if (daysDiff === 1) {
        daysStatus = "Expires Tomorrow";
    } else if (daysDiff > 1) {
        daysStatus = `Expires in ${daysDiff} days`;
    } else if (daysDiff === -1) {
        daysStatus = "Expired Yesterday";
    } else {
        daysStatus = `Expired ${Math.abs(daysDiff)} days ago`;
    }
    
    const message = `Hello ${member.name},\n\nThis is an official update from *${libName}*.\n\nYour membership details:\n📌 *Seat:* ${seatText}\n📅 *Expiry Date:* ${formattedExpiryDate} (${daysStatus})\n\nTo ensure uninterrupted study hours and retain your assigned seat, please visit the reception desk to complete your renewal.\n\nThank you,\n*${libName}* Management Team`;
    
    // Clean phone number (strip leading 0, add +91 country code if not present)
    let cleanPhone = member.phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
        cleanPhone = cleanPhone.substring(1);
    }
    if (cleanPhone.length === 10) {
        cleanPhone = "91" + cleanPhone;
    }
    
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
}

// Send automated WhatsApp birthday wishes
function sendBirthdayWish(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    const libName = state.settings.libraryName || "Red Room";
    const targetExamText = member.targetExam ? ` for *${member.targetExam}*` : "";
    
    const message = `Hello ${member.name},\n\nWishing you a very Happy Birthday! 🎂✨\n\nMay this special day bring you joy, happiness, and closer to your dream of cracking your exams${targetExamText}! Keep studying hard and achieving your goals.\n\nHave a fantastic day ahead! 🎉\n\nWarm regards,\n*${libName}* 📚☕`;
    
    let cleanPhone = member.phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
        cleanPhone = cleanPhone.substring(1);
    }
    if (cleanPhone.length === 10) {
        cleanPhone = "91" + cleanPhone;
    }
    
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
}

// Update Fees Tab pending badge count
function updateFeesBadge() {
    const badge = document.getElementById("fees-badge-count");
    if (!badge) return;
    
    const pendingCount = state.members.filter(m => {
        const fee = parseInt(m.feeAmount) || 0;
        const paid = m.amountPaid !== undefined ? (parseInt(m.amountPaid) || 0) : (m.paymentStatus === "Paid" ? fee : 0);
        return (fee - paid) > 0;
    }).length;
    
    if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }
}

// Render Fees Tab contents
function renderFeesTab() {
    const pendingTbody = document.getElementById("fees-pending-tbody");
    const recentList = document.getElementById("fees-recent-list");
    const kpiCollected = document.getElementById("fees-kpi-collected");
    const kpiPending = document.getElementById("fees-kpi-pending");
    const kpiCount = document.getElementById("fees-kpi-count");
    
    if (!pendingTbody || !recentList) return;
    
    pendingTbody.innerHTML = "";
    recentList.innerHTML = "";
    
    // 1. Calculations for KPIs
    let totalCollected = 0;
    let totalPending = 0;
    let pendingStudentsCount = 0;
    
    state.members.forEach(m => {
        const fee = parseInt(m.feeAmount) || 0;
        const paid = m.amountPaid !== undefined ? (parseInt(m.amountPaid) || 0) : (m.paymentStatus === "Paid" ? fee : 0);
        const pending = m.balanceAmount !== undefined ? (parseInt(m.balanceAmount) || 0) : (fee - paid);
        
        totalCollected += paid;
        totalPending += pending;
        
        if (pending > 0) {
            pendingStudentsCount++;
        }
    });
    
    if (kpiCollected) kpiCollected.textContent = `₹${totalCollected.toLocaleString('en-IN')}`;
    if (kpiPending) kpiPending.textContent = `₹${totalPending.toLocaleString('en-IN')}`;
    if (kpiCount) kpiCount.textContent = `${pendingStudentsCount} Student${pendingStudentsCount === 1 ? '' : 's'}`;
    
    // 2. Filter Pending Payments (balanceAmount > 0)
    const pendingStudents = state.members.filter(m => {
        const fee = parseInt(m.feeAmount) || 0;
        const paid = m.amountPaid !== undefined ? (parseInt(m.amountPaid) || 0) : (m.paymentStatus === "Paid" ? fee : 0);
        const pending = m.balanceAmount !== undefined ? (parseInt(m.balanceAmount) || 0) : (fee - paid);
        return pending > 0;
    }).sort((a, b) => b.timestamp - a.timestamp);
        
    if (pendingStudents.length === 0) {
        pendingTbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <i class="fa-solid fa-circle-check" style="color: var(--accent-emerald);"></i>
                    <p>All students have cleared their fees. No pending collections!</p>
                </td>
            </tr>
        `;
    } else {
        const todayZero = new Date();
        todayZero.setHours(0,0,0,0);
        
        pendingStudents.forEach(member => {
            const tr = document.createElement("tr");
            
            const isExpired = new Date(member.expiryDate) < todayZero;
            let expiryFmtText = "";
            if (isExpired) {
                const timeDiff = todayZero.getTime() - new Date(member.expiryDate).getTime();
                const daysExpired = Math.ceil(timeDiff / (1000 * 3600 * 24));
                expiryFmtText = `<div style="font-size: 0.7rem; color: var(--accent-rose); font-weight: 600; margin-top: 2px;"><i class="fa-solid fa-triangle-exclamation"></i> Expired (${daysExpired}d ago)</div>`;
            } else {
                expiryFmtText = `<div style="font-size: 0.7rem; color: var(--accent-emerald); font-weight: 600; margin-top: 2px;">Active</div>`;
            }
            
            const avatarLetter = member.name.charAt(0).toUpperCase();
            const avatarStyle = member.photo ? `background-image: url('${member.photo}'); background-size: cover; background-position: center; color: transparent; border: 1px solid var(--border-color);` : '';
            const avatarContent = member.photo ? '' : avatarLetter;
            const clickableClass = member.photo ? 'clickable-avatar' : '';
            const onclickAttr = member.photo ? `onclick="openLightbox('${member.photo}')"` : '';
            
            const seatText = getSeatDisplayName(member.seatId);
            
            const fee = parseInt(member.feeAmount) || 0;
            const paid = member.amountPaid !== undefined ? (parseInt(member.amountPaid) || 0) : (member.paymentStatus === "Paid" ? fee : 0);
            const pending = member.balanceAmount !== undefined ? (parseInt(member.balanceAmount) || 0) : (fee - paid);
            
            tr.innerHTML = `
                <td>
                    <div class="member-profile">
                        <div class="member-avatar ${clickableClass}" ${onclickAttr} style="${avatarStyle}">${avatarContent}</div>
                        <div>
                            <div class="member-name">${member.name}</div>
                            <div class="member-phone">${member.phone}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <strong style="color: #fff;">${seatText}</strong>
                    ${expiryFmtText}
                </td>
                <td>
                    <div style="font-weight: 700; color: var(--accent-amber); font-size: 1rem;">₹${pending} dues</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">
                        ₹${paid} paid of ₹${fee}
                    </div>
                    <div style="font-size: 0.65rem; color: var(--accent-blue); font-weight: 500; margin-top: 1px;">
                        ${PLANS.find(p => p.id === member.planId)?.name || 'Custom Plan'}
                    </div>
                </td>
                <td>
                    <div class="actions-cell" style="justify-content: center; gap: 8px;">
                        <button class="btn-icon-only btn-secondary" onclick="sendFeeReminder('${member.id}')" title="Send WhatsApp Fee Reminder" style="background: rgba(37, 211, 102, 0.1); color: #25D366; border-color: rgba(37, 211, 102, 0.2);">
                            <i class="fa-brands fa-whatsapp"></i>
                        </button>
                        <button class="btn-icon-only btn-secondary" onclick="markFeeAsPaidQuick('${member.id}')" title="Mark as Paid" style="background: rgba(16, 185, 129, 0.1); color: var(--accent-emerald); border-color: rgba(16, 185, 129, 0.2);">
                            <i class="fa-solid fa-check"></i>
                        </button>
                    </div>
                </td>
            `;
            pendingTbody.appendChild(tr);
        });
    }
    
    // 3. Render recent payments log
    const recentPayments = [...state.members]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 15);
        
    if (recentPayments.length === 0) {
        recentList.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-receipt" style="color: var(--text-dark); opacity: 0.4;"></i>
                <p>No financial activity recorded yet.</p>
            </div>
        `;
    } else {
        recentPayments.forEach(member => {
            const item = document.createElement("div");
            const isPaid = member.paymentStatus === "Paid";
            const isPartial = member.paymentStatus === "Partial";
            
            item.className = "alert-item";
            item.style.borderLeftColor = isPaid ? "var(--accent-emerald)" : (isPartial ? "var(--accent-blue)" : "var(--accent-amber)");
            
            const timeFmt = new Date(member.timestamp).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const fee = parseInt(member.feeAmount) || 0;
            const paid = member.amountPaid !== undefined ? (parseInt(member.amountPaid) || 0) : (member.paymentStatus === "Paid" ? fee : 0);
            const pending = member.balanceAmount !== undefined ? (parseInt(member.balanceAmount) || 0) : (fee - paid);
            
            item.innerHTML = `
                <div class="alert-avatar" style="color: ${isPaid ? 'var(--accent-emerald)' : (isPartial ? 'var(--accent-blue)' : 'var(--accent-amber)')}; background: ${isPaid ? 'rgba(16, 185, 129, 0.08)' : (isPartial ? 'rgba(59, 130, 246, 0.08)' : 'rgba(245, 158, 11, 0.08)')}; font-size: 1rem;">
                    <i class="fa-solid ${isPaid ? 'fa-circle-check' : (isPartial ? 'fa-circle-exclamation' : 'fa-clock')}"></i>
                </div>
                <div class="alert-details">
                    <div class="alert-name" style="font-weight: 600; color: #fff;">${member.name}</div>
                    <div class="alert-info" style="font-size: 0.75rem;">
                        ₹${paid} paid (₹${pending} dues) • ${PLANS.find(p => p.id === member.planId)?.name || 'Custom Plan'} (${member.paymentMethod || 'Cash'})
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.75rem; font-weight: 700; color: ${isPaid ? 'var(--accent-emerald)' : (isPartial ? 'var(--accent-blue)' : 'var(--accent-amber)')};">
                        ${member.paymentStatus}
                    </div>
                    <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">${timeFmt}</div>
                </div>
            `;
            recentList.appendChild(item);
        });
    }
    
    // 4. Render charts
    renderFeesCharts();
}

// Send WhatsApp pending fee reminder (Option 1 style: Professional & Polite)
function sendFeeReminder(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    const libName = state.settings.libraryName || "Red Room";
    const planName = PLANS.find(p => p.id === member.planId)?.name || "Library Membership";
    
    const fee = parseInt(member.feeAmount) || 0;
    const paid = member.amountPaid !== undefined ? (parseInt(member.amountPaid) || 0) : (member.paymentStatus === "Paid" ? fee : 0);
    const pending = member.balanceAmount !== undefined ? (parseInt(member.balanceAmount) || 0) : (fee - paid);
    
    const message = `Hello ${member.name},\n\nThis is a friendly fee status update from *${libName}*.\n\n💵 *Pending Amount:* ₹${pending}\n📦 *Plan Duration:* ${planName}\n\nKindly clear the pending dues at the desk at your earliest convenience to update your database record. If you have already paid, please share the receipt screenshot.\n\nThank you,\n*${libName}*`;
    
    let cleanPhone = member.phone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
        cleanPhone = cleanPhone.substring(1);
    }
    if (cleanPhone.length === 10) {
        cleanPhone = "91" + cleanPhone;
    }
    
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
}

// Quick Mark as Paid action
function markFeeAsPaidQuick(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    const fee = parseInt(member.feeAmount) || 0;
    const paidSoFar = member.amountPaid !== undefined ? (parseInt(member.amountPaid) || 0) : (member.paymentStatus === "Paid" ? fee : 0);
    const currentDues = member.balanceAmount !== undefined ? (parseInt(member.balanceAmount) || 0) : (fee - paidSoFar);
    
    const amountStr = prompt(`Collect payment for ${member.name}.\nDues Remaining: ₹${currentDues}\nEnter amount to collect:`, currentDues);
    if (amountStr === null) return; // Cancelled
    
    const collectAmount = parseInt(amountStr);
    if (isNaN(collectAmount) || collectAmount <= 0) {
        showToast("Invalid payment amount entered.", "error");
        return;
    }
    
    if (collectAmount > currentDues) {
        showToast(`Cannot collect more than outstanding dues (₹${currentDues}).`, "error");
        return;
    }
    
    const paymentMethod = prompt(`Enter payment method (Type "Cash" or "UPI" / "Online"):`, "Cash");
    if (paymentMethod === null) return; // Cancelled
    
    const cleanMethod = paymentMethod.trim().toLowerCase().includes("cash") ? "Cash" : "Online";
    
    // Update payment details
    const newPaidAmount = paidSoFar + collectAmount;
    member.amountPaid = newPaidAmount;
    member.balanceAmount = fee - newPaidAmount;
    member.paymentStatus = member.balanceAmount === 0 ? "Paid" : "Partial";
    member.paymentMethod = cleanMethod;
    member.timestamp = Date.now(); // update timestamp for recent sorting
    
    // Ensure invoice history is initialized
    let invoices = member.invoices || [];
    if (invoices.length === 0) {
        const origPaid = paidSoFar;
        const fallbackPayments = member.payments || [];
        if (fallbackPayments.length === 0 && origPaid > 0) {
            fallbackPayments.push({
                id: "pay_" + (member.timestamp || Date.now()),
                date: member.startDate ? new Date(member.startDate).toISOString() : new Date().toISOString(),
                amount: origPaid,
                method: member.paymentMethod || "Cash",
                note: "Initial Payment"
            });
        }
        invoices.push({
            id: "inv_" + (member.timestamp || Date.now()),
            timestamp: member.timestamp || Date.now(),
            planName: getPlanName(member.planId),
            planId: member.planId,
            seatId: member.seatId,
            startDate: member.startDate,
            expiryDate: member.expiryDate,
            feeAmount: member.feeAmount || 0,
            amountPaid: origPaid,
            balanceAmount: member.balanceAmount !== undefined ? member.balanceAmount : ((member.feeAmount || 0) - origPaid),
            paymentStatus: member.paymentStatus,
            paymentMethod: member.paymentMethod || "Cash",
            payments: fallbackPayments
        });
    }

    const newPaymentEntry = {
        id: "pay_" + Date.now(),
        date: new Date().toISOString(),
        amount: collectAmount,
        method: cleanMethod,
        note: "Quick Paid"
    };

    member.payments = member.payments || [];
    member.payments.push(newPaymentEntry);

    let activeInvoice = invoices.find(inv => inv.timestamp === member.timestamp) || invoices[invoices.length - 1];
    if (activeInvoice) {
        activeInvoice.amountPaid = newPaidAmount;
        activeInvoice.balanceAmount = fee - newPaidAmount;
        activeInvoice.paymentStatus = member.paymentStatus;
        activeInvoice.paymentMethod = cleanMethod;
        activeInvoice.payments = activeInvoice.payments || [];
        activeInvoice.payments.push(newPaymentEntry);
    }
    member.invoices = invoices;
    
    patchFirebaseData(member.id);
    showToast(`Collected ₹${collectAmount} via ${cleanMethod} for ${member.name}! Status: ${member.paymentStatus}`, "success");
    refreshUI();
    
    // Automatically open receipt
    openReceiptModal(member.id);
}

// Delete member
function deleteMember(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    if (confirm(`Are you sure you want to cancel subscription and remove ${member.name}?`)) {
        const seat = state.seats.find(s => s.id === member.seatId);
        if (seat) {
            seat.status = "vacant";
            seat.assignedMemberId = null;
        }
        
        state.members = state.members.filter(m => m.id !== memberId);
        patchFirebaseData(memberId, seat ? [seat.id] : []);
        showToast("Student membership removed.", "error");
        refreshUI();
    }
}

function approvePendingRequest(requestId) {
    const req = state.pending.find(p => p.id === requestId);
    if (!req) return;
    
    const proceedWithApproval = () => {
        console.log("Approving request data:", req);
        openAddMemberModal();
        
        // Set demo flags after openAddMemberModal resets them
        adminModalIsDemo = (req.bookingType === "demo");
        adminModalDemoDuration = req.demoDuration || 5;
        
        // Set title accordingly
        document.getElementById("modal-member-title").textContent = adminModalIsDemo ? "Approve Free Demo Pass" : "Add New Member";
        
        // Pre-fill photo from request
        if (req.photo) {
            modalPhotoBase64 = req.photo;
            const previewImg = document.getElementById("m-photo-preview");
            const placeholder = document.getElementById("m-photo-placeholder");
            if (placeholder) placeholder.style.display = "none";
            if (previewImg) {
                previewImg.src = modalPhotoBase64;
                previewImg.style.display = "block";
            }
        }
        
        document.getElementById("m-name").value = req.name;
        document.getElementById("m-phone").value = req.phone;
        document.getElementById("m-gender").value = req.gender || "";
        document.getElementById("m-email").value = req.email || "";
        document.getElementById("m-father-name").value = req.fatherName || "";
        document.getElementById("m-father-phone").value = req.fatherPhone || "";
        document.getElementById("m-mother-name").value = req.motherName || "";
        document.getElementById("m-mother-phone").value = req.motherPhone || "";
        
        document.getElementById("m-street").value = req.street || req.currentAddress || "";
        document.getElementById("m-city").value = req.city || "";
        document.getElementById("m-state").value = req.state || "";
        document.getElementById("m-zip").value = req.zip || "";
        
        document.getElementById("m-permanent-street").value = req.permanentStreet || req.permanentAddress || req.currentAddress || "";
        document.getElementById("m-permanent-city").value = req.permanentCity || "";
        document.getElementById("m-permanent-state").value = req.permanentState || "";
        document.getElementById("m-permanent-zip").value = req.permanentZip || "";
        
        // Set same address checkbox check status
        const isSame = (req.street === req.permanentStreet && 
                        req.city === req.permanentCity && 
                        req.state === req.permanentState && 
                        req.zip === req.permanentZip && 
                        req.street !== undefined && req.street !== "") ||
                       (req.permanentAddress === req.currentAddress && req.currentAddress !== undefined && req.currentAddress !== "");
                       
        const adminSameAddressCheck = document.getElementById("m-same-address");
        if (adminSameAddressCheck) {
            adminSameAddressCheck.checked = isSame;
            const permSection = document.getElementById("m-permanent-address-section");
            const permInputs = permSection.querySelectorAll("input");
            if (isSame) {
                permInputs.forEach(input => {
                    input.required = false;
                    input.disabled = true;
                });
                permSection.style.opacity = "0.5";
            } else {
                permInputs.forEach(input => {
                    input.required = true;
                    input.disabled = false;
                });
                permSection.style.opacity = "1";
            }
        }
        
        // Pre-fill new emergency contact & target exam fields
        document.getElementById("m-emergency-name").value = req.emergencyName || "";
        document.getElementById("m-emergency-relation").value = req.emergencyRelation || "Mother";
        document.getElementById("m-emergency-phone").value = req.emergencyPhone || "";
        document.getElementById("m-target-exam").value = req.targetExam || "UPSC";
        document.getElementById("m-start-date").value = req.expectedStartDate || new Date().toISOString().split('T')[0];
        document.getElementById("m-dob").value = req.dob || "";
        
        document.getElementById("m-seat-type").value = req.seatType;
        onModalSeatTypeChange();
        
        if (adminModalIsDemo) {
            document.getElementById("m-plan").value = `demo-${adminModalDemoDuration}`;
        } else {
            const matchingPlan = PLANS.find(p => p.type === req.seatType && p.duration === req.duration);
            if (matchingPlan) {
                document.getElementById("m-plan").value = matchingPlan.id;
            }
        }
        
        document.getElementById("m-gov-id").value = req.govId || "";
        
        // Trigger plan details updates and locks
        onModalPlanChange();
        
        if (!adminModalIsDemo) {
            document.getElementById("m-fee-amount").value = req.feeAmount;
            const amountPaid = req.amountPaid !== undefined ? req.amountPaid : req.feeAmount;
            const balanceAmount = req.balanceAmount !== undefined ? req.balanceAmount : 0;
            document.getElementById("m-amount-paid").value = amountPaid;
            document.getElementById("m-balance-amount").value = balanceAmount;
            document.getElementById("m-payment").value = req.paymentStatus || "Paid";
            document.getElementById("m-payment-method").value = req.paymentMethod || "Cash";
        }
        
        // Pre-select the student's chosen seat if still vacant
        if (req.seatId === "non-reserved") {
            // Non-reserved skips seat assigning
        } else {
            const requestedSeat = state.seats.find(s => s.id === req.seatId);
            if (requestedSeat && requestedSeat.status === "vacant") {
                onModalSeatVacancyChange();
                document.getElementById("m-seat-id").value = requestedSeat.id;
            } else {
                onModalSeatVacancyChange();
                if (requestedSeat && requestedSeat.status !== "vacant") {
                    showToast(`Requested Seat ${requestedSeat.number} is already occupied or blocked! Please assign another seat.`, "error");
                }
            }
        }
        
        calculateExpiryDate();
        
        document.getElementById("form-member").onsubmit = (e) => {
            handleMemberFormSubmit(e);
            removePendingRequest(requestId);
            document.getElementById("form-member").onsubmit = handleMemberFormSubmit;
        };
    };

    if (req.seatId && req.seatId !== "non-reserved" && database && !isOfflineMode) {
        const seatIdx = state.seats.findIndex(s => s.id === req.seatId);
        if (seatIdx !== -1) {
            database.ref(`study_cafe_system/seats/${seatIdx}`).once("value")
                .then(snapshot => {
                    const val = snapshot.val();
                    if (val && val.status === "occupied") {
                        showToast(`Seat ${val.number} is already occupied in the database. Please select another seat for this student.`, "error");
                        req.seatId = ""; // Clear seat ID so the modal opens with vacant choice
                        proceedWithApproval();
                    } else {
                        proceedWithApproval();
                    }
                })
                .catch(err => {
                    console.warn("Firebase concurrency seat check failed, proceeding:", err);
                    proceedWithApproval();
                });
        } else {
            proceedWithApproval();
        }
    } else {
        proceedWithApproval();
    }
}

function rejectPendingRequest(requestId) {
    if (confirm("Are you sure you want to reject this booking request?")) {
        removePendingRequest(requestId);
        showToast("Request rejected.", "error");
    }
}

function removePendingRequest(requestId) {
    recentlyApprovedOrRejected.add(requestId);
    state.pending = state.pending.filter(p => p.id !== requestId);
    saveStateToLocalStorage();
    updatePendingBadge();
    renderPendingRequests();
    
    if (!isOfflineMode && database) {
        database.ref("pending_bookings").child(requestId).remove()
            .catch(err => {
                console.warn("Failed to remove pending booking from Firebase:", err);
            });
    }
}

// Seat Actions Modal
let selectedSeatIdForActions = null;

function openSeatActionsModal(seatId) {
    selectedSeatIdForActions = seatId;
    const seat = state.seats.find(s => s.id === seatId);
    if (!seat) return;
    
    const modalBody = document.getElementById("seat-modal-body");
    const mBtnActions = document.getElementById("btn-seat-primary-action");
    const mBtnMaintenance = document.getElementById("btn-seat-maintenance");
    
    const isMaintenance = seat.status === "maintenance";
    
    mBtnMaintenance.style.display = "block";
    mBtnMaintenance.textContent = isMaintenance ? "Restore Seat" : "Maintenance Block";
    mBtnActions.style.display = "block";
    
    if (isMaintenance) {
        mBtnActions.style.display = "none";
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 1rem 0;">
                <i class="fa-solid fa-tools" style="font-size: 2.5rem; color: var(--text-dark); margin-bottom: 1rem;"></i>
                <h4 style="color: #fff;">Seat ${seat.number} under Maintenance</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">
                    This seat is temporarily out of service. Click Restore below to release the block.
                </p>
            </div>
        `;
    } else {
        let activeOccupantId = seat.assignedMemberId;
        
        if (activeOccupantId) {
            const member = state.members.find(m => m.id === activeOccupantId);
            if (member) {
                const expiry = new Date(member.expiryDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
                const isExpired = new Date(member.expiryDate) < new Date().setHours(0,0,0,0);
                
                const seatAvatarLetter = member.name.charAt(0).toUpperCase();
                const seatAvatarStyle = member.photo ? `background-image: url('${member.photo}'); background-size: cover; background-position: center; color: transparent; border: 1px solid var(--border-color);` : 'background: rgba(255,255,255,0.05); color: var(--accent-blue);';
                const seatAvatarContent = member.photo ? '' : seatAvatarLetter;
                const clickableClass = member.photo ? 'clickable-avatar' : '';
                const onclickAttr = member.photo ? `onclick="openLightbox('${member.photo}')"` : '';
                
                modalBody.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom:1px solid var(--border-color); padding-bottom:0.6rem;">
                            <strong style="font-size: 1.1rem; color: #fff;">Seat ${seat.number} (Room ${seat.room})</strong>
                            <span class="badge ${seat.type === 'reserved' ? 'reserved' : 'general'}">${seat.type === 'reserved' ? 'Reserved' : 'Non-Reserved'}</span>
                        </div>
                        <div style="display: flex; gap: 1rem; align-items: center; justify-content: space-between;">
                            <div style="display: flex; gap: 0.75rem; align-items: center;">
                                <div class="member-avatar ${clickableClass}" ${onclickAttr} style="width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.2rem; flex-shrink: 0; ${seatAvatarStyle}">${seatAvatarContent}</div>
                                <div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Occupant:</div>
                                    <strong style="font-size: 1.15rem; color:#fff; display:block; margin-top:0.15rem;">${member.name} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">(${member.gender || 'N/A'})</span></strong>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">${member.phone}</span>
                                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top:0.1rem;">${member.email || 'N/A'}</div>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.75rem; color: var(--text-muted);">Target Exam:</div>
                                <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 600; font-size: 0.8rem; padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-block; margin-top: 0.25rem;">
                                    ${member.targetExam || 'N/A'}
                                </span>
                            </div>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:0.6rem; border-radius: 8px;">
                            <div>
                                <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">Father's Name</span>
                                <strong style="color: #fff; font-size:0.85rem;">${member.fatherName || 'N/A'}</strong>
                            </div>
                            <div>
                                <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">Father's Mobile</span>
                                <strong style="color: #fff; font-size:0.85rem;">${member.fatherPhone || 'N/A'}</strong>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:0.6rem; border-radius: 8px;">
                            <div>
                                <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">Mother's Name</span>
                                <strong style="color: #fff; font-size:0.85rem;">${member.motherName || 'N/A'}</strong>
                            </div>
                            <div>
                                <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">Mother's Mobile</span>
                                <strong style="color: #fff; font-size:0.85rem;">${member.motherPhone || 'N/A'}</strong>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:0.6rem; border-radius: 8px;">
                            <div>
                                <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">Emergency Contact</span>
                                <strong style="color: #fff; font-size:0.85rem;">${member.emergencyName || 'N/A'} (${member.emergencyRelation || 'N/A'})</strong>
                            </div>
                            <div>
                                <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">Emergency Mobile</span>
                                <strong style="color: #fff; font-size:0.85rem;">${member.emergencyPhone || 'N/A'}</strong>
                            </div>
                        </div>

                        <div style="background: rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:0.6rem; border-radius: 8px; font-size: 0.8rem;">
                            <div style="margin-bottom: 0.3rem;"><span style="color: var(--text-muted);">Current Address:</span> <strong style="color:#fff;">${member.currentAddress || 'N/A'}</strong></div>
                            <div><span style="color: var(--text-muted);">Permanent Address:</span> <strong style="color:#fff;">${member.permanentAddress || 'N/A'}</strong></div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:0.6rem; border-radius: 8px;">
                            <div>
                                <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">Date of Birth</span>
                                <strong style="color: #fff; font-size:0.85rem;">${member.dob ? new Date(member.dob).toLocaleDateString('en-IN') : 'N/A'}</strong>
                            </div>
                            <div>
                                <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">Aadhaar Number</span>
                                <strong style="color: #fff; font-size:0.85rem; font-family: monospace;">${member.govId || 'N/A'}</strong>
                            </div>
                        </div>

                        <div style="background: rgba(255,255,255,0.02); border:1px solid var(--border-color); padding:0.6rem; border-radius: 8px;">
                            <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">Payment Info</span>
                            <span class="badge ${member.paymentStatus === 'Paid' ? 'paid' : 'pending'}" style="margin-top:1px;">${member.paymentStatus} (${member.paymentMethod || 'Cash'})</span>
                        </div>

                        <div>
                            <span style="font-size: 0.75rem; color: var(--text-muted); display:block; margin-bottom: 0.15rem;">Validity:</span>
                            <strong style="color: ${isExpired ? 'var(--accent-rose)' : 'var(--accent-emerald)'}; font-size:0.9rem;">
                                ${expiry} ${isExpired ? '(Expired)' : '(Active)'}
                            </strong>
                        </div>

                        <div style="margin-top: 0.8rem; display: flex; gap: 0.5rem; justify-content: stretch;">
                            <button class="btn btn-secondary" style="flex: 1; padding: 0.55rem; font-size: 0.8rem; justify-content: center; gap: 0.35rem;" onclick="closeModal('modal-seat-actions'); openReceiptModal('${member.id}')">
                                <i class="fa-solid fa-file-invoice" style="color: var(--accent-emerald);"></i> Receipt
                            </button>
                            <button class="btn btn-secondary" style="flex: 1; padding: 0.55rem; font-size: 0.8rem; justify-content: center; gap: 0.35rem; background: #25D366; color: #fff; border: none; box-shadow: 0 4px 12px rgba(37, 211, 102, 0.2);" onclick="shareReceiptDirectlyFromModal('${member.id}')">
                                <i class="fa-brands fa-whatsapp"></i> WhatsApp Share
                            </button>
                        </div>
                    </div>
                `;
                
                mBtnActions.textContent = "Release Seat (Vacate)";
                mBtnActions.className = "btn btn-danger";
                mBtnActions.onclick = () => releaseSeatFromModal(member.id);
            } else {
                modalBody.innerHTML = `<p>Occupant record missing. Sync issue occurred.</p>`;
                mBtnActions.textContent = "Force Vacate";
                mBtnActions.onclick = () => forceResetSeat(seat.id);
            }
        } else {
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 1rem 0;">
                    <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; color: var(--accent-emerald); margin-bottom: 1rem;"></i>
                    <h4 style="color:#fff;">Seat ${seat.number} (Room ${seat.room}) is Vacant</h4>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">
                        This seat is available for booking.
                    </p>
                    <div style="margin-top: 1rem; padding: 0.5rem; background:rgba(255,255,255,0.02); border-radius:6px; display:inline-block; font-size:0.8rem; color: var(--text-muted);">
                        Available for: Non-Reserved (₹700) or Reserved (₹1000)
                    </div>
                </div>
            `;
            
            mBtnActions.textContent = "Assign Member";
            mBtnActions.className = "btn btn-primary";
            mBtnActions.onclick = () => {
                closeModal("modal-seat-actions");
                openAddMemberModal();
                document.getElementById("m-seat-type").value = "reserved";
                onModalSeatTypeChange();
                onModalSeatVacancyChange(seat.id);
                document.getElementById("m-seat-id").value = seat.id;
            };
        }
    }
    
    openModal("modal-seat-actions");
}

function releaseSeatFromModal(memberId) {
    if (confirm("Are you sure you want to release this seat? The student's subscription will be archived.")) {
        closeModal("modal-seat-actions");
        deleteMember(memberId);
    }
}

function forceResetSeat(seatId) {
    const seat = state.seats.find(s => s.id === seatId);
    if (!seat) return;
    
    seat.status = "vacant";
    seat.assignedMemberId = null;
    
    patchFirebaseData(null, [seat.id]);
    closeModal("modal-seat-actions");
    showToast(`Seat ${seat.number} force vacated.`, "info");
    refreshUI();
}

function toggleSeatMaintenance() {
    const seat = state.seats.find(s => s.id === selectedSeatIdForActions);
    if (!seat) return;
    
    const isCurrentlyBlocked = seat.status === "maintenance";
    let activeOccupantId = null;
    
    if (isCurrentlyBlocked) {
        seat.status = "vacant";
        seat.assignedMemberId = null;
        showToast(`Seat ${seat.number} is restored back to service.`, "success");
    } else {
        activeOccupantId = seat.assignedMemberId;
        if (activeOccupantId) {
            if (!confirm(`Warning: Seat ${seat.number} has active student booking. Blocking it will vacate occupant. Proceed?`)) {
                return;
            }
            state.members = state.members.filter(m => m.id !== activeOccupantId);
        }
        
        seat.status = "maintenance";
        seat.assignedMemberId = null;
        showToast(`Seat ${seat.number} marked under Maintenance.`, "error");
    }
    
    patchFirebaseData(activeOccupantId, [seat.id]);
    closeModal("modal-seat-actions");
    refreshUI();
}

// Generate receipt invoice
// Render receipt details helper
function renderInvoiceReceiptDetails(member, invoiceObj) {
    const modalBody = document.getElementById("receipt-modal-body");
    if (!modalBody) return;

    const seat = state.seats.find(s => s.id === invoiceObj.seatId);
    let roomDisplay = "";
    let seatDisplay = "";
    
    if (invoiceObj.seatId === "non-reserved") {
        roomDisplay = "N/A";
        seatDisplay = "Non-Reserved";
    } else {
        const seatInfo = getSeatRoomAndNumber(invoiceObj.seatId);
        const isReserved = seat ? seat.type === "reserved" : false;
        roomDisplay = `Room ${seatInfo.room}`;
        seatDisplay = `Seat ${seatInfo.number} (${isReserved ? 'Reserved' : 'Non-Reserved'})`;
    }
    
    const startDateFmt = new Date(invoiceObj.startDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
    const expiryDateFmt = new Date(invoiceObj.expiryDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
    
    const receiptNo = `TSC-${invoiceObj.timestamp.toString().slice(-6)}`;
    
    const fee = parseInt(invoiceObj.feeAmount) || 0;
    const paid = parseInt(invoiceObj.amountPaid) || 0;
    const pending = parseInt(invoiceObj.balanceAmount) || 0;

    // Render installments log list if any exist for this invoice
    let installmentsHTML = "";
    if (invoiceObj.payments && invoiceObj.payments.length > 0) {
        installmentsHTML = `
            <div style="border-top: 1px dashed #cbd5e1; border-bottom: 1px dashed #cbd5e1; padding: 0.5rem 0; margin: 0.5rem 0; font-size: 0.75rem;">
                <div style="font-weight: bold; margin-bottom: 0.3rem; text-align: center; text-transform: uppercase;">Installment Logs (भुगतान विवरण)</div>
                <table style="width: 100%; text-align: left; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid #e2e8f0; color: #64748b;">
                            <th style="padding: 0.2rem 0;">Date</th>
                            <th style="padding: 0.2rem 0;">Amount</th>
                            <th style="padding: 0.2rem 0;">Method</th>
                            <th style="padding: 0.2rem 0;">Note</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        invoiceObj.payments.forEach(p => {
            const pDate = new Date(p.date).toLocaleDateString('en-IN', {day:'2-digit', month:'2-digit', year:'numeric'});
            installmentsHTML += `
                <tr style="color: #334155;">
                    <td style="padding: 0.15rem 0;">${pDate}</td>
                    <td style="padding: 0.15rem 0;">₹${p.amount}</td>
                    <td style="padding: 0.15rem 0;">${escapeHTML(p.method)}</td>
                    <td style="padding: 0.15rem 0; max-width: 95px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(p.note || '')}</td>
                </tr>
            `;
        });
        installmentsHTML += `
                    </tbody>
                </table>
            </div>
        `;
    }

    modalBody.innerHTML = `
        <div style="font-family: monospace; font-size: 0.85rem; line-height: 1.5; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 0.8rem; border-bottom: 1px dashed #cbd5e1; padding-bottom:0.5rem;">
                <h3 style="font-size: 1.3rem; font-weight: 800; color: #0f172a; margin: 0; letter-spacing:-0.03em;">${escapeHTML(state.settings.libraryName).toUpperCase()}</h3>
                <p style="font-size: 0.7rem; color: #64748b; margin-top: 0.15rem; font-family: sans-serif;">${escapeHTML(state.settings.address)} • Mob: ${escapeHTML(state.settings.phone)}</p>
            </div>
            
            <div style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.5rem; margin-bottom: 0.5rem; font-size: 0.8rem;">
                <div style="display:flex; justify-content:space-between;"><span><strong>Receipt No:</strong> ${escapeHTML(receiptNo)}</span><span><strong>Date:</strong> ${new Date(invoiceObj.timestamp).toLocaleDateString('en-IN')}</span></div>
            </div>
            
            <div style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.5rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                <div><strong>Student:</strong> ${escapeHTML(member.name)} (${escapeHTML(member.gender || 'N/A')})</div>
                <div><strong>Date of Birth:</strong> ${member.dob ? new Date(member.dob).toLocaleDateString('en-IN') : 'N/A'}</div>
                <div><strong>Aadhaar Number:</strong> ${escapeHTML(member.govId || 'N/A')}</div>
                <div><strong>Phone:</strong> ${escapeHTML(member.phone)}</div>
                <div><strong>Email:</strong> ${escapeHTML(member.email || 'N/A')}</div>
                <div><strong>Target Exam:</strong> ${escapeHTML(member.targetExam || 'N/A')}</div>
                <div><strong>Father's Name:</strong> ${escapeHTML(member.fatherName || 'N/A')}</div>
                <div><strong>Father's Mobile:</strong> ${escapeHTML(member.fatherPhone || 'N/A')}</div>
                <div><strong>Mother's Name:</strong> ${escapeHTML(member.motherName || 'N/A')}</div>
                <div><strong>Mother's Mobile:</strong> ${escapeHTML(member.motherPhone || 'N/A')}</div>
                <div><strong>Emergency Contact:</strong> ${escapeHTML(member.emergencyName || 'N/A')} (${escapeHTML(member.emergencyRelation || 'N/A')})</div>
                <div><strong>Emergency Phone:</strong> ${escapeHTML(member.emergencyPhone || 'N/A')}</div>
            </div>
            
            <div style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.5rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                <div><strong>Room No:</strong> ${escapeHTML(roomDisplay)}</div>
                <div><strong>Seat Number:</strong> ${escapeHTML(seatDisplay)}</div>
                <div><strong>Validity:</strong> ${startDateFmt} to ${expiryDateFmt}</div>
            </div>
            
            <div style="margin-bottom: 0.25rem; display: flex; justify-content: space-between; font-size: 0.8rem; color: #0f172a;">
                <span>Total Plan Fee:</span>
                <span>₹${fee}</span>
            </div>
            
            <div style="margin-bottom: 0.25rem; display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: bold; color: #0f172a;">
                <span>Amount Paid:</span>
                <span>₹${paid}</span>
            </div>
            
            <div style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; font-size: 0.8rem; color: #b91c1c; font-weight: 500;">
                <span>Remaining Dues:</span>
                <span>₹${pending}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                <span>Payment Mode:</span>
                <span><strong>${escapeHTML(invoiceObj.paymentMethod || 'Cash')}</strong></span>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.5rem;">
                <span>Payment Status:</span>
                <span style="color: ${invoiceObj.paymentStatus === 'Paid' ? '#10b981' : '#f59e0b'}; font-weight: bold;">${escapeHTML(invoiceObj.paymentStatus)}</span>
            </div>

            ${installmentsHTML}
    
            <div style="text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 0.5rem; margin-top: 0.5rem; color: #64748b; font-size: 0.72rem; font-family: sans-serif; line-height: 1.3;">
                Thank you for studying with us!<br>
                For support, contact us at: ${escapeHTML(state.settings.phone)}
            </div>
        </div>
    `;
}

// Load selected invoice from history dropdown
function loadSelectedInvoiceReceipt(invoiceId) {
    const member = state.members.find(m => m.id === currentReceiptMemberId);
    if (!member) return;

    const invoices = member.invoices || [];
    const invoiceObj = invoices.find(inv => inv.id === invoiceId);
    if (invoiceObj) {
        renderInvoiceReceiptDetails(member, invoiceObj);
    }
}

function openReceiptModal(memberId) {
    currentReceiptMemberId = memberId;
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    let invoices = member.invoices || [];
    if (invoices.length === 0) {
        const origPaid = member.amountPaid !== undefined ? member.amountPaid : (member.paymentStatus === "Paid" ? member.feeAmount : 0);
        const fallbackPayments = member.payments || [];
        if (fallbackPayments.length === 0 && origPaid > 0) {
            fallbackPayments.push({
                id: "pay_" + (member.timestamp || Date.now()),
                date: member.startDate ? new Date(member.startDate).toISOString() : new Date().toISOString(),
                amount: origPaid,
                method: member.paymentMethod || "Cash",
                note: "Initial Payment"
            });
        }
        invoices = [{
            id: "inv_" + (member.timestamp || Date.now()),
            timestamp: member.timestamp || Date.now(),
            planName: getPlanName(member.planId),
            planId: member.planId,
            seatId: member.seatId,
            startDate: member.startDate,
            expiryDate: member.expiryDate,
            feeAmount: member.feeAmount || 0,
            amountPaid: origPaid,
            balanceAmount: member.balanceAmount !== undefined ? member.balanceAmount : ((member.feeAmount || 0) - origPaid),
            paymentStatus: member.paymentStatus,
            paymentMethod: member.paymentMethod || "Cash",
            payments: fallbackPayments
        }];
        member.invoices = invoices;
    }
    
    // Populate select dropdown
    const selectorSelect = document.getElementById("receipt-invoice-selector");
    const selectorContainer = document.getElementById("receipt-invoice-selector-container");
    if (selectorSelect && selectorContainer) {
        if (invoices.length > 1) {
            selectorContainer.style.display = "flex";
            selectorSelect.innerHTML = "";
            invoices.forEach(inv => {
                const opt = document.createElement("option");
                opt.value = inv.id;
                const dateStr = new Date(inv.timestamp).toLocaleDateString('en-IN');
                opt.textContent = `${inv.planName} - ${dateStr} (${inv.paymentStatus})`;
                if (inv.timestamp === member.timestamp) {
                    opt.selected = true;
                }
                selectorSelect.appendChild(opt);
            });
        } else {
            selectorContainer.style.display = "none";
        }
    }

    const activeInvoice = invoices.find(inv => inv.timestamp === member.timestamp) || invoices[invoices.length - 1];
    renderInvoiceReceiptDetails(member, activeInvoice);
    
    openModal("modal-receipt");
}

// Download receipt as PDF
function downloadReceiptPDF() {
    const member = state.members.find(m => m.id === currentReceiptMemberId);
    if (!member) {
        showToast("Error: No student selected for downloading receipt.", "error");
        return;
    }
    
    const receiptElement = document.getElementById("receipt-modal-body");
    const safeName = member.name.trim().replace(/[^a-zA-Z0-9]/g, '_');
    
    const opt = {
        margin:       [10, 10, 10, 10],
        filename:     `Receipt_${safeName}_TSC.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, logging: false, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a5', orientation: 'portrait' }
    };
    
    showToast("Generating PDF Receipt...", "info");
    
    html2pdf().from(receiptElement).set(opt).save()
        .then(() => {
            showToast("Receipt PDF downloaded successfully!", "success");
        })
        .catch(err => {
            console.error("PDF download error:", err);
            showToast("Failed to generate PDF.", "error");
        });
}

// Print receipt action
function printReceipt() {
    const receiptContent = document.getElementById("receipt-modal-body").innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Membership Receipt - Red Room</title>
            <style>
                body {
                    padding: 2rem;
                    background: #ffffff;
                }
            </style>
        </head>
        <body>
            <div style="max-width: 320px; margin: 0 auto;">
                ${receiptContent}
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                }
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Quick direct WhatsApp share helper from seat actions modal
function shareReceiptDirectlyFromModal(memberId) {
    currentReceiptMemberId = memberId;
    shareReceiptWhatsApp();
}

// WhatsApp Share Receipt
function shareReceiptWhatsApp() {
    const member = state.members.find(m => m.id === currentReceiptMemberId);
    if (!member) return;
    
    let invoiceObj = null;
    const selectorSelect = document.getElementById("receipt-invoice-selector");
    if (selectorSelect && selectorSelect.value && member.invoices) {
        invoiceObj = member.invoices.find(inv => inv.id === selectorSelect.value);
    }
    
    // Fallback if no selected invoice
    if (!invoiceObj) {
        const fee = parseInt(member.feeAmount) || 0;
        const paid = member.amountPaid !== undefined ? (parseInt(member.amountPaid) || 0) : (member.paymentStatus === "Paid" ? fee : 0);
        const pending = member.balanceAmount !== undefined ? (parseInt(member.balanceAmount) || 0) : (fee - paid);
        invoiceObj = {
            timestamp: member.timestamp,
            startDate: member.startDate,
            expiryDate: member.expiryDate,
            seatId: member.seatId,
            planName: getPlanName(member.planId),
            feeAmount: fee,
            amountPaid: paid,
            balanceAmount: pending,
            paymentMethod: member.paymentMethod || 'Cash',
            paymentStatus: member.paymentStatus
        };
    }

    const seat = state.seats.find(s => s.id === invoiceObj.seatId);
    let roomDisplay = "";
    let seatDisplay = "";
    
    if (invoiceObj.seatId === "non-reserved") {
        roomDisplay = "N/A";
        seatDisplay = "Non-Reserved";
    } else {
        const seatInfo = getSeatRoomAndNumber(invoiceObj.seatId);
        const isReserved = seat ? seat.type === "reserved" : false;
        roomDisplay = `Room ${seatInfo.room}`;
        seatDisplay = `Seat ${seatInfo.number} (${isReserved ? 'Reserved' : 'Non-Reserved'})`;
    }
    
    const startDateFmt = new Date(invoiceObj.startDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
    const expiryDateFmt = new Date(invoiceObj.expiryDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
    const receiptNo = `TSC-${invoiceObj.timestamp.toString().slice(-6)}`;
    
    const fee = parseInt(invoiceObj.feeAmount) || 0;
    const paid = parseInt(invoiceObj.amountPaid) || 0;
    const pending = parseInt(invoiceObj.balanceAmount) || 0;
    
    // Construct WhatsApp message template
    const message = `*${state.settings.libraryName.toUpperCase()}* ☕
------------------------------
*MEMBERSHIP RECEIPT*
------------------------------
*Receipt No:* ${receiptNo}
*Date:* ${new Date(invoiceObj.timestamp).toLocaleDateString('en-IN')}

*Student Details:*
• Name: ${member.name} (${member.gender || 'N/A'})
• Date of Birth: ${member.dob ? new Date(member.dob).toLocaleDateString('en-IN') : 'N/A'}
• Aadhaar Number: ${member.govId || 'N/A'}
• Phone: ${member.phone}
• Email: ${member.email || 'N/A'}
• Target Exam/Course: ${member.targetExam || 'N/A'}
• Father's Name: ${member.fatherName || 'N/A'}
• Father's Mobile: ${member.fatherPhone || 'N/A'}
• Mother's Name: ${member.motherName || 'N/A'}
• Mother's Mobile: ${member.motherPhone || 'N/A'}
• Emergency Contact: ${member.emergencyName || 'N/A'} (${member.emergencyRelation || 'N/A'}) - ${member.emergencyPhone || 'N/A'}

*Seat & Validity:*
• Room Number: ${roomDisplay}
• Seat Number: ${seatDisplay}
• Validity Period: ${startDateFmt} to ${expiryDateFmt}

*Billing Info:*
• Total Plan Fee: ₹${fee}
• Amount Paid: ₹${paid}
• Remaining Dues: ₹${pending}
• Payment Method: ${invoiceObj.paymentMethod || 'Cash'}
• Status: *${invoiceObj.paymentStatus}*
------------------------------
Thank you for choosing ${state.settings.libraryName}!
Address: ${state.settings.address}
For support, contact us at: ${state.settings.phone}`;

    const encodedText = encodeURIComponent(message);
    
    // Format country prefix 91 if it's a 10 digit Indian number
    let cleanPhone = member.phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.substring(1);
    }
    if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
    }
    
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
}

// Helper to get registration URL with custom config
function getRegistrationLink(type) {
    let hostUrl = window.location.href;
    if (hostUrl.includes("admin.html")) {
        hostUrl = hostUrl.replace("admin.html", "register.html");
    } else if (hostUrl.includes("index.html")) {
        hostUrl = hostUrl.replace("index.html", "register.html");
    } else if (hostUrl.endsWith("/")) {
        hostUrl = hostUrl + "register.html";
    } else {
        const idx = hostUrl.lastIndexOf("/");
        hostUrl = hostUrl.substring(0, idx + 1) + "register.html";
    }
    
    let qrUrl = hostUrl + `?type=${type}`;
    
    const config = getFirebaseConfig();
    const isCustom = localStorage.getItem("custom_firebase_config") !== null;
    if (isCustom) {
        const parts = [
            config.apiKey || "",
            config.projectId || "",
            config.databaseURL || "",
            config.appId || ""
        ];
        const compactStr = parts.join('|');
        const configStr = btoa(compactStr);
        qrUrl += `&config=${configStr}`;
    }
    return qrUrl;
}

function openRegistrationLink(type) {
    const url = getRegistrationLink(type);
    window.open(url, '_blank');
}

// Generate printable QR Poster for desk registration
let qrCodeGeneratorInstance = null;

function updateRegistrationQR() {
    generateSettingsQRCodes();
}

function generateSettingsQRCodes() {
    const qrPermHolder = document.getElementById("qr-permanent");
    const qrDemoHolder = document.getElementById("qr-demo");
    if (!qrPermHolder || !qrDemoHolder) return;
    
    qrPermHolder.innerHTML = "";
    qrDemoHolder.innerHTML = "";
    
    const permUrl = getRegistrationLink("permanent");
    const demoUrl = getRegistrationLink("demo");
    
    try {
        new QRCode(qrPermHolder, {
            text: permUrl,
            width: 144,
            height: 144,
            colorDark : "#0a0e17",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.M
        });
        
        new QRCode(qrDemoHolder, {
            text: demoUrl,
            width: 144,
            height: 144,
            colorDark : "#0a0e17",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.M
        });
    } catch(err) {
        console.error("Settings QR Code generation failing:", err);
    }
}



// Print QR code frame
function printQRCode(type) {
    let selector = "#qrcode-display canvas";
    let title = "Admission Registration Desk";
    let sub = "Scan to fill the registration form & book your seat";
    let color = "#10b981";
    
    if (type === "permanent") {
        selector = "#qr-permanent canvas";
        title = "Permanent Admission Desk";
        sub = "Scan to register and select a seat for full membership";
        color = "#10b981";
    } else if (type === "demo") {
        selector = "#qr-demo canvas";
        title = "Free 5-Day Demo Desk";
        sub = "Scan to register for a 1 to 5 days free demo session";
        color = "#3b82f6";
    }
    
    const canvas = document.querySelector(selector);
    if (!canvas) {
        showToast("QR Code not generated yet. Please wait.", "error");
        return;
    }
    
    const qrDataUrl = canvas.toDataURL("image/png");
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Print QR Poster - Red Room</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    text-align: center;
                    padding: 3rem;
                    color: #0b0f19;
                }
                .poster-card {
                    border: 6px solid ${color};
                    padding: 3rem;
                    border-radius: 25px;
                    display: inline-block;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    max-width: 500px;
                }
                h1 {
                    font-size: 2.5rem;
                    margin: 1rem 0;
                    color: #0b0f19;
                }
                h3 {
                    color: #4b5563;
                    margin-bottom: 2rem;
                }
                .qr-img {
                    width: 250px;
                    height: 250px;
                    margin: 1.5rem 0;
                }
                .p-instruction {
                    font-size: 1.1rem;
                    color: #374151;
                    margin-top: 1.5rem;
                    line-height: 1.6;
                }
                .footer {
                    font-size: 0.9rem;
                    color: #9ca3af;
                    margin-top: 2.5rem;
                    border-top: 1px solid #e5e7eb;
                    padding-top: 1rem;
                }
            </style>
        </head>
        <body>
            <div class="poster-card">
                <div style="font-size: 3rem;">☕</div>
                <h1>${escapeHTML(state.settings.libraryName)}</h1>
                <h3>${escapeHTML(title)}</h3>
                
                <img class="qr-img" src="${qrDataUrl}" alt="Registration QR">
                
                <p class="p-instruction">
                    <strong>Scan to Book / Register</strong><br>
                    ${escapeHTML(sub)}
                </p>
                
                <div class="footer">
                    ${escapeHTML(state.settings.address)}
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                }
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Config file backups (JSON Export)
function backupData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `red_room_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Database backup downloaded successfully.", "success");
}

// JSON Restore handler
function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedState = JSON.parse(e.target.result);
            if (importedState.seats && importedState.members && importedState.settings) {
                if (importedState.seats.length !== 369) {
                    importedState.seats = generateDefaultSeats();
                    importedState.members.forEach(member => {
                        const seat = importedState.seats.find(s => s.id === member.seatId);
                        if (seat) {
                            seat.status = "occupied";
                            seat.assignedMemberId = member.id;
                        }
                    });
                }
                state = importedState;
                syncLocalToDatabase();
                showToast("Database restored successfully!", "success");
                refreshUI();
            } else {
                showToast("Invalid backup file format.", "error");
            }
        } catch(err) {
            showToast("Failed to read file.", "error");
        }
    };
    reader.readAsText(file);
}

// Full system reset to make all seats vacant and delete any existing data
function resetSystemData() {
    if (!confirm("⚠️ Warning: Are you sure you want to delete all students, bookings, and pending requests? This cannot be undone!")) {
        return;
    }
    if (!confirm("Confirm again: Do you really want to reset all 369 seats to vacant?")) {
        return;
    }
    
    state.members = [];
    state.pending = [];
    state.complaints = [];
    state.seats = generateDefaultSeats();
    
    if (!isOfflineMode && database) {
        database.ref("pending_bookings").remove();
        database.ref("study_cafe_system/complaints").remove();
        syncLocalToDatabase();
    } else {
        saveStateToLocalStorage();
    }
    
    showToast("System has been fully reset! All seats are now vacant.", "success");
    refreshUI();
}

// Settings inputs save
function saveSettings() {
    const newName = document.getElementById("set-lib-name").value.trim();
    const newPhone = document.getElementById("set-lib-phone").value.trim();
    const newAddr = document.getElementById("set-lib-addr").value.trim();
    
    if (!newName) {
        showToast("Library Name cannot be blank.", "error");
        return;
    }
    
    state.settings.libraryName = newName;
    state.settings.phone = newPhone || "9876543210";
    state.settings.address = newAddr;
    
    syncLocalToDatabase();
    const qrLibTitle = document.getElementById("qr-lib-title");
    if (qrLibTitle) qrLibTitle.textContent = newName;
    showToast("Library settings saved.", "success");
    updateRegistrationQR();
}

// Custom Firebase Configuration Save
function saveFirebaseConfig() {
    const apiKey = document.getElementById("fb-api-key").value.trim();
    const authDomain = document.getElementById("fb-auth-domain").value.trim();
    const dbUrl = document.getElementById("fb-db-url").value.trim();
    const projectId = document.getElementById("fb-project-id").value.trim();
    const storageBucket = document.getElementById("fb-storage-bucket").value.trim();
    
    if (!apiKey || !dbUrl || !projectId) {
        showToast("Please fill in API Key, Database URL, and Project ID.", "error");
        return;
    }
    
    const configObj = {
        apiKey: apiKey,
        authDomain: authDomain || `${projectId}.firebaseapp.com`,
        databaseURL: dbUrl,
        projectId: projectId,
        storageBucket: storageBucket || `${projectId}.appspot.com`
    };
    
    localStorage.setItem("custom_firebase_config", JSON.stringify(configObj));
    showToast("Firebase Config saved. Reloading page to connect...", "success");
    setTimeout(() => window.location.reload(), 1500);
}

function resetFirebaseConfig() {
    localStorage.removeItem("custom_firebase_config");
    showToast("Restored sandbox settings. Reloading page...", "info");
    setTimeout(() => window.location.reload(), 1500);
}

// Live Clock Update
function startLiveClock() {
    const updateTime = () => {
        const clockEl = document.getElementById("live-clock");
        const dateEl = document.getElementById("live-date");
        if (!clockEl || !dateEl) return;
        
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };
    updateTime();
    setInterval(updateTime, 1000);
}

// Listen to storage events for cross-tab updates (especially in Offline Mode)
window.addEventListener("storage", (event) => {
    if (event.key === "study_cafe_state" && event.newValue) {
        try {
            const newState = JSON.parse(event.newValue);
            if (newState) {
                state = newState;
                refreshUI();
            }
        } catch(e){}
    }
});

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
    initApp();
});

// ==========================================
// INTERACTIVE IMAGE LIGHTBOX CONTROLLER
// ==========================================
let lightboxScale = 1;
let lightboxRotation = 0;
let isPanning = false;
let startX = 0;
let startY = 0;
let panX = 0;
let panY = 0;

function openLightbox(imgSrc) {
    if (!imgSrc) return;
    const overlay = document.getElementById("lightbox-container");
    const img = document.getElementById("lightbox-img");
    if (!overlay || !img) return;
    
    img.src = imgSrc;
    resetLightbox();
    overlay.classList.add("active");
}

function closeLightbox(event) {
    if (event) {
        const classList = event.target.classList;
        if (!classList.contains("lightbox-overlay") && !classList.contains("lightbox-close") && !classList.contains("lightbox-content-wrapper")) {
            return;
        }
    }
    const overlay = document.getElementById("lightbox-container");
    if (overlay) overlay.classList.remove("active");
}

function zoomLightbox(delta) {
    lightboxScale = Math.min(Math.max(0.5, lightboxScale + delta), 4.0);
    applyLightboxTransform();
}

function rotateLightbox() {
    lightboxRotation = (lightboxRotation + 90) % 360;
    applyLightboxTransform();
}

function resetLightbox() {
    lightboxScale = 1;
    lightboxRotation = 0;
    panX = 0;
    panY = 0;
    applyLightboxTransform();
}

function applyLightboxTransform() {
    const img = document.getElementById("lightbox-img");
    if (img) {
        img.style.transform = `translate(${panX}px, ${panY}px) scale(${lightboxScale}) rotate(${lightboxRotation}deg)`;
    }
}

function handleAdminLogin(event) {
    event.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const errorMsg = document.getElementById("auth-error-msg");
    const submitBtn = document.querySelector("#auth-form button[type='submit']");
    
    if (errorMsg) {
        errorMsg.style.display = "none";
        errorMsg.className = "auth-error-msg";
    }
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authorizing...';
    }
    
    try {
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then(() => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
                }
                document.getElementById("auth-form").reset();
            })
            .catch(err => {
                console.error("Login failed:", err);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
                }
                if (errorMsg) {
                    let displayErr = "Authorization failed. Please check your credentials.";
                    if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
                        displayErr = "Invalid email or password.";
                    } else if (err.code === "auth/invalid-email") {
                        displayErr = "Invalid email address format.";
                    } else if (err.code === "auth/network-request-failed") {
                        displayErr = "Network error. Please check your internet connection.";
                    } else if (err.message) {
                        displayErr = err.message;
                    }
                    errorMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${displayErr}`;
                    errorMsg.style.display = "flex";
                }
            });
    } catch (err) {
        console.error("Authentication synchronous error:", err);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Login';
        }
        if (errorMsg) {
            errorMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Initialization Error: ${err.message || err}`;
            errorMsg.style.display = "flex";
        }
    }
}

function resetFirebaseConfigFromLogin(event) {
    if (event) event.preventDefault();
    if (confirm("Are you sure you want to restore the Default Sandbox Database? This will reload the page and connect to the sandbox database.")) {
        localStorage.removeItem("custom_firebase_config");
        window.location.reload();
    }
}

// Send password reset email
function handleForgotPassword(event) {
    if (event) event.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const errorMsg = document.getElementById("auth-error-msg");
    
    if (!email) {
        if (errorMsg) {
            errorMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Please enter your Admin Email first.`;
            errorMsg.className = "auth-error-msg info";
            errorMsg.style.display = "flex";
        }
        return;
    }
    
    if (confirm(`Send password reset email to ${email}?`)) {
        if (window.firebase && window.firebase.auth) {
            firebase.auth().sendPasswordResetEmail(email)
                .then(() => {
                    showToast("Password reset email sent! Please check your inbox.", "success");
                    if (errorMsg) {
                        errorMsg.innerHTML = `<i class="fa-solid fa-circle-info"></i> Reset link sent to ${email}.`;
                        errorMsg.className = "auth-error-msg success";
                        errorMsg.style.display = "flex";
                    }
                })
                .catch(err => {
                    console.error("Password reset failed:", err);
                    if (errorMsg) {
                        errorMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Reset Error: ${err.message}`;
                        errorMsg.className = "auth-error-msg";
                        errorMsg.style.display = "flex";
                    }
                });
        } else {
            showToast("Firebase Auth not initialized.", "error");
        }
    }
}

function handleAdminLogout() {
    if (confirm("Are you sure you want to log out from the Red Room Control Center?")) {
        firebase.auth().signOut()
            .then(() => {
                showToast("Logged out successfully.", "info");
            })
            .catch(err => {
                console.error("Logout failed:", err);
                showToast("Failed to logout.", "error");
            });
    }
}

function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input || !icon) return;
    
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
        icon.style.color = "var(--accent-emerald)";
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
        icon.style.color = "var(--text-muted)";
    }
}

// Bind Panning and Wheel zooming mouse event listeners
window.addEventListener("DOMContentLoaded", () => {
    const img = document.getElementById("lightbox-img");
    if (!img) return;
    
    // Scroll Wheel Zooming
    img.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.2 : -0.2;
        zoomLightbox(delta);
    }, { passive: false });
    
    // Double click to reset
    img.addEventListener("dblclick", () => {
        resetLightbox();
    });
    
    // Click & Drag Panning
    img.addEventListener("mousedown", (e) => {
        e.preventDefault();
        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        img.style.transition = "none";
    });
    
    window.addEventListener("mousemove", (e) => {
        if (!isPanning) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyLightboxTransform();
    });
    
    window.addEventListener("mouseup", () => {
        if (!isPanning) return;
        isPanning = false;
        if (img) img.style.transition = "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)";
    });
});

// Render dynamic fees charts using Chart.js
function renderFeesCharts() {
    const canvasRevenue = document.getElementById("chart-revenue-trends");
    const canvasSplit = document.getElementById("chart-payment-split");
    
    if (!canvasRevenue || !canvasSplit) return;
    
    // Destroy existing chart instances to avoid overlays
    if (window.revenueTrendChart && typeof window.revenueTrendChart.destroy === 'function') {
        window.revenueTrendChart.destroy();
    }
    if (window.paymentSplitChart && typeof window.paymentSplitChart.destroy === 'function') {
        window.paymentSplitChart.destroy();
    }
    
    const monthlyRevenue = {};
    let cashTotal = 0;
    let onlineTotal = 0;
    
    state.members.forEach(m => {
        const fee = parseInt(m.feeAmount) || 0;
        const paid = m.amountPaid !== undefined ? (parseInt(m.amountPaid) || 0) : (m.paymentStatus === "Paid" ? fee : 0);
        
        // Group by Month (Year-Month format for chronological sorting)
        const date = new Date(m.timestamp || Date.now());
        const monthKey = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }); // e.g. "May 2026"
        
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + paid;
        
        // Mode split (Cash vs UPI/Online)
        const method = (m.paymentMethod || "Cash").toLowerCase();
        if (method.includes("cash")) {
            cashTotal += paid;
        } else {
            onlineTotal += paid;
        }
    });
    
    // Sort Month keys chronologically
    const sortedMonths = Object.keys(monthlyRevenue).sort((a, b) => {
        return new Date(a) - new Date(b);
    });
    
    const revenueData = sortedMonths.map(m => monthlyRevenue[m]);
    
    // 1. Monthly Revenue Bar Chart
    const ctxRevenue = canvasRevenue.getContext('2d');
    window.revenueTrendChart = new Chart(ctxRevenue, {
        type: 'bar',
        data: {
            labels: sortedMonths.length > 0 ? sortedMonths : ["No Data"],
            datasets: [{
                label: 'Monthly Revenue (₹)',
                data: revenueData.length > 0 ? revenueData : [0],
                backgroundColor: 'rgba(16, 185, 129, 0.45)',
                borderColor: 'var(--accent-emerald)',
                borderWidth: 1.5,
                borderRadius: 4,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { size: 9 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { size: 9 } }
                }
            }
        }
    });
    
    // 2. Payment Method split doughnut chart
    const ctxSplit = canvasSplit.getContext('2d');
    window.paymentSplitChart = new Chart(ctxSplit, {
        type: 'doughnut',
        data: {
            labels: ['Cash', 'UPI/Online'],
            datasets: [{
                data: [cashTotal, onlineTotal],
                backgroundColor: [
                    'rgba(245, 158, 11, 0.5)', // Amber
                    'rgba(59, 130, 246, 0.5)'  // Blue
                ],
                borderColor: [
                    'var(--accent-amber)',
                    'var(--accent-blue)'
                ],
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                    callbacks: {
                        label: function(context) {
                            const val = context.raw || 0;
                            const total = cashTotal + onlineTotal;
                            const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                            return `${context.label}: ₹${val.toLocaleString('en-IN')} (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// Preset changes for custom report date selectors
function onReportPresetChange() {
    const preset = document.getElementById("report-preset").value;
    const customRow = document.getElementById("report-custom-dates-row");
    if (!customRow) return;
    
    if (preset === "custom") {
        customRow.style.display = "grid";
        const end = new Date().toISOString().split('T')[0];
        const start = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
        document.getElementById("report-start-date").value = start;
        document.getElementById("report-end-date").value = end;
    } else {
        customRow.style.display = "none";
    }
}

// Generate & Download fees report CSV
function exportFeesReport() {
    const preset = document.getElementById("report-preset").value;
    let startDate = null;
    let endDate = null;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (preset === "today") {
        startDate = today;
        endDate = new Date(today.getTime() + 24 * 3600 * 1000);
    } else if (preset === "this-month") {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    } else if (preset === "last-month") {
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset === "custom") {
        const startStr = document.getElementById("report-start-date").value;
        const endStr = document.getElementById("report-end-date").value;
        if (!startStr || !endStr) {
            showToast("Please select valid start and end dates.", "error");
            return;
        }
        startDate = new Date(startStr);
        startDate.setHours(0,0,0,0);
        endDate = new Date(endStr);
        endDate.setHours(23,59,59,999);
    }
    
    const filteredMembers = state.members.filter(m => {
        if (!startDate || !endDate) return true;
        const timestamp = m.timestamp || Date.now();
        return timestamp >= startDate.getTime() && timestamp <= endDate.getTime();
    });
    
    if (filteredMembers.length === 0) {
        showToast("No financial records found in the selected range.", "info");
        return;
    }
    
    const csvRows = [];
    csvRows.push([
        "Student Name",
        "Phone Number",
        "Assigned Seat",
        "Plan Name",
        "Total Fee (INR)",
        "Amount Paid (INR)",
        "Remaining Dues (INR)",
        "Payment Status",
        "Payment Method",
        "Registration Date"
    ].map(h => `"${h}"`).join(","));
    
    filteredMembers.forEach(m => {
        const fee = parseInt(m.feeAmount) || 0;
        const paid = m.amountPaid !== undefined ? (parseInt(m.amountPaid) || 0) : (m.paymentStatus === "Paid" ? fee : 0);
        const pending = m.balanceAmount !== undefined ? (parseInt(m.balanceAmount) || 0) : (fee - paid);
        
        const seatText = getSeatDisplayName(m.seatId);
        
        const planName = PLANS.find(p => p.id === m.planId)?.name || 'Custom Plan';
        const regDate = new Date(m.timestamp || Date.now()).toLocaleDateString('en-IN');
        
        const row = [
            m.name,
            m.phone,
            seatText,
            planName,
            fee,
            paid,
            pending,
            m.paymentStatus,
            m.paymentMethod || "Cash",
            regDate
        ].map(val => `"${val.toString().replace(/"/g, '""')}"`).join(",");
        
        csvRows.push(row);
    });
    
    // Add BOM for proper UTF-8 Excel handling
    const csvContent = "\uFEFF" + csvRows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    
    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, filename);
        return;
    }
    
    const url = URL.createObjectURL(blob);
    const filename = `RedRoom_FeesReport_${preset}_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`Successfully exported report for ${filteredMembers.length} students!`, "success");
}

// ==========================================
// COMPLAINT TICKET SYSTEM WORKFLOWS
// ==========================================

// Updates the Complaints badge in the sidebar
function updateComplaintsBadge() {
    const badge = document.getElementById("complaints-count");
    if (!badge) return;
    
    const count = (state.complaints || []).filter(c => c && c.status === "pending").length;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }
}

// Renders the list of complaints inside complaints-table-body
function renderComplaintsList() {
    const tableBody = document.getElementById("complaints-table-body");
    if (!tableBody) return;
    tableBody.innerHTML = "";
    
    const complaints = state.complaints || [];
    
    if (complaints.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="padding: 2.5rem; color: var(--text-muted); font-size: 0.9rem;">
                    <i class="fa-solid fa-circle-check" style="font-size: 2.2rem; color: var(--accent-emerald); margin-bottom: 0.75rem; display: block; text-align: center;"></i>
                    No complaints registered. The study environment is clean and peaceful!
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort: Pending first, then In Progress, then Resolved. Within each, latest timestamp first.
    const sorted = [...complaints].sort((a, b) => {
        const order = { "pending": 1, "in-progress": 2, "resolved": 3 };
        const orderA = order[a.status] || 9;
        const orderB = order[b.status] || 9;
        
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    sorted.forEach(c => {
        const tr = document.createElement("tr");
        
        // Status Badge Style
        let badgeStyle = "font-weight: 700; font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 4px; display: inline-block;";
        if (c.status === "pending") {
            badgeStyle += " background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);";
        } else if (c.status === "in-progress") {
            badgeStyle += " background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2);";
        } else {
            badgeStyle += " background: rgba(16, 185, 129, 0.1); color: var(--accent-emerald); border: 1px solid rgba(16, 185, 129, 0.2);";
        }
        
        // Date formatting
        const dateObj = new Date(c.timestamp);
        const formattedDate = dateObj.toLocaleDateString("en-IN") + " " + dateObj.toLocaleTimeString("en-IN", {hour: '2-digit', minute:'2-digit'});
        
        // Student Info
        const cleanComplaintPhone = c.phone.replace(/\D/g, "");
        const registeredStudent = (state.members || []).find(m => {
            const cleanMemberPhone = m.phone.replace(/\D/g, "");
            return cleanMemberPhone === cleanComplaintPhone;
        });

        let verificationBadge = "";
        if (registeredStudent) {
            verificationBadge = ` <span style="font-size: 0.65rem; padding: 0.1rem 0.35rem; vertical-align: middle; background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 4px; font-weight: 700; display: inline-flex; align-items: center; gap: 0.15rem;"><i class="fa-solid fa-circle-check"></i> Verified</span>`;
        } else {
            verificationBadge = ` <span style="font-size: 0.65rem; padding: 0.1rem 0.35rem; vertical-align: middle; background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 4px; font-weight: 700; display: inline-flex; align-items: center; gap: 0.15rem;"><i class="fa-solid fa-circle-xmark"></i> Unregistered</span>`;
        }

        const studentInfoHtml = `
            <div style="font-weight: 600; color: #fff; display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                <span>${escapeHTML(c.studentName)}</span>
                ${verificationBadge}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">
                <i class="fa-solid fa-phone" style="font-size:0.75rem;"></i> ${escapeHTML(c.phone)}
            </div>
            <div style="font-size: 0.8rem; color: var(--accent-blue); font-weight: 500; margin-top: 0.15rem;">
                Room ${escapeHTML(c.room)} • Seat ${escapeHTML(c.seatNumber || "Flexible")}
            </div>
        `;
        
        // Ticket Info
        const ticketInfoHtml = `
            <strong style="color: var(--accent-rose); font-family: var(--font-display);">${escapeHTML(c.ticketId)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">${formattedDate}</div>
        `;
        
        // Issue Category
        let categoryIcon = "fa-triangle-exclamation";
        if (c.category === "Wi-Fi") categoryIcon = "fa-wifi";
        else if (c.category === "AC & Cooling") categoryIcon = "fa-snowflake";
        else if (c.category === "Cleanliness") categoryIcon = "fa-broom";
        else if (c.category === "Lighting & Power") categoryIcon = "fa-plug";
        else if (c.category === "Noise Distraction") categoryIcon = "fa-volume-xmark";
        else if (c.category === "Drinking Water") categoryIcon = "fa-bottle-water";
        
        const categoryHtml = `
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; font-weight: 600; color: #ffffff;">
                <i class="fa-solid ${categoryIcon}" style="color: var(--accent-blue); font-size: 0.9rem;"></i>
                ${escapeHTML(c.category)}
            </span>
        `;
        
        // Actions Html
        const actionsHtml = `
            <div style="display: flex; flex-direction: column; gap: 0.5rem; max-width: 180px;">
                <select onchange="changeComplaintStatus('${c.id}', this.value)" class="select-input" style="width: 100%; padding: 0.3rem; font-size: 0.8rem; height: 32px;">
                    <option value="pending" ${c.status === 'pending' ? 'selected' : ''}>🔴 Mark Pending</option>
                    <option value="in-progress" ${c.status === 'in-progress' ? 'selected' : ''}>🟡 Mark In-Progress</option>
                    <option value="resolved" ${c.status === 'resolved' ? 'selected' : ''}>🟢 Mark Resolved</option>
                </select>
                <div style="display: flex; gap: 0.3rem;">
                    <a href="https://wa.me/91${escapeHTML(c.phone)}?text=${encodeURIComponent(getComplaintWhatsAppMessage(c))}" target="_blank" class="btn btn-secondary" style="padding: 0.35rem; flex: 1; height: 32px; font-size: 0.75rem; justify-content: center; background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.2); color: #a7f3d0; margin-bottom: 0;" title="Send WhatsApp Update">
                        <i class="fa-brands fa-whatsapp"></i> Update
                    </a>
                    <button onclick="deleteComplaint('${c.id}')" class="btn btn-secondary" style="padding: 0.35rem; flex: 0.4; height: 32px; font-size: 0.75rem; justify-content: center; background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.2); color: #fca5a5; margin-bottom: 0;" title="Delete Ticket">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Description + Admin notes input
        const descriptionHtml = `
            <div style="color: #cbd5e1; font-size: 0.88rem; line-height: 1.4; white-space: pre-wrap;">${escapeHTML(c.description)}</div>
            <div style="margin-top: 0.75rem; display: flex; gap: 0.4rem; align-items: center;">
                <input type="text" id="notes-${c.id}" class="form-control" style="height: 30px; font-size: 0.75rem; padding: 0.2rem 0.5rem; background: rgba(255,255,255,0.02); border-color: var(--border-color);" placeholder="Add internal staff notes..." value="${escapeHTML(c.adminNotes || '')}">
                <button onclick="saveComplaintNotes('${c.id}')" class="btn btn-secondary" style="height: 30px; padding: 0 0.6rem; font-size: 0.75rem; margin-bottom: 0;">Save</button>
            </div>
        `;
        
        tr.innerHTML = `
            <td style="vertical-align: top; padding-top: 1rem;">${ticketInfoHtml}</td>
            <td style="vertical-align: top; padding-top: 1rem;">${studentInfoHtml}</td>
            <td style="vertical-align: top; padding-top: 1rem;">${categoryHtml}</td>
            <td style="vertical-align: top; padding-top: 1rem; max-width: 280px;">${descriptionHtml}</td>
            <td style="vertical-align: top; padding-top: 1.1rem;"><span style="${badgeStyle}">${c.status.toUpperCase()}</span></td>
            <td style="vertical-align: top; padding-top: 1rem;">${actionsHtml}</td>
        `;
        
        tableBody.appendChild(tr);
    });
}

// Generate the customized WhatsApp template for complaints
function getComplaintWhatsAppMessage(c) {
    const libName = state.settings.libraryName;
    if (c.status === "resolved") {
        return `Hi ${c.studentName},\n\nआपकी Seat No. ${c.seatNumber || "Flexible"} (Room ${c.room}) के लिए दर्ज की गई [${c.category}] की समस्या (Ticket ID: ${c.ticketId}) को हल कर दिया गया है।\n\nयदि आपको अभी भी कोई समस्या आ रही है, तो कृपया एडमिन डेस्क पर संपर्क करें।\n\nधन्यवाद!\n-${libName}`;
    } else if (c.status === "in-progress") {
        return `Hi ${c.studentName},\n\nआपकी Seat No. ${c.seatNumber || "Flexible"} (Room ${c.room}) के लिए दर्ज की गई [${c.category}] की समस्या (Ticket ID: ${c.ticketId}) पर काम चल रहा है (In-Progress)। हमारे कर्मचारी जल्द ही इसे ठीक कर देंगे।\n\nधैर्य रखने के लिए धन्यवाद!\n-${libName}`;
    } else {
        return `Hi ${c.studentName},\n\nहमें आपकी Seat No. ${c.seatNumber || "Flexible"} (Room ${c.room}) के लिए दर्ज की गई [${c.category}] की समस्या (Ticket ID: ${c.ticketId}) प्राप्त हुई है। हमारा स्टाफ इसे जल्द से जल्द हल करने का प्रयास कर रहा है।\n\n-${libName}`;
    }
}

// Update status in Firebase or localStorage
function changeComplaintStatus(ticketId, newStatus) {
    if (isOfflineMode || !database) {
        // Offline update
        state.complaints = state.complaints.map(c => {
            if (c.id === ticketId) c.status = newStatus;
            return c;
        });
        saveStateToLocalStorage();
        updateComplaintsBadge();
        renderComplaintsList();
        showToast(`Status updated to ${newStatus} offline!`, "success");
    } else {
        database.ref("study_cafe_system/complaints").child(ticketId).update({ status: newStatus })
            .then(() => {
                showToast(`Ticket status updated to ${newStatus}!`, "success");
            })
            .catch(err => {
                console.error("Failed to update status:", err);
                showToast("Failed to update ticket status on server.", "error");
            });
    }
}

// Delete complaint ticket
function deleteComplaint(ticketId) {
    if (!confirm("Are you sure you want to delete this complaint ticket permanently?")) return;
    
    if (isOfflineMode || !database) {
        state.complaints = state.complaints.filter(c => c.id !== ticketId);
        saveStateToLocalStorage();
        updateComplaintsBadge();
        renderComplaintsList();
        showToast("Complaint ticket deleted offline!", "success");
    } else {
        database.ref("study_cafe_system/complaints").child(ticketId).remove()
            .then(() => {
                showToast("Complaint ticket deleted successfully!", "success");
            })
            .catch(err => {
                console.error("Failed to delete complaint:", err);
                showToast("Failed to delete complaint from server.", "error");
            });
    }
}

// Save internal staff notes on complaint
function saveComplaintNotes(ticketId) {
    const input = document.getElementById(`notes-${ticketId}`);
    if (!input) return;
    const notes = input.value.trim();
    
    if (isOfflineMode || !database) {
        state.complaints = state.complaints.map(c => {
            if (c.id === ticketId) c.adminNotes = notes;
            return c;
        });
        saveStateToLocalStorage();
        showToast("Staff notes saved offline!", "success");
    } else {
        database.ref("study_cafe_system/complaints").child(ticketId).update({ adminNotes: notes })
            .then(() => {
                showToast("Staff notes saved successfully!", "success");
            })
            .catch(err => {
                console.error("Failed to save notes:", err);
                showToast("Failed to save notes to server.", "error");
            });
    }
}

let checkingExpirations = false;
function checkDemoExpirations() {
    if (checkingExpirations) return;
    checkingExpirations = true;
    
    try {
        let changed = false;
        const todayZero = new Date().setHours(0,0,0,0);
        const affectedMemberIds = [];
        const affectedSeatIds = [];
        
        (state.members || []).forEach(member => {
            if (member.status === "demo") {
                const expiry = new Date(member.expiryDate);
                if (expiry.getTime() < todayZero) {
                    member.status = "demo-expired";
                    affectedMemberIds.push(member.id);
                    
                    // Vacate seat
                    if (member.seatId && member.seatId !== "non-reserved") {
                        const seat = state.seats.find(s => s.id === member.seatId);
                        if (seat) {
                            seat.status = "vacant";
                            seat.assignedMemberId = null;
                            affectedSeatIds.push(seat.id);
                            showToast(`Demo expired for ${member.name}. Seat ${seat.number} is now vacated.`, "info");
                        }
                    } else {
                        showToast(`Demo expired for ${member.name}.`, "info");
                    }
                    changed = true;
                }
            }
        });
        
        if (changed) {
            if (!isOfflineMode && database) {
                // Precise patches
                affectedMemberIds.forEach(mId => {
                    patchFirebaseData(mId, []);
                });
                if (affectedSeatIds.length > 0) {
                    patchFirebaseData(null, affectedSeatIds);
                }
                refreshUI();
            } else {
                saveStateToLocalStorage();
                refreshUI();
            }
        }
    } finally {
        checkingExpirations = false;
    }
}

const CONVERT_PLANS = {
    "general-monthly": { price: 700, duration: 1, type: "non-reserved" },
    "premium-monthly": { price: 1000, duration: 1, type: "reserved" },
    "general-quarterly": { price: 1900, duration: 3, type: "non-reserved" },
    "premium-quarterly": { price: 2700, duration: 3, type: "reserved" },
    "general-halfyearly": { price: 3600, duration: 6, type: "non-reserved" },
    "premium-halfyearly": { price: 5000, duration: 6, type: "reserved" }
};

function openConvertDemoModal(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    document.getElementById("convert-member-id").value = memberId;
    document.getElementById("convert-student-name").textContent = member.name;
    
    let seatText = "Non-Reserved";
    if (member.seatId !== "non-reserved") {
        const seat = state.seats.find(s => s.id === member.seatId);
        seatText = seat ? `Seat ${seat.number} (Room ${seat.room})` : member.seatId;
    }
    document.getElementById("convert-student-seat").textContent = seatText;
    
    // Default to premium if they had a reserved seat, general otherwise
    const isReserved = member.seatId !== "non-reserved";
    document.getElementById("convert-plan-id").value = isReserved ? "premium-monthly" : "general-monthly";
    
    // Set start date to today
    document.getElementById("convert-start-date").value = new Date().toISOString().split('T')[0];
    
    // Trigger plan price populating and balance calculations
    onConvertPlanChange();
    
    openModal("modal-convert-demo");
}

function onConvertPlanChange() {
    const planId = document.getElementById("convert-plan-id").value;
    const plan = CONVERT_PLANS[planId];
    if (plan) {
        document.getElementById("convert-amount-paid").value = plan.price;
    }
    calculateConvertBalance();
}

function calculateConvertBalance() {
    const planId = document.getElementById("convert-plan-id").value;
    const plan = CONVERT_PLANS[planId];
    if (!plan) return;
    
    const amountPaid = parseInt(document.getElementById("convert-amount-paid").value) || 0;
    const balance = plan.price - amountPaid;
    
    document.getElementById("convert-balance").value = balance;
}

function submitConvertDemoForm(event) {
    event.preventDefault();
    
    const memberId = document.getElementById("convert-member-id").value;
    const planId = document.getElementById("convert-plan-id").value;
    const startDateVal = document.getElementById("convert-start-date").value;
    const paymentMethod = document.querySelector('input[name="convert-payment-method"]:checked').value;
    const amountPaid = parseInt(document.getElementById("convert-amount-paid").value) || 0;
    const balanceAmount = parseInt(document.getElementById("convert-balance").value) || 0;
    
    if (!startDateVal) {
        showToast("Please select a Membership Start Date.", "error");
        return;
    }
    
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    const plan = CONVERT_PLANS[planId];
    if (!plan) return;
    
    const affectedSeatIds = [];
    // If transitioning from reserved to non-reserved plan, vacate their seat
    if (plan.type === "non-reserved" && member.seatId && member.seatId !== "non-reserved") {
        const oldSeat = state.seats.find(s => s.id === member.seatId);
        if (oldSeat) {
            oldSeat.status = "vacant";
            oldSeat.assignedMemberId = null;
            affectedSeatIds.push(oldSeat.id);
        }
        member.seatId = "non-reserved";
    }
    
    if (plan.type === "reserved" && member.seatId === "non-reserved") {
        showToast("Cannot assign a Reserved Plan to a student without an assigned seat. Please assign a seat via normal Info edit first.", "error");
        return;
    }
    
    // Manage Invoice History and Installments for conversion
    let invoices = member.invoices || [];
    if (invoices.length === 0) {
        // Fallback for prior demo pass
        const fallbackPayments = member.payments || [];
        invoices.push({
            id: "inv_" + (member.timestamp || Date.now()),
            timestamp: member.timestamp || Date.now(),
            planName: "Free Demo Pass",
            planId: member.planId || "demo-5",
            seatId: member.seatId,
            startDate: member.startDate || startDateVal,
            expiryDate: member.expiryDate || startDateVal,
            feeAmount: 0,
            amountPaid: 0,
            balanceAmount: 0,
            paymentStatus: "Paid",
            paymentMethod: "Free Demo",
            payments: fallbackPayments
        });
    }

    const invoiceId = "inv_" + Date.now();
    const initPayments = [];
    if (amountPaid > 0) {
        initPayments.push({
            id: "pay_" + Date.now(),
            date: new Date().toISOString(),
            amount: amountPaid,
            method: paymentMethod,
            note: "Demo Converted"
        });
    }
    
    // Update member properties to active membership status
    member.status = "active";
    member.planId = planId;
    member.startDate = startDateVal;
    member.paymentMethod = paymentMethod;
    member.feeAmount = plan.price;
    member.amountPaid = amountPaid;
    member.balanceAmount = balanceAmount;
    member.paymentStatus = balanceAmount === 0 ? "Paid" : "Partial";
    member.duration = plan.duration;
    
    // Remove demo fields
    delete member.demoStartDate;
    delete member.demoEndDate;
    delete member.demoDuration;
    
    // Calculate expiry date
    const expiry = new Date(startDateVal);
    expiry.setMonth(expiry.getMonth() + plan.duration);
    member.expiryDate = expiry.toISOString().split('T')[0];
    
    // Update timestamp for sorting
    member.timestamp = Date.now();
    
    const newInvoice = {
        id: invoiceId,
        timestamp: member.timestamp,
        planName: getPlanName(planId),
        planId: planId,
        seatId: member.seatId,
        startDate: startDateVal,
        expiryDate: member.expiryDate,
        feeAmount: plan.price,
        amountPaid: amountPaid,
        balanceAmount: balanceAmount,
        paymentStatus: member.paymentStatus,
        paymentMethod: paymentMethod,
        payments: initPayments
    };
    invoices.push(newInvoice);
    member.invoices = invoices;
    member.payments = [...initPayments];
    
    patchFirebaseData(memberId, affectedSeatIds);
    closeModal("modal-convert-demo");
    showToast(`Converted ${member.name} to permanent membership successfully!`, "success");
    
    refreshUI();
    
    // Open receipt automatically
    setTimeout(() => {
        openReceiptModal(memberId);
    }, 450);
}

// ==========================================
// SIDEBAR COLLAPSE / TOGGLE CONTROLLER
// ==========================================
function toggleSidebar() {
    const isCollapsed = document.body.classList.toggle("sidebar-collapsed");
    try {
        localStorage.setItem("sidebar_collapsed", isCollapsed ? "true" : "false");
    } catch(e) {}
}

