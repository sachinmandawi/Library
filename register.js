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
let isDemo = false;
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
    let price = PLANS_PRICING[seatType][duration] || 0;
    if (isDemo) price = 0;
    document.getElementById("student-fee-price").textContent = `₹${price}`;
    
    const amountPaidEl = document.getElementById("s-amount-paid");
    const balanceAmountEl = document.getElementById("s-balance-amount");
    if (amountPaidEl && balanceAmountEl) {
        amountPaidEl.value = price;
        balanceAmountEl.value = 0;
        amountPaidEl.max = price;
        if (isDemo) {
            amountPaidEl.disabled = true;
        }
    }
    
    const flexMsg = document.getElementById("s-flexible-msg");
    const seatPicker = document.getElementById("s-seat-picker-container");
    const badge = document.getElementById("student-selected-seat-badge");
    const seatSelect = document.getElementById("s-seat-id");
    
    if (seatType === "non-reserved") {
        if (flexMsg) flexMsg.style.display = "block";
        
        if (isDemo) {
            if (seatPicker) seatPicker.style.display = "block";
            selectedSeatId = "non-reserved";
            if (badge) {
                badge.textContent = "Non-Reserved Seating (Viewing Only)";
                badge.style.color = "var(--accent-emerald)";
                badge.style.borderColor = "var(--accent-emerald)";
            }
            if (seatSelect) {
                seatSelect.innerHTML = '<option value="non-reserved" selected>Non-Reserved</option>';
            }
            // Populate seats data so they can see live room occupancy/availability
            const selectedRoom = parseInt(document.getElementById("s-room").value) || 1;
            renderStudentSeatGrid(allSeats, selectedRoom, "reserved");
        } else {
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
        let seatIndex = 1;
        // Generate Room 1: 69 seats
        for (let s = 1; s <= 69; s++) {
            seatsData.push({
                id: `seat_${seatIndex++}`,
                number: s,
                room: 1,
                type: "general",
                status: "vacant"
            });
        }
        // Generate Room 2, 3, 4: 100 seats each
        for (let r = 2; r <= 4; r++) {
            for (let s = 1; s <= 100; s++) {
                seatsData.push({
                    id: `seat_${seatIndex++}`,
                    number: s,
                    room: r,
                    type: "general",
                    status: "vacant"
                });
            }
        }
    }
    
    const selectedRoom = parseInt(document.getElementById("s-room").value) || 1;
    
    // 3. Render student visual grid picker
    renderStudentSeatGrid(seatsData, selectedRoom, seatType);
}

function createStudentSeatBox(seat) {
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
        
        if (!isDemo) {
            seatBox.onclick = () => {
                const seatTypeEl = document.getElementById("s-seat-type");
                if (seatTypeEl && seatTypeEl.value === "non-reserved") {
                    seatTypeEl.value = "reserved";
                    onStudentRoomOrTypeChange();
                }
                
                selectStudentSeat(seat.id, seat.number);
                
                // Highlight active in grid
                document.querySelectorAll(".student-seat-box.selected").forEach(el => {
                    el.classList.remove("selected");
                });
                seatBox.classList.add("selected");
            };
        }
    }
    return seatBox;
}

function renderStudentPhysicalLayoutRoom1(gridContainer, roomSeats) {
    gridContainer.classList.add("physical-layout-active");
    
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
        topBlock.appendChild(createStudentSeatBox(seat));
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
        leftCol.appendChild(createStudentSeatBox(seat));
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
        midLeftCol.appendChild(createStudentSeatBox(seat));
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
        midRightCol.appendChild(createStudentSeatBox(seat));
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
        rightCol.appendChild(createStudentSeatBox(seat));
    });
    middleSection.appendChild(rightCol);
    
    container.appendChild(middleSection);
    
    // 4. Bottom Walkway & Gate
    const bottomSection = document.createElement("div");
    bottomSection.className = "layout-bottom-section";
    
    const spacer = document.createElement("div");
    spacer.className = "layout-bottom-spacer";
    bottomSection.appendChild(spacer);
    
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

function renderStudentStandardGridLayout(gridContainer, roomSeats) {
    gridContainer.classList.remove("physical-layout-active");
    roomSeats.forEach(seat => {
        gridContainer.appendChild(createStudentSeatBox(seat));
    });
}

function renderStudentSeatGrid(seatsData, selectedRoom, seatType) {
    const gridContainer = document.getElementById("student-seat-grid");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";
    
    // Filter seats for the selected room
    const roomSeats = seatsData.filter(s => s.room === selectedRoom);
    
    // Sort seats by seat number
    roomSeats.sort((a, b) => a.number - b.number);
    
    if (selectedRoom === 1) {
        renderStudentPhysicalLayoutRoom1(gridContainer, roomSeats);
    } else {
        renderStudentStandardGridLayout(gridContainer, roomSeats);
    }
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
// Form Submission handler
function submitStudentForm(event) {
    event.preventDefault();
    
    const name = document.getElementById("s-name").value.trim();
    const phone = document.getElementById("s-phone").value.trim();
    const dob = document.getElementById("s-dob").value;
    const gender = document.getElementById("s-gender").value;
    const email = document.getElementById("s-email").value.trim();
    const govId = document.getElementById("s-gov-id").value.trim();
    
    const fatherName = document.getElementById("s-father-name").value.trim();
    const fatherPhone = document.getElementById("s-father-phone").value.trim();
    const motherName = document.getElementById("s-mother-name").value.trim();
    const motherPhone = document.getElementById("s-mother-phone").value.trim();
    
    const emergencyName = document.getElementById("s-emergency-name").value.trim();
    const emergencyRelation = document.getElementById("s-emergency-relation").value;
    const emergencyPhone = document.getElementById("s-emergency-phone").value.trim();
    
    const street = document.getElementById("s-current-street").value.trim();
    const city = document.getElementById("s-current-city").value.trim();
    const stateVal = document.getElementById("s-current-state").value.trim();
    const zip = document.getElementById("s-current-zip").value.trim();
    
    const sameAddressCheck = document.getElementById("s-same-address");
    if (sameAddressCheck && sameAddressCheck.checked) {
        document.getElementById("s-permanent-street").value = street;
        document.getElementById("s-permanent-city").value = city;
        document.getElementById("s-permanent-state").value = stateVal;
        document.getElementById("s-permanent-zip").value = zip;
    }
    
    const permanentStreet = document.getElementById("s-permanent-street").value.trim();
    const permanentCity = document.getElementById("s-permanent-city").value.trim();
    const permanentState = document.getElementById("s-permanent-state").value.trim();
    const permanentZip = document.getElementById("s-permanent-zip").value.trim();
    
    const targetExam = document.getElementById("s-target-exam").value;
    const expectedStartDate = document.getElementById("s-start-date").value;
    
    const seatType = document.getElementById("s-seat-type").value;
    const durationMonths = isDemo ? parseInt(document.getElementById("s-demo-duration").value) : parseInt(document.getElementById("s-duration").value);
    const seatId = document.getElementById("s-seat-id").value;
    
    // Strict client-side validations
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
        alert("Please enter a valid 10-digit Mobile Number.");
        return;
    }
    if (!gender) {
        alert("Please select your gender.");
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert("Please enter a valid email address.");
        return;
    }
    if (!/^[0-9]{12}$/.test(govId)) {
        alert("Please enter a valid 12-digit Aadhaar Number.");
        return;
    }
    if (!/^[0-9]{10}$/.test(fatherPhone)) {
        alert("Please enter a valid 10-digit Mobile Number for Father.");
        return;
    }
    if (!/^[0-9]{10}$/.test(motherPhone)) {
        alert("Please enter a valid 10-digit Mobile Number for Mother.");
        return;
    }
    if (!/^[0-9]{10}$/.test(emergencyPhone)) {
        alert("Please enter a valid 10-digit Mobile Number for Emergency Contact.");
        return;
    }
    if (!/^[0-9]{6}$/.test(zip)) {
        alert("Please enter a valid 6-digit Recent Zip/Postal Code.");
        return;
    }
    if (!/^[0-9]{6}$/.test(permanentZip)) {
        alert("Please enter a valid 6-digit Permanent Zip/Postal Code.");
        return;
    }
    if (!compressedPhotoBase64) {
        alert("Please upload your profile picture before submitting the registration form.");
        return;
    }
    if (!seatId) {
        alert("Please tap an available seat in the grid layout to select your preferred seat number before submitting.");
        return;
    }
    
    const paymentMethodEl = document.querySelector('input[name="s-payment-method"]:checked');
    let paymentMethod = paymentMethodEl ? paymentMethodEl.value : "Cash";
    
    let feeAmount = PLANS_PRICING[seatType][durationMonths.toString()] || 0;
    if (isDemo) feeAmount = 0;
    
    const amountPaidEl = document.getElementById("s-amount-paid");
    let amountPaid = amountPaidEl ? (parseInt(amountPaidEl.value) || 0) : feeAmount;
    if (isDemo) amountPaid = 0;
    
    let balanceAmount = feeAmount - amountPaid;
    if (isDemo) balanceAmount = 0;
    
    let paymentStatus = "Pending";
    if (isDemo) {
        paymentStatus = "Paid";
        paymentMethod = "Free Demo";
    } else {
        if (amountPaid === feeAmount) {
            paymentStatus = "Paid";
        } else if (amountPaid > 0) {
            paymentStatus = "Partial";
        }
    }
    
    const currentAddressConcated = `${street}, ${city}, ${stateVal} - ${zip}`;
    const permanentAddressConcated = `${permanentStreet}, ${permanentCity}, ${permanentState} - ${permanentZip}`;
    
    const bookingData = {
        name: name,
        phone: cleanPhone, // Save cleaned 10-digit phone number
        dob: dob,
        gender: gender,
        email: email,
        govId: govId,
        
        fatherName: fatherName,
        fatherPhone: fatherPhone,
        motherName: motherName,
        motherPhone: motherPhone,
        
        emergencyName: emergencyName,
        emergencyRelation: emergencyRelation,
        emergencyPhone: emergencyPhone,
        
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
        
        targetExam: targetExam,
        expectedStartDate: expectedStartDate,
        
        seatType: seatType,
        duration: durationMonths,
        seatId: seatId,
        paymentMethod: paymentMethod,
        feeAmount: feeAmount,
        amountPaid: amountPaid,
        balanceAmount: balanceAmount,
        paymentStatus: paymentStatus,
        photo: compressedPhotoBase64,
        timestamp: Date.now(),
        status: "pending",
        bookingType: isDemo ? "demo" : "permanent",
        demoDuration: isDemo ? durationMonths : 0
    };
    
    const submitBtn = document.getElementById("btn-submit-booking");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

    const performSubmission = () => {
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
            if (!hasSubmitted) {
                clearTimeout(timeoutId);
                hasSubmitted = true;
                submitOffline(bookingData);
            }
        }
    };

    const resetSubmitBtn = () => {
        submitBtn.disabled = false;
        if (isDemo) {
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Free Demo Request';
        } else {
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Booking Request';
        }
    };

    if (isDemo) {
        // Enforce spam control (one demo per number)
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying Demo Pass...';
        
        if (database) {
            database.ref("study_cafe_system/registered_phones").child(cleanPhone).once("value")
                .then(snapshot => {
                    if (snapshot.exists()) {
                        alert("यह मोबाइल नंबर पहले से ही लाइब्रेरी में रजिस्टर्ड है। फ्री डेमो केवल नए छात्रों के लिए है।\n\n(This mobile number is already registered. Free demos are only available for new students.)");
                        resetSubmitBtn();
                    } else {
                        performSubmission();
                    }
                })
                .catch(err => {
                    console.warn("Database lookup failed during demo verification, proceeding...", err);
                    performSubmission();
                });
        } else {
            // Local fallback check
            let isRegistered = false;
            try {
                const localState = JSON.parse(localStorage.getItem("study_cafe_state") || "{}");
                if (localState.registered_phones && localState.registered_phones[cleanPhone]) {
                    isRegistered = true;
                }
            } catch(e){}

            if (isRegistered) {
                alert("यह मोबाइल नंबर पहले से ही लाइब्रेरी में रजिस्टर्ड है। फ्री डेमो केवल नए छात्रों के लिए है।\n\n(This mobile number is already registered. Free demos are only available for new students.)");
                resetSubmitBtn();
            } else {
                performSubmission();
            }
        }
    } else {
        performSubmission();
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
    
    const nextStepText = document.getElementById("success-next-step-text");
    if (nextStepText) {
        if (isDemo) {
            nextStepText.innerHTML = 'Please head over to the reception desk. Inform the Admin of your name: <strong id="success-student-name-2" style="color: var(--accent-emerald);">Student</strong> to activate your free trial demo seat.';
        } else {
            nextStepText.innerHTML = 'Please head over to the reception desk. Inform the Admin of your name: <strong id="success-student-name-2" style="color: var(--accent-emerald);">Student</strong> to complete payment and activate your selected seat.';
        }
    }
    
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
    
    // Parse URL parameters for demo mode
    const urlParams = new URLSearchParams(window.location.search);
    isDemo = (urlParams.get('type') === 'demo');
    
    if (isDemo) {
        const demoBadge = document.getElementById("demo-badge");
        if (demoBadge) demoBadge.style.display = "inline-flex";
        
        const demoDurationRow = document.getElementById("s-demo-duration-row");
        if (demoDurationRow) demoDurationRow.style.display = "block";
        
        const titleText = document.getElementById("form-title-text");
        if (titleText) titleText.textContent = "The Study Cafe - Demo Pass";
        
        const durationSelect = document.getElementById("s-duration");
        if (durationSelect && durationSelect.parentElement) {
            durationSelect.parentElement.style.display = "none";
        }
        
        // Hide Seat Preference dropdown & Selected Seat badge
        const seatTypeGroup = document.getElementById("s-seat-type-group");
        if (seatTypeGroup) seatTypeGroup.style.display = "none";
        const selectedSeatGroup = document.getElementById("s-selected-seat-group");
        if (selectedSeatGroup) selectedSeatGroup.style.display = "none";
        
        // Make Choose Room span the full width of the row
        const roomSelect = document.getElementById("s-room");
        if (roomSelect && roomSelect.parentElement) {
            roomSelect.parentElement.style.gridColumn = "span 2";
        }
        
        // Mark visual grid as view-only
        const seatGrid = document.getElementById("student-seat-grid");
        if (seatGrid) seatGrid.classList.add("view-only");
        
        // Hide the payment section container
        const paymentSection = document.getElementById("s-payment-section");
        if (paymentSection) paymentSection.style.display = "none";
        
        const amountPaidEl = document.getElementById("s-amount-paid");
        if (amountPaidEl) {
            amountPaidEl.disabled = true;
            amountPaidEl.value = 0;
            amountPaidEl.removeAttribute("required");
        }
        
        const submitBtn = document.getElementById("btn-submit-booking");
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Free Demo Request';
        }
    }

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
    
    // Setup Same as Recent Address checkbox logic
    const sameAddressCheck = document.getElementById("s-same-address");
    if (sameAddressCheck) {
        sameAddressCheck.addEventListener("change", function() {
            const permSection = document.getElementById("permanent-address-section");
            const permInputs = permSection.querySelectorAll("input");
            if (this.checked) {
                document.getElementById("s-permanent-street").value = document.getElementById("s-current-street").value;
                document.getElementById("s-permanent-city").value = document.getElementById("s-current-city").value;
                document.getElementById("s-permanent-state").value = document.getElementById("s-current-state").value;
                document.getElementById("s-permanent-zip").value = document.getElementById("s-current-zip").value;
                
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
        
        const currentInputs = ["s-current-street", "s-current-city", "s-current-state", "s-current-zip"];
        currentInputs.forEach(id => {
            document.getElementById(id).addEventListener("input", function() {
                if (sameAddressCheck.checked) {
                    const permId = id.replace("current", "permanent");
                    document.getElementById(permId).value = this.value;
                }
            });
        });
    }
    
    // Initialize partial payment input calculations
    initPartialPaymentListeners();
});

function initPartialPaymentListeners() {
    const amountPaidEl = document.getElementById("s-amount-paid");
    const balanceAmountEl = document.getElementById("s-balance-amount");
    
    if (amountPaidEl && balanceAmountEl) {
        amountPaidEl.addEventListener("input", () => {
            const seatType = document.getElementById("s-seat-type").value;
            const duration = document.getElementById("s-duration").value;
            const price = isDemo ? 0 : (PLANS_PRICING[seatType][duration] || 0);
            
            let paid = parseFloat(amountPaidEl.value);
            if (isNaN(paid)) paid = 0;
            
            if (paid > price) {
                paid = price;
                amountPaidEl.value = price;
            }
            if (paid < 0) {
                paid = 0;
                amountPaidEl.value = 0;
            }
            
            balanceAmountEl.value = price - paid;
        });
    }
}
