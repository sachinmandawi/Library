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

// Seating pricing structures
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
let broadcastChannel = null;
let allSeats = []; // Realtime synced seats from Firebase
let compressedPhotoBase64 = null; // Store compressed student photo in memory

// Load initial seat state from shared localStorage if available
try {
    const sharedState = JSON.parse(localStorage.getItem("study_cafe_state"));
    if (sharedState && sharedState.seats && sharedState.seats.length > 0) {
        allSeats = sharedState.seats;
    }
} catch(e){}

// Initialize Broadcast Channel
if (window.BroadcastChannel) {
    broadcastChannel = new BroadcastChannel('study_cafe_db');
    broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === "SEATS_UPDATED") {
            allSeats = event.data.seats;
            onStudentRoomOrTypeChange();
        }
    };
}

// Listen to storage events for cross-tab updates
window.addEventListener("storage", (event) => {
    if (event.key === "study_cafe_state") {
        try {
            const sharedState = JSON.parse(event.newValue);
            if (sharedState && sharedState.seats) {
                allSeats = sharedState.seats;
                onStudentRoomOrTypeChange();
            }
        } catch(e){}
    }
});

// Extract configuration from URL query params or localStorage
function getFirebaseConfig() {
    const urlParams = new URLSearchParams(window.location.search);
    const configParam = urlParams.get('config');
    if (configParam) {
        try {
            const decoded = atob(configParam);
            if (decoded.startsWith('{')) {
                return JSON.parse(decoded);
            } else {
                // Delimited format: apiKey|projectId|databaseURL|appId
                const parts = decoded.split('|');
                if (parts.length >= 3) {
                    const apiKey = parts[0];
                    const projectId = parts[1];
                    const databaseURL = parts[2];
                    const appId = parts[3] || "";
                    return {
                        apiKey: apiKey,
                        projectId: projectId,
                        databaseURL: databaseURL,
                        appId: appId,
                        authDomain: projectId ? `${projectId}.firebaseapp.com` : "",
                        storageBucket: projectId ? `${projectId}.appspot.com` : ""
                    };
                }
            }
        } catch (e) {
            console.error("Failed to decode URL config:", e);
        }
    }
    
    let storedConfig = null;
    try {
        storedConfig = localStorage.getItem('custom_firebase_config');
    } catch(e) {}
    
    if (storedConfig) {
        try {
            const parsed = JSON.parse(storedConfig);
            // If it's the old sandbox demo key, clear it so we connect to the correct database
            if (parsed.apiKey === "AIzaSyA4c3BfU2FuZGJveEtleS1EZW1vMTIzNDU") {
                localStorage.removeItem("custom_firebase_config");
                return defaultFirebaseConfig;
            }
            return parsed;
        } catch(e) {}
    }
    
    return defaultFirebaseConfig;
}

// Initialize database connection
function initDatabase() {
    const config = getFirebaseConfig();
    
    if (window.firebase && window.firebase.initializeApp) {
        try {
            const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
            database = app.database();
            console.log("Firebase Database initialized successfully.");
            
            // Listen to real-time seat status for vacancies display
            setupSeatsListener();
        } catch (error) {
            console.warn("Failed to connect to Firebase. Operating in Local Offline Mode.", error);
            onStudentRoomOrTypeChange(); // Load offline seats fallback
        }
    } else {
        console.warn("Firebase SDK not loaded. Operating in Local Offline Mode.");
        onStudentRoomOrTypeChange(); // Load offline seats fallback
    }
}

// Fetch seats layout from Firebase to display vacancies
function setupSeatsListener() {
    if (!database) return;
    
    database.ref("study_cafe_system/seats").on("value", snapshot => {
        if (snapshot.exists()) {
            allSeats = snapshot.val();
            onStudentRoomOrTypeChange();
        }
    }, err => {
        console.warn("Realtime seat listener permission blocked. Using offline fallback.", err);
        onStudentRoomOrTypeChange();
    });
}

let selectedSeatId = null;

// Handle Room, Seating type, and plan duration changes
function onStudentRoomOrTypeChange() {
    const seatType = document.getElementById("s-seat-type").value;
    const duration = document.getElementById("s-duration").value;
    
    // 1. Update Pricing display
    const price = PLANS_PRICING[seatType][duration] || 0;
    document.getElementById("student-fee-price").textContent = `₹${price}`;
    
    const flexMsg = document.getElementById("s-flexible-msg");
    const seatPicker = document.getElementById("s-seat-picker-container");
    const badge = document.getElementById("student-selected-seat-badge");
    const seatSelect = document.getElementById("s-seat-id");
    
    if (seatType === "non-reserved") {
        if (flexMsg) flexMsg.style.display = "block";
        if (seatPicker) seatPicker.style.display = "none";
        
        selectedSeatId = "non-reserved";
        if (badge) {
            badge.textContent = "Non-Reserved";
            badge.style.color = "var(--accent-emerald)";
            badge.style.borderColor = "var(--accent-emerald)";
        }
        if (seatSelect) {
            seatSelect.innerHTML = '<option value="non-reserved" selected>Non-Reserved</option>';
        }
        return;
    } else {
        if (flexMsg) flexMsg.style.display = "none";
        if (seatPicker) seatPicker.style.display = "block";
    }

    // Reset selection state when filters change
    selectedSeatId = null;
    if (badge) {
        badge.textContent = "None selected";
        badge.style.color = "var(--text-muted)";
        badge.style.borderColor = "var(--border-color)";
    }
    
    if (seatSelect) {
        seatSelect.innerHTML = "";
        const emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "";
        seatSelect.appendChild(emptyOpt);
    }
    
    // 2. Populate Vacant Seats Array
    let seatsData = allSeats;
    if (seatsData.length === 0) {
        // Fallback to generating default seats offline if DB is disconnected
        seatsData = [];
        for (let i = 1; i <= 400; i++) {
            const r = Math.ceil(i / 100);
            const pos = i - (r - 1) * 100;
            seatsData.push({
                id: `seat_${i}`,
                number: pos,
                room: r,
                type: "general",
                status: "vacant"
            });
        }
    }
    
    const selectedRoom = parseInt(document.getElementById("s-room").value) || 1;
    
    // 3. Render student visual grid picker
    renderStudentSeatGrid(seatsData, selectedRoom, seatType);
}

function renderStudentSeatGrid(seatsData, selectedRoom, seatType) {
    const gridContainer = document.getElementById("student-seat-grid");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";
    
    // Filter seats for the selected room
    const roomSeats = seatsData.filter(s => s.room === selectedRoom);
    
    // Sort seats by seat number
    roomSeats.sort((a, b) => a.number - b.number);
    
    roomSeats.forEach(seat => {
        const seatBox = document.createElement("div");
        seatBox.className = "student-seat-box";
        seatBox.textContent = seat.number; // Local seat number in room 1-100
        
        const isOccupied = seat.status === "occupied";
        const isMaintenance = seat.status === "maintenance";
        
        if (isOccupied) {
            seatBox.classList.add("occupied");
            seatBox.title = `Seat ${seat.number} is Occupied`;
        } else if (isMaintenance) {
            seatBox.classList.add("maintenance");
            seatBox.title = `Seat ${seat.number} is under Maintenance`;
        } else {
            // Vacant -> Clickable!
            seatBox.classList.add("vacant");
            seatBox.title = `Seat ${seat.number} (Available)`;
            
            // Check if this seat is currently selected
            if (selectedSeatId === seat.id) {
                seatBox.classList.add("selected");
            }
            
            seatBox.onclick = () => {
                // Set selection
                selectStudentSeat(seat.id, seat.number);
                
                // Highlight active in grid
                document.querySelectorAll(".student-seat-box.selected").forEach(el => {
                    el.classList.remove("selected");
                });
                seatBox.classList.add("selected");
            };
        }
        
        gridContainer.appendChild(seatBox);
    });
}

function selectStudentSeat(seatId, seatNumber) {
    selectedSeatId = seatId;
    
    // Sync to hidden select input
    const seatSelect = document.getElementById("s-seat-id");
    seatSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = seatId;
    opt.textContent = `Seat ${seatNumber}`;
    opt.selected = true;
    seatSelect.appendChild(opt);
    
    // Update badge text
    const badge = document.getElementById("student-selected-seat-badge");
    if (badge) {
        badge.textContent = `Seat ${seatNumber}`;
        badge.style.color = "var(--accent-blue)";
        badge.style.borderColor = "var(--accent-blue)";
        badge.style.boxShadow = "0 0 10px rgba(59, 130, 246, 0.1)";
    }
}

// Reset form view back to inputs
function resetFormView() {
    document.getElementById("student-booking-form").reset();
    compressedPhotoBase64 = null;
    document.getElementById("s-photo-placeholder").style.display = "block";
    const previewImg = document.getElementById("s-photo-preview");
    previewImg.src = "";
    previewImg.style.display = "none";
    
    const dateInput = document.getElementById("s-start-date");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    onStudentRoomOrTypeChange();
    document.getElementById("form-container").style.display = "block";
    document.getElementById("success-container").style.display = "none";
}

// Form Submission handler
function submitStudentForm(event) {
    event.preventDefault();
    
    const name = document.getElementById("s-name").value.trim();
    const phone = document.getElementById("s-phone").value.trim();
    const dob = document.getElementById("s-dob").value;
    const fatherName = document.getElementById("s-father-name").value.trim();
    const fatherPhone = document.getElementById("s-father-phone").value.trim();
    const currentAddress = document.getElementById("s-current-address").value.trim();
    const permanentAddress = document.getElementById("s-permanent-address").value.trim();
    
    const emergencyName = document.getElementById("s-emergency-name").value.trim();
    const emergencyRelation = document.getElementById("s-emergency-relation").value;
    const emergencyPhone = document.getElementById("s-emergency-phone").value.trim();
    
    const targetExam = document.getElementById("s-target-exam").value;
    const expectedStartDate = document.getElementById("s-start-date").value;
    
    const seatType = document.getElementById("s-seat-type").value;
    const durationMonths = parseInt(document.getElementById("s-duration").value);
    const govId = document.getElementById("s-gov-id").value.trim() || "N/A";
    const seatId = document.getElementById("s-seat-id").value;
    
    if (!seatId) {
        alert("Please tap an available seat in the grid layout to select your preferred seat number before submitting.");
        return;
    }
    
    const paymentMethodEl = document.querySelector('input[name="s-payment-method"]:checked');
    const paymentMethod = paymentMethodEl ? paymentMethodEl.value : "Cash";
    
    const feeAmount = PLANS_PRICING[seatType][durationMonths.toString()];
    
    const bookingData = {
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
        expectedStartDate: expectedStartDate,
        
        seatType: seatType,
        duration: durationMonths,
        govId: govId,
        seatId: seatId, // requested seat ID choice
        paymentMethod: paymentMethod,
        feeAmount: feeAmount,
        photo: compressedPhotoBase64, // Saved compressed Base64 photo
        timestamp: Date.now(),
        status: "pending"
    };
    
    const submitBtn = document.getElementById("btn-submit-booking");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
    
    let hasSubmitted = false;
    const timeoutId = setTimeout(() => {
        if (!hasSubmitted) {
            hasSubmitted = true;
            console.warn("Firebase submission timed out. Falling back to local offline mode.");
            submitOffline(bookingData);
        }
    }, 15000); // 15 seconds timeout
    
    if (database) {
        try {
            const newRef = database.ref("pending_bookings").push();
            bookingData.id = newRef.key;
            newRef.set(bookingData)
                .then(() => {
                    if (!hasSubmitted) {
                        clearTimeout(timeoutId);
                        hasSubmitted = true;
                        showSuccessScreen(name, false);
                    }
                })
                .catch(error => {
                    console.error("Firebase submit error:", error);
                    if (!hasSubmitted) {
                        clearTimeout(timeoutId);
                        hasSubmitted = true;
                        submitOffline(bookingData);
                    }
                });
        } catch (err) {
            console.error("Firebase synchronous write exception:", err);
            if (!hasSubmitted) {
                clearTimeout(timeoutId);
                hasSubmitted = true;
                submitOffline(bookingData);
            }
        }
    } else {
        clearTimeout(timeoutId);
        submitOffline(bookingData);
    }
}

// Handle offline submission
function submitOffline(bookingData) {
    bookingData.id = "local_" + Date.now();
    
    if (broadcastChannel) {
        broadcastChannel.postMessage({
            type: "NEW_BOOKING_REQUEST",
            data: bookingData
        });
    }
    
    let localPending = [];
    try {
        localPending = JSON.parse(localStorage.getItem("offline_pending_bookings") || "[]");
    } catch(e){}
    
    localPending.push(bookingData);
    try {
        localStorage.setItem("offline_pending_bookings", JSON.stringify(localPending));
    } catch(e){}
    
    showSuccessScreen(bookingData.name, true);
}

// Display confirmation view
function showSuccessScreen(studentName, isOffline = false) {
    document.getElementById("success-student-name").textContent = studentName;
    document.getElementById("success-student-name-2").textContent = studentName;
    
    const warningEl = document.getElementById("success-offline-warning");
    if (warningEl) {
        warningEl.style.display = isOffline ? "block" : "none";
    }
    
    document.getElementById("form-container").style.display = "none";
    document.getElementById("success-container").style.display = "block";
    
    const submitBtn = document.getElementById("btn-submit-booking");
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Booking Request';
}

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
    initDatabase();
    const dateInput = document.getElementById("s-start-date");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Add image input change listener for compression
    const photoInput = document.getElementById("s-photo");
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
                    
                    compressedPhotoBase64 = canvas.toDataURL("image/jpeg", 0.7);
                    
                    // Update visual UI preview
                    const placeholder = document.getElementById("s-photo-placeholder");
                    if (placeholder) placeholder.style.display = "none";
                    
                    const previewImg = document.getElementById("s-photo-preview");
                    if (previewImg) {
                        previewImg.src = compressedPhotoBase64;
                        previewImg.style.display = "block";
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
});
