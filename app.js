// The Study Cafe - Admin Panel Logic (Shift-free, 4 Rooms, 400 Seats Version with Receipt & WhatsApp)

const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDW0-_Xzvwvkm9wpZ9j2ihDQmIAalrn7lM",
    authDomain: "test-560c6.firebaseapp.com",
    databaseURL: "https://test-560c6-default-rtdb.firebaseio.com",
    projectId: "test-560c6",
    storageBucket: "test-560c6.firebasestorage.app"
};

const PLANS = [
    { id: 'general-monthly', name: 'Non-Reserved Monthly', price: 700, type: 'non-reserved', duration: 1 },
    { id: 'premium-monthly', name: 'Reserved Monthly', price: 1000, type: 'reserved', duration: 1 },
    { id: 'general-quarterly', name: 'Non-Reserved Quarterly', price: 1900, type: 'non-reserved', duration: 3 },
    { id: 'premium-quarterly', name: 'Reserved Quarterly', price: 2700, type: 'reserved', duration: 3 },
    { id: 'general-halfyearly', name: 'Non-Reserved Half-Yearly', price: 3600, type: 'non-reserved', duration: 6 },
    { id: 'premium-halfyearly', name: 'Reserved Half-Yearly', price: 5000, type: 'reserved', duration: 6 }
];

// App State
let state = {
    seats: [],
    members: [],
    pending: [],
    settings: {
        libraryName: "The Study Cafe",
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

// Generate default seats (400 seats total across 4 rooms, each room has 100 seats)
function generateDefaultSeats() {
    const seats = [];
    for (let i = 1; i <= 400; i++) {
        const room = Math.ceil(i / 100);
        const positionInRoom = i - (room - 1) * 100;
        seats.push({
            id: `seat_${i}`,
            number: positionInRoom,
            room: room,
            type: "general",
            status: "vacant",
            assignedMemberId: null
        });
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
        localStorage.setItem("study_cafe_state", JSON.stringify(state));
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
            return JSON.parse(custom);
        }
    } catch(e){}
    return DEFAULT_FIREBASE_CONFIG;
}

// Initialize application and database connections
function initApp() {
    const config = getFirebaseConfig();
    
    // Set UI displays for inputs
    document.getElementById("fb-api-key").value = config.apiKey === DEFAULT_FIREBASE_CONFIG.apiKey ? "" : config.apiKey;
    document.getElementById("fb-auth-domain").value = config.authDomain === DEFAULT_FIREBASE_CONFIG.authDomain ? "" : config.authDomain;
    document.getElementById("fb-db-url").value = config.databaseURL === DEFAULT_FIREBASE_CONFIG.databaseURL ? "" : config.databaseURL;
    document.getElementById("fb-project-id").value = config.projectId === DEFAULT_FIREBASE_CONFIG.projectId ? "" : config.projectId;
    document.getElementById("fb-storage-bucket").value = config.storageBucket === DEFAULT_FIREBASE_CONFIG.storageBucket ? "" : config.storageBucket;
    
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
            } else if (!state.seats || state.seats.length !== 400) {
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
    document.getElementById("qr-lib-title").textContent = state.settings.libraryName;
    
    // Try to load Firebase
    if (window.firebase && window.firebase.initializeApp) {
        try {
            const app = firebase.initializeApp(config);
            database = app.database();
            
            const statusDot = document.getElementById("db-status-dot");
            const statusText = document.getElementById("db-status-text");
            
            statusDot.className = "status-dot online";
            statusText.textContent = config.apiKey === DEFAULT_FIREBASE_CONFIG.apiKey ? "Demo Database" : "Private DB Connected";
            
            setupFirebaseListeners();
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

    // Set Default Tab
    switchTab("dashboard");
    
    refreshUI();
    updateRegistrationQR();
    startLiveClock();
}

function enableOfflineMode() {
    isOfflineMode = true;
    const statusDot = document.getElementById("db-status-dot");
    const statusText = document.getElementById("db-status-text");
    statusDot.className = "status-dot";
    statusText.textContent = "Offline Mode";
    showToast("Running in Local Offline Mode. Changes will save in this browser.", "info");
}

// Realtime sync listeners
function setupFirebaseListeners() {
    if (!database) return;
    
    const dbRef = database.ref("study_cafe_system");
    
    // Initialize database node if empty
    dbRef.once("value", snapshot => {
        if (!snapshot.exists()) {
            dbRef.set({
                settings: state.settings,
                seats: state.seats,
                members: state.members
            });
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
        saveStateToLocalStorage();
        renderMemberTable();
        updateDashboardKPIs();
        renderDashboardAlerts();
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
            document.getElementById("qr-lib-title").textContent = state.settings.libraryName;
            document.getElementById("set-lib-name").value = state.settings.libraryName;
            document.getElementById("set-lib-addr").value = state.settings.address;
            saveStateToLocalStorage();
        }
    });
}

// Handle data syncing when offline
function syncLocalToDatabase() {
    if (isOfflineMode || !database) {
        saveStateToLocalStorage();
        return;
    }
    
    database.ref("study_cafe_system").set({
        settings: state.settings,
        seats: state.seats,
        members: state.members
    });
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
    } else if (tabId === "seats") {
        renderSeatGrid();
    } else if (tabId === "members") {
        renderMemberTable();
    } else if (tabId === "pending") {
        renderPendingRequests();
    } else if (tabId === "settings") {
        updateRegistrationQR();
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
        
        if (badge) badge.textContent = `${roomOccupants} / 100`;
        if (progress) progress.style.width = `${roomOccupants}%`;
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
        
        const avatarLetter = member.name.charAt(0).toUpperCase();
        
        let seatInfoText = "";
        if (member.seatId === "non-reserved") {
            seatInfoText = "Non-Reserved";
        } else {
            const globalSeatNum = parseInt(member.seatId.replace('seat_', ''));
            const roomNum = Math.ceil(globalSeatNum / 100);
            const localSeatNum = globalSeatNum - (roomNum - 1) * 100;
            seatInfoText = `Room ${roomNum} - Seat ${localSeatNum}`;
        }
        
        item.innerHTML = `
            <div class="alert-avatar">${avatarLetter}</div>
            <div class="alert-details">
                <div class="alert-name">${member.name}</div>
                <div class="alert-info">${seatInfoText} • ${member.phone}</div>
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

// Render interactive seat boxes filtered by Room
function renderSeatGrid() {
    const grid = document.getElementById("seat-grid");
    if (!grid) return;
    grid.innerHTML = "";
    
    const selectedRoom = parseInt(document.getElementById("seat-filter-room").value) || 1;
    const today = new Date().setHours(0,0,0,0);
    
    const roomSeats = state.seats.filter(s => s.room === selectedRoom);
    
    roomSeats.forEach(seat => {
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
        
        // Add Reserved/General class based on occupied type
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
        
        grid.appendChild(box);
    });
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
            m.seatId.replace("seat_", "").includes(searchVal)
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
        
        const startDateFmt = new Date(member.startDate).toLocaleDateString('en-IN', {day:'numeric', month:'short'});
        const expiryDateFmt = new Date(member.expiryDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
        const isExpired = new Date(member.expiryDate) < new Date().setHours(0,0,0,0);
        
        const avatarLetter = member.name.charAt(0).toUpperCase();
        
        let seatDisplayHTML = "";
        if (member.seatId === "non-reserved") {
            seatDisplayHTML = `
                <strong style="color: #fff;">Non-Reserved</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top:1px;">Flexible</div>
                <span class="badge general" style="display:block; width:fit-content; margin-top:2px;">
                    Non-Reserved
                </span>
            `;
        } else {
            const roomNum = seat ? seat.room : Math.ceil(parseInt(member.seatId.replace("seat_", "")) / 100);
            const localSeatNumber = seat ? seat.number : (parseInt(member.seatId.replace("seat_", "")) - (roomNum - 1) * 100);
            const plan = PLANS.find(p => p.id === member.planId);
            const isReserved = plan ? plan.type === "reserved" : (seat ? seat.type === "reserved" : false);
            seatDisplayHTML = `
                <strong style="color: #fff;">Seat ${localSeatNumber}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top:1px;">Room ${roomNum}</div>
                <span class="badge ${isReserved ? "reserved" : "general"}" style="display:block; width:fit-content; margin-top:2px;">
                    ${isReserved ? "Cabin" : "Non-Reserved"}
                </span>
            `;
        }
        
        tr.innerHTML = `
            <td>
                <div class="member-profile">
                    <div class="member-avatar">${avatarLetter}</div>
                    <div>
                        <div class="member-name">${member.name}</div>
                        <div class="member-phone">${member.phone}</div>
                    </div>
                </div>
            </td>
            <td>
                ${seatDisplayHTML}
            </td>
            <td>
                <div>₹${member.feeAmount}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 1px;">
                    ${PLANS.find(p => p.id === member.planId)?.name || 'Custom Plan'} (${member.paymentMethod || 'Cash'})
                </div>
            </td>
            <td>
                <div style="font-size: 0.85rem;">${startDateFmt} to ${expiryDateFmt}</div>
                <span style="font-size: 0.75rem; font-weight:600; color: ${isExpired ? 'var(--accent-rose)' : 'var(--text-muted)'}; margin-top:2px; display:inline-block;">
                    ${isExpired ? ' expired' : ' active'}
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
                    <button class="btn-icon-only btn-secondary" onclick="renewMembershipPrompt('${member.id}')" title="Renew Membership">
                        <i class="fa-solid fa-arrows-rotate" style="color: var(--accent-emerald);"></i>
                    </button>
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
            const seat = state.seats.find(s => s.id === req.seatId);
            const roomNum = seat ? seat.room : Math.ceil(parseInt(req.seatId.replace("seat_",""))/100);
            const globalSeatNum = parseInt(req.seatId.replace("seat_",""));
            const seatNum = seat ? seat.number : (globalSeatNum - (roomNum - 1) * 100);
            seatDetailsHTML = `<div style="font-size: 0.75rem; color: #fff; margin-top: 5px;">Requested: <strong>Room ${roomNum} - Seat ${seatNum}</strong></div>`;
        }
        
        tr.innerHTML = `
            <td>
                <div class="member-profile">
                    <div class="member-avatar" style="color: var(--accent-amber);">${req.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="member-name">${req.name}</div>
                        <div class="member-phone">${req.phone}</div>
                    </div>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top:5px;">
                    Father: <strong>${req.fatherName || 'N/A'}</strong> (${req.fatherPhone || 'N/A'})
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top:2px;">Submitted today at ${dateSubmitted}</div>
            </td>
            <td>
                <span class="badge ${req.seatType === 'reserved' ? 'reserved' : 'general'}">
                    ${req.seatType === 'reserved' ? 'Reserved' : 'Non-Reserved'}
                </span>
                ${seatDetailsHTML}
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px;">Pay via: <strong>${req.paymentMethod || 'Cash'}</strong></div>
            </td>
            <td><strong style="color: #fff;">${req.duration} Month(s)</strong></td>
            <td>
                <span style="font-size: 0.8rem; color: var(--text-muted); font-family: monospace;">Gov ID: ${req.govId || 'N/A'}</span>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Current: ${req.currentAddress}">
                    Addr: ${req.currentAddress || 'N/A'}
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
    updateDashboardKPIs();
    renderDashboardAlerts();
    renderSeatGrid();
    renderMemberTable();
    updatePendingBadge();
    renderPendingRequests();
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
    document.getElementById("modal-member-title").textContent = "Add New Member";
    document.getElementById("form-member").reset();
    document.getElementById("form-member").onsubmit = handleMemberFormSubmit;
    document.getElementById("edit-member-id").value = "";
    
    document.getElementById("m-start-date").value = new Date().toISOString().split('T')[0];
    
    onModalSeatTypeChange();
    openModal("modal-member");
}

function openEditMemberModal(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    document.getElementById("modal-member-title").textContent = "Edit Member Info";
    document.getElementById("edit-member-id").value = member.id;
    document.getElementById("form-member").onsubmit = handleMemberFormSubmit;
    
    document.getElementById("m-name").value = member.name;
    document.getElementById("m-phone").value = member.phone;
    document.getElementById("m-father-name").value = member.fatherName || "";
    document.getElementById("m-father-phone").value = member.fatherPhone || "";
    document.getElementById("m-current-address").value = member.currentAddress || "";
    document.getElementById("m-permanent-address").value = member.permanentAddress || "";
    
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
    document.getElementById("m-payment").value = member.paymentStatus;
    document.getElementById("m-payment-method").value = member.paymentMethod || "Cash";
    
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
    PLANS.filter(p => p.type === seatType).forEach(plan => {
        const opt = document.createElement("option");
        opt.value = plan.id;
        opt.textContent = `${plan.name} - ₹${plan.price}`;
        planSelect.appendChild(opt);
    });
    
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
    const planId = document.getElementById("m-plan").value;
    const plan = PLANS.find(p => p.id === planId);
    if (plan) {
        document.getElementById("m-fee-amount").value = plan.price;
    }
    calculateExpiryDate();
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

// Expiry date calculation
function calculateExpiryDate() {
    const startDateVal = document.getElementById("m-start-date").value;
    const planId = document.getElementById("m-plan").value;
    
    if (!startDateVal || !planId) return;
    
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return;
    
    const startDate = new Date(startDateVal);
    startDate.setMonth(startDate.getMonth() + plan.duration);
    
    document.getElementById("m-expiry-date").value = startDate.toISOString().split('T')[0];
}

// Add or update student
function handleMemberFormSubmit(event) {
    event.preventDefault();
    
    const editId = document.getElementById("edit-member-id").value;
    const name = document.getElementById("m-name").value.trim();
    const phone = document.getElementById("m-phone").value.trim();
    const fatherName = document.getElementById("m-father-name").value.trim();
    const fatherPhone = document.getElementById("m-father-phone").value.trim();
    const currentAddress = document.getElementById("m-current-address").value.trim();
    const permanentAddress = document.getElementById("m-permanent-address").value.trim();
    
    const emergencyName = document.getElementById("m-emergency-name").value.trim();
    const emergencyRelation = document.getElementById("m-emergency-relation").value;
    const emergencyPhone = document.getElementById("m-emergency-phone").value.trim();
    const targetExam = document.getElementById("m-target-exam").value;
    const dob = document.getElementById("m-dob").value;
    
    const seatId = document.getElementById("m-seat-id").value;
    const seatType = document.getElementById("m-seat-type").value;
    const planId = document.getElementById("m-plan").value;
    const govId = document.getElementById("m-gov-id").value.trim() || "N/A";
    const startDate = document.getElementById("m-start-date").value;
    const expiryDate = document.getElementById("m-expiry-date").value;
    const feeAmount = parseInt(document.getElementById("m-fee-amount").value);
    const paymentStatus = document.getElementById("m-payment").value;
    const paymentMethod = document.getElementById("m-payment-method").value;
    
    if (!seatId) {
        showToast("Cannot register: No seat assigned.", "error");
        return;
    }
    
    const plan = PLANS.find(p => p.id === planId);
    const duration = plan ? plan.duration : 1;
    
    let originalMember = null;
    let originalSeatId = null;

    if (editId) {
        originalMember = state.members.find(m => m.id === editId);
        if (originalMember) {
            originalSeatId = originalMember.seatId;
        }
    }
    
    const memberId = editId || `m_${Date.now()}`;
    const memberObj = {
        id: memberId,
        name: name,
        phone: phone,
        dob: dob,
        fatherName: fatherName,
        fatherPhone: fatherPhone,
        currentAddress: currentAddress,
        permanentAddress: permanentAddress,
        
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
        paymentStatus: paymentStatus,
        paymentMethod: paymentMethod,
        timestamp: editId ? originalMember.timestamp : Date.now()
    };
    
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
    
    // Save
    syncLocalToDatabase();
    closeModal("modal-member");
    showToast(editId ? "Member updated successfully!" : "Student registered successfully!", "success");
    
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
    syncLocalToDatabase();
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
    
    let seatText = "";
    if (member.seatId === "non-reserved") {
        seatText = "Non-Reserved (Flexible)";
    } else {
        const globalSeatNum = parseInt(member.seatId.replace('seat_', ''));
        const roomNum = Math.ceil(globalSeatNum / 100);
        const localSeatNum = globalSeatNum - (roomNum - 1) * 100;
        seatText = `Seat ${localSeatNum} (Room ${roomNum})`;
    }
    
    const libName = state.settings.libraryName || "The Study Cafe";
    const formattedExpiryDate = new Date(member.expiryDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    
    let daysText = "";
    if (daysDiff === 0) {
        daysText = "today";
    } else if (daysDiff === 1) {
        daysText = "tomorrow";
    } else if (daysDiff > 1) {
        daysText = `in ${daysDiff} days`;
    } else {
        daysText = `${Math.abs(daysDiff)} days ago`;
    }
    
    let message = "";
    if (daysDiff >= 0) {
        message = `Hello ${member.name},\n\nYour membership at ${libName} for *${seatText}* is expiring *${daysText}* on *${formattedExpiryDate}*.\n\nTo ensure uninterrupted access and retain your seat, please renew your membership at the reception desk.\n\nThank you!\n${libName}`;
    } else {
        message = `Hello ${member.name},\n\nYour membership at ${libName} for *${seatText}* expired *${daysText}* on *${formattedExpiryDate}*.\n\nTo continue using the library services and retain your seat, please renew your membership at the reception desk.\n\nThank you!\n${libName}`;
    }
    
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
        syncLocalToDatabase();
        showToast("Student membership removed.", "error");
        refreshUI();
    }
}

// Approve pending requests (Auto pre-fills preferred seat choices)
function approvePendingRequest(requestId) {
    const req = state.pending.find(p => p.id === requestId);
    if (!req) return;
    
    console.log("Approving request data:", req);
    
    openAddMemberModal();
    
    document.getElementById("m-name").value = req.name;
    document.getElementById("m-phone").value = req.phone;
    document.getElementById("m-father-name").value = req.fatherName || "";
    document.getElementById("m-father-phone").value = req.fatherPhone || "";
    document.getElementById("m-current-address").value = req.currentAddress || "";
    document.getElementById("m-permanent-address").value = req.permanentAddress || "";
    
    // Pre-fill new emergency contact & target exam fields
    document.getElementById("m-emergency-name").value = req.emergencyName || "";
    document.getElementById("m-emergency-relation").value = req.emergencyRelation || "Mother";
    document.getElementById("m-emergency-phone").value = req.emergencyPhone || "";
    document.getElementById("m-target-exam").value = req.targetExam || "UPSC";
    document.getElementById("m-start-date").value = req.expectedStartDate || new Date().toISOString().split('T')[0];
    document.getElementById("m-dob").value = req.dob || "";
    
    document.getElementById("m-seat-type").value = req.seatType;
    onModalSeatTypeChange();
    
    const matchingPlan = PLANS.find(p => p.type === req.seatType && p.duration === req.duration);
    if (matchingPlan) {
        document.getElementById("m-plan").value = matchingPlan.id;
    }
    
    document.getElementById("m-gov-id").value = req.govId || "";
    document.getElementById("m-fee-amount").value = req.feeAmount;
    document.getElementById("m-payment").value = "Paid";
    document.getElementById("m-payment-method").value = req.paymentMethod || "Cash";
    
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
                
                modalBody.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom:1px solid var(--border-color); padding-bottom:0.6rem;">
                            <strong style="font-size: 1.1rem; color: #fff;">Seat ${seat.number} (Room ${seat.room})</strong>
                            <span class="badge ${seat.type === 'reserved' ? 'reserved' : 'general'}">${seat.type === 'reserved' ? 'Reserved' : 'Non-Reserved'}</span>
                        </div>
                        <div style="display: flex; gap: 1rem; align-items: flex-start; justify-content: space-between;">
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">Occupant:</div>
                                <strong style="font-size: 1.15rem; color:#fff; display:block; margin-top:0.15rem;">${member.name}</strong>
                                <span style="font-size: 0.8rem; color: var(--text-muted);">${member.phone}</span>
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
                                <span style="font-size: 0.7rem; color: var(--text-muted); display:block;">Gov ID</span>
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
    
    syncLocalToDatabase();
    closeModal("modal-seat-actions");
    showToast(`Seat ${seat.number} force vacated.`, "info");
    refreshUI();
}

function toggleSeatMaintenance() {
    const seat = state.seats.find(s => s.id === selectedSeatIdForActions);
    if (!seat) return;
    
    const isCurrentlyBlocked = seat.status === "maintenance";
    
    if (isCurrentlyBlocked) {
        seat.status = "vacant";
        seat.assignedMemberId = null;
        showToast(`Seat ${seat.number} is restored back to service.`, "success");
    } else {
        const activeOccupantId = seat.assignedMemberId;
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
    
    syncLocalToDatabase();
    closeModal("modal-seat-actions");
    refreshUI();
}

// Generate receipt invoice
function openReceiptModal(memberId) {
    currentReceiptMemberId = memberId;
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    const seat = state.seats.find(s => s.id === member.seatId);
    let roomDisplay = "";
    let seatDisplay = "";
    
    if (member.seatId === "non-reserved") {
        roomDisplay = "N/A";
        seatDisplay = "Non-Reserved";
    } else {
        const roomNum = seat ? seat.room : Math.ceil(parseInt(member.seatId.replace("seat_", "")) / 100);
        const seatNum = seat ? seat.number : (parseInt(member.seatId.replace("seat_", "")) - (roomNum - 1) * 100);
        const plan = PLANS.find(p => p.id === member.planId);
        const isReserved = plan ? plan.type === "reserved" : (seat ? seat.type === "reserved" : false);
        roomDisplay = `Room ${roomNum}`;
        seatDisplay = `Seat ${seatNum} (${isReserved ? 'Reserved' : 'Non-Reserved'})`;
    }
    
    const startDateFmt = new Date(member.startDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
    const expiryDateFmt = new Date(member.expiryDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
    
    const receiptNo = `TSC-${member.timestamp.toString().slice(-6)}`;
    
    const modalBody = document.getElementById("receipt-modal-body");
    modalBody.innerHTML = `
        <div style="font-family: monospace; font-size: 0.85rem; line-height: 1.5; color: #1e293b;">
            <div style="text-align: center; margin-bottom: 0.8rem; border-bottom: 1px dashed #cbd5e1; padding-bottom:0.5rem;">
                <h3 style="font-size: 1.3rem; font-weight: 800; color: #0f172a; margin: 0; letter-spacing:-0.03em;">${state.settings.libraryName.toUpperCase()}</h3>
                <p style="font-size: 0.7rem; color: #64748b; margin-top: 0.15rem; font-family: sans-serif;">${state.settings.address} • Mob: ${state.settings.phone}</p>
            </div>
            
            <div style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.5rem; margin-bottom: 0.5rem; font-size: 0.8rem;">
                <div style="display:flex; justify-content:space-between;"><span><strong>Receipt No:</strong> ${receiptNo}</span><span><strong>Date:</strong> ${new Date(member.timestamp).toLocaleDateString('en-IN')}</span></div>
            </div>
            
            <div style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.5rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                <div><strong>Student:</strong> ${member.name}</div>
                <div><strong>Date of Birth:</strong> ${member.dob ? new Date(member.dob).toLocaleDateString('en-IN') : 'N/A'}</div>
                <div><strong>Phone:</strong> ${member.phone}</div>
                <div><strong>Target Exam:</strong> ${member.targetExam || 'N/A'}</div>
                <div><strong>Father's Name:</strong> ${member.fatherName || 'N/A'}</div>
                <div><strong>Father's Mobile:</strong> ${member.fatherPhone || 'N/A'}</div>
                <div><strong>Emergency Contact:</strong> ${member.emergencyName || 'N/A'} (${member.emergencyRelation || 'N/A'})</div>
                <div><strong>Emergency Phone:</strong> ${member.emergencyPhone || 'N/A'}</div>
            </div>
            
            <div style="border-bottom: 1px dashed #cbd5e1; padding-bottom: 0.5rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem;">
                <div><strong>Room No:</strong> ${roomDisplay}</div>
                <div><strong>Seat Number:</strong> ${seatDisplay}</div>
                <div><strong>Validity:</strong> ${startDateFmt} to ${expiryDateFmt}</div>
            </div>
            
            <div style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; font-size: 0.95rem; font-weight: bold; color: #0f172a;">
                <span>Total Fee Paid:</span>
                <span>₹${member.feeAmount}</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                <span>Payment Mode:</span>
                <span><strong>${member.paymentMethod || 'Cash'}</strong></span>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.5rem;">
                <span>Payment Status:</span>
                <span style="color: ${member.paymentStatus === 'Paid' ? '#10b981' : '#f59e0b'}; font-weight: bold;">${member.paymentStatus}</span>
            </div>
            
            <div style="text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 0.5rem; margin-top: 0.5rem; color: #64748b; font-size: 0.72rem; font-family: sans-serif; line-height: 1.3;">
                Thank you for studying with us!<br>
                For support, contact us at: ${state.settings.phone}
            </div>
        </div>
    `;
    
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
            <title>Membership Receipt - The Study Cafe</title>
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
    
    const seat = state.seats.find(s => s.id === member.seatId);
    let roomDisplay = "";
    let seatDisplay = "";
    
    if (member.seatId === "non-reserved") {
        roomDisplay = "N/A";
        seatDisplay = "Non-Reserved";
    } else {
        const roomNum = seat ? seat.room : Math.ceil(parseInt(member.seatId.replace("seat_", "")) / 100);
        const seatNum = seat ? seat.number : (parseInt(member.seatId.replace("seat_", "")) - (roomNum - 1) * 100);
        const plan = PLANS.find(p => p.id === member.planId);
        const isReserved = plan ? plan.type === "reserved" : (seat ? seat.type === "reserved" : false);
        roomDisplay = `Room ${roomNum}`;
        seatDisplay = `Seat ${seatNum} (${isReserved ? 'Reserved' : 'Non-Reserved'})`;
    }
    
    const startDateFmt = new Date(member.startDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
    const expiryDateFmt = new Date(member.expiryDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
    const receiptNo = `TSC-${member.timestamp.toString().slice(-6)}`;
    
    // Construct WhatsApp message template
    const message = `*${state.settings.libraryName.toUpperCase()}* ☕
------------------------------
*MEMBERSHIP RECEIPT*
------------------------------
*Receipt No:* ${receiptNo}
*Date:* ${new Date(member.timestamp).toLocaleDateString('en-IN')}

*Student Details:*
• Name: ${member.name}
• Date of Birth: ${member.dob ? new Date(member.dob).toLocaleDateString('en-IN') : 'N/A'}
• Phone: ${member.phone}
• Target Exam/Course: ${member.targetExam || 'N/A'}
• Father's Name: ${member.fatherName || 'N/A'}
• Father's Mobile: ${member.fatherPhone || 'N/A'}
• Emergency Contact: ${member.emergencyName || 'N/A'} (${member.emergencyRelation || 'N/A'}) - ${member.emergencyPhone || 'N/A'}

*Seat & Validity:*
• Room Number: ${roomDisplay}
• Seat Number: ${seatDisplay}
• Validity Period: ${startDateFmt} to ${expiryDateFmt}

*Billing Info:*
• Fee Paid: ₹${member.feeAmount}
• Payment Method: ${member.paymentMethod || 'Cash'}
• Status: *${member.paymentStatus}*
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

// Generate printable QR Poster for desk registration
let qrCodeGeneratorInstance = null;

function updateRegistrationQR() {
    let hostUrl = window.location.href;
    if (hostUrl.includes("index.html")) {
        hostUrl = hostUrl.replace("index.html", "register.html");
    } else if (hostUrl.endsWith("/")) {
        hostUrl = hostUrl + "register.html";
    } else {
        const idx = hostUrl.lastIndexOf("/");
        hostUrl = hostUrl.substring(0, idx + 1) + "register.html";
    }
    
    const config = getFirebaseConfig();
    const isCustom = localStorage.getItem("custom_firebase_config") !== null;
    
    let qrUrl = hostUrl;
    if (isCustom) {
        const configStr = btoa(JSON.stringify(config));
        qrUrl += `?config=${configStr}`;
    }
    
    document.getElementById("qr-target-url").value = qrUrl;
    
    const qrHolder = document.getElementById("qrcode-display");
    qrHolder.innerHTML = "";
    
    try {
        qrCodeGeneratorInstance = new QRCode(qrHolder, {
            text: qrUrl,
            width: 180,
            height: 180,
            colorDark : "#0a0e17",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    } catch(err) {
        console.error("QR Code library failing:", err);
    }
}

// Re-generate QR manually
function updateRegistrationQRFromInput() {
    const inputUrl = document.getElementById("qr-target-url").value;
    const qrHolder = document.getElementById("qrcode-display");
    qrHolder.innerHTML = "";
    
    qrCodeGeneratorInstance = new QRCode(qrHolder, {
        text: inputUrl,
        width: 180,
        height: 180,
        colorDark : "#0a0e17",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });
    
    showToast("QR Code updated.", "success");
}

// Print QR code frame
function printQRCode() {
    const qrDataUrl = document.querySelector("#qrcode-display canvas").toDataURL("image/png");
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Print QR Poster - The Study Cafe</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    text-align: center;
                    padding: 3rem;
                    color: #0b0f19;
                }
                .poster-card {
                    border: 6px solid #10b981;
                    padding: 3rem;
                    border-radius: 25px;
                    display: inline-block;
                    max-width: 500px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
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
                <h1>${state.settings.libraryName}</h1>
                <h3>Premium Focused Study Library</h3>
                
                <img class="qr-img" src="${qrDataUrl}" alt="Registration QR">
                
                <p class="p-instruction">
                    <strong>Scan to Book / Register</strong><br>
                    Please scan the QR code to fill in your registration form details.
                </p>
                
                <div class="footer">
                    ${state.settings.address}
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
    downloadAnchor.setAttribute("download", `study_cafe_backup_${new Date().toISOString().split('T')[0]}.json`);
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
                if (importedState.seats.length !== 400) {
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
    if (!confirm("Confirm again: Do you really want to reset all 400 seats to vacant?")) {
        return;
    }
    
    state.members = [];
    state.pending = [];
    state.seats = generateDefaultSeats();
    
    if (!isOfflineMode && database) {
        database.ref("pending_bookings").remove();
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
    document.getElementById("qr-lib-title").textContent = newName;
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
