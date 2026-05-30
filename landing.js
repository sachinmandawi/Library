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

// Render static seat box for Room 1 preview
function createStaticSeatBox(seat) {
    const seatBox = document.createElement("div");
    seatBox.className = "student-seat-box";
    seatBox.textContent = seat.number;
    
    const isOccupied = seat.status === "occupied";
    const isMaintenance = seat.status === "maintenance";
    
    if (isOccupied) {
        seatBox.classList.add("occupied");
        seatBox.title = `Seat ${seat.number} is Occupied`;
    } else if (isMaintenance) {
        seatBox.classList.add("maintenance");
        seatBox.title = `Seat ${seat.number} is under Maintenance`;
    } else {
        seatBox.classList.add("vacant");
        seatBox.title = `Seat ${seat.number} (Available)`;
    }
    return seatBox;
}

// Render room 1 physical seating plan dynamically in home page gallery
function renderHomeSeatingPlan(seatsData) {
    const gridContainer = document.getElementById("home-physical-map-container");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";
    
    let room1Seats = [];
    if (seatsData) {
        const allSeats = Array.isArray(seatsData) ? seatsData : Object.values(seatsData);
        room1Seats = allSeats.filter(s => s && s.room === 1 && s.number <= 69);
    }
    
    // Realistic fallback mock statuses if room 1 seats count is not matching 69
    if (room1Seats.length < 69) {
        room1Seats = [];
        const mockStatuses = [
            "vacant", "vacant", "occupied", "vacant", "occupied", "occupied", "vacant", "vacant", "occupied", "vacant", 
            "vacant", "occupied", "occupied", "vacant", "vacant", "occupied", "vacant", // 1-17 (17 seats)
            "occupied", "vacant", "vacant", "occupied", "vacant", "occupied", "occupied", "vacant", "vacant", "maintenance", 
            "vacant", "occupied", "vacant", "vacant", "occupied", // 18-32 (15 seats)
            "occupied", "vacant", "occupied", "vacant", "vacant", "occupied", "vacant", "vacant", "maintenance", "occupied", 
            "vacant", "vacant", "occupied", "vacant", "occupied", // 33-47 (15 seats)
            "occupied", "vacant", "vacant", "occupied", "vacant", "vacant", "occupied", "vacant", "vacant", "occupied", 
            "vacant", "occupied", "occupied", "vacant", "vacant", "occupied", "vacant", "occupied", // 48-65 (18 seats)
            "vacant", "occupied", "vacant", "occupied" // 66-69 (4 seats)
        ];
        for (let i = 1; i <= 69; i++) {
            room1Seats.push({
                id: `seat_${i}`,
                number: i,
                room: 1,
                type: "general",
                status: mockStatuses[i - 1] || "vacant"
            });
        }
    }
    
    // Sort roomSeats by number to ensure they are sequential
    room1Seats.sort((a, b) => a.number - b.number);
    
    const container = document.createElement("div");
    container.className = "physical-layout-container";
    
    // 1. Top Row (66 to 69 - Ordered right 66 to left 69 -> 69, 68, 67, 66)
    const topRow = document.createElement("div");
    topRow.className = "layout-row top-row";
    const topBlock = document.createElement("div");
    topBlock.className = "top-block";
    
    // Slicing 66 to 69 and reversing it
    const topSlices = room1Seats.slice(65, 69).reverse();
    topSlices.forEach(seat => {
        topBlock.appendChild(createStaticSeatBox(seat));
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
    const leftSlices = room1Seats.slice(0, 17).reverse();
    leftSlices.forEach(seat => {
        leftCol.appendChild(createStaticSeatBox(seat));
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
    const midLeftSlices = room1Seats.slice(17, 32);
    midLeftSlices.forEach(seat => {
        midLeftCol.appendChild(createStaticSeatBox(seat));
    });
    midDouble.appendChild(midLeftCol);
    
    // Partition line
    const partition = document.createElement("div");
    partition.className = "layout-partition";
    midDouble.appendChild(partition);
    
    // Middle Right (33 to 47 - Bottom to top -> Reversed 47 down to 33)
    const midRightCol = document.createElement("div");
    midRightCol.className = "layout-column mid-right-column";
    const midRightSlices = room1Seats.slice(32, 47).reverse();
    midRightSlices.forEach(seat => {
        midRightCol.appendChild(createStaticSeatBox(seat));
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
    const rightSlices = room1Seats.slice(47, 65).reverse();
    rightSlices.forEach(seat => {
        rightCol.appendChild(createStaticSeatBox(seat));
    });
    middleSection.appendChild(rightCol);
    
    container.appendChild(middleSection);
    
    // 4. Bottom Walkway & Gate
    const bottomSection = document.createElement("div");
    bottomSection.className = "layout-bottom-section";
    
    const gate = document.createElement("div");
    gate.className = "layout-gate";
    gate.textContent = "Gate 🚪";
    bottomSection.appendChild(gate);
    
    const bottomWalkway = document.createElement("div");
    bottomWalkway.className = "layout-walkway horizontal-walkway bottom-walkway";
    bottomWalkway.textContent = "Walkway";
    bottomSection.appendChild(bottomWalkway);
    
    container.appendChild(bottomSection);
    
    gridContainer.appendChild(container);
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
                    
                    const seatsArray = Array.isArray(seats) ? seats : Object.values(seats);
                    seatsArray.forEach(seat => {
                        if (seat) {
                            if (seat.status === "vacant") {
                                vacant++;
                            } else {
                                occupied++;
                            }
                        }
                    });
                    
                    // Fallback to total 400 seats if DB is partially loaded
                    if (vacant + occupied < 10) {
                        loadOfflineFallback();
                    } else {
                        updateStatsUI(vacant, occupied);
                        renderHomeSeatingPlan(seats);
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
                    if (seat) {
                        if (seat.status === "vacant") {
                            vacant++;
                        } else {
                            occupied++;
                        }
                    }
                });
                updateStatsUI(vacant, occupied);
                renderHomeSeatingPlan(state.seats);
                return;
            }
        }
    } catch(e){}
    
    // Default static fallback if completely offline
    updateStatsUI(120, 280);
    renderHomeSeatingPlan(null);
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

// Complaint Modal Control
window.openComplaintModal = function(e) {
    if (e) e.preventDefault();
    const successView = document.getElementById("complaint-success-view");
    const formView = document.getElementById("complaint-form");
    if (successView) successView.style.display = "none";
    if (formView) {
        formView.style.display = "block";
        formView.reset();
    }
    const modal = document.getElementById("complaint-modal");
    if (modal) modal.style.display = "flex";
};

window.closeComplaintModal = function() {
    const modal = document.getElementById("complaint-modal");
    if (modal) modal.style.display = "none";
};

// Complaint Submit Handler
window.handleComplaintSubmit = function(e) {
    if (e) e.preventDefault();
    
    const name = document.getElementById("c-name").value.trim();
    const phone = document.getElementById("c-phone").value.trim();
    const room = document.getElementById("c-room").value;
    const seat = document.getElementById("c-seat").value.trim();
    const category = document.getElementById("c-category").value;
    const description = document.getElementById("c-desc").value.trim();
    
    if (!name || !phone || !room || !category || !description) {
        alert("Please fill in all required fields.");
        return;
    }
    
    // Generate ticket details
    const ticketId = "TKT-" + Math.floor(100 + Math.random() * 900) + "-" + Math.floor(10 + Math.random() * 90);
    const timestamp = new Date().toISOString();
    
    const complaintData = {
        ticketId: ticketId,
        studentName: name,
        phone: phone,
        room: parseInt(room),
        seatNumber: seat ? parseInt(seat) : "",
        category: category,
        description: description,
        status: "pending",
        timestamp: timestamp,
        adminNotes: ""
    };
    
    // Check if database is initialized
    if (database) {
        database.ref("study_cafe_system/complaints").push(complaintData)
            .then(() => {
                showComplaintSuccess(ticketId);
            })
            .catch(err => {
                console.error("Failed to save complaint to database:", err);
                alert("Failed to submit issue. Please try again.");
            });
    } else {
        // Local mock save / offline fallback
        console.log("Database offline. Mock ticket raised:", complaintData);
        // Save to offline state in localStorage
        try {
            const localState = JSON.parse(localStorage.getItem("study_cafe_state") || "{}");
            if (!localState.complaints) localState.complaints = [];
            localState.complaints.push(complaintData);
            localStorage.setItem("study_cafe_state", JSON.stringify(localState));
        } catch(e){}
        
        showComplaintSuccess(ticketId);
    }
};

function showComplaintSuccess(ticketId) {
    const formView = document.getElementById("complaint-form");
    const successView = document.getElementById("complaint-success-view");
    const ticketIdEl = document.getElementById("success-ticket-id");
    
    if (formView) formView.style.display = "none";
    if (ticketIdEl) ticketIdEl.textContent = ticketId;
    if (successView) successView.style.display = "block";
}

// Initialize landing components on load
window.addEventListener("DOMContentLoaded", () => {
    loadCustomSettings();
    initPricingToggle();
    initFAQAccordion();
    initSeatsListener();
});
