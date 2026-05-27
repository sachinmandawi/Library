<div align="center">
  <img src="study_cafe_banner.png" alt="The Study Cafe Hero Banner" width="100%" style="border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.5);" />

  # 📚 The Study Cafe — Portal Management System

  [![Firebase](https://img.shields.io/badge/Database-Firebase_RTDB-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
  [![GitHub Pages](https://img.shields.io/badge/Deployment-GitHub_Pages-222222?style=for-the-badge&logo=githubpages&logoColor=white)](https://sachinmandawi.github.io/Library/)
  [![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](https://opensource.org/licenses/MIT)

  <p align="center">
    <strong>A futuristic, shift-free study library management portal. Featuring real-time seating grids, instant WhatsApp notifications, and automated billing.</strong>
  </p>

  <br />

  ### 🔗 Live Applications

  [![Live Admin Dashboard](https://img.shields.io/badge/Live_Admin_Dashboard-Click_to_Open-3b82f6?style=for-the-badge&logo=googlechrome&logoColor=white)](https://sachinmandawi.github.io/Library/index.html)
  [![Live Student Registration Form](https://img.shields.io/badge/Live_Student_Registration-Click_to_Open-10b981?style=for-the-badge&logo=googleforms&logoColor=white)](https://sachinmandawi.github.io/Library/register.html)
</div>

---

## ✨ Features

### 🟢 Realtime 400-Seat Seating Grid
* **Visual Representation:** Interactive visual grids spanning **4 rooms (100 seats each)**.
* **Color Code Legends:** 
  * 🔵 **Reserved (Occupied):** Shows who sits where with a blue glow.
  * 🔴 **Maintenance (Repair):** Highlights blocked seats under repair.
  * ⚪ **Available (Vacant):** Neutral gray seats ready for assignment.
* **Double Booking Protection:** Automated client and server-side checks prevent overlapping assignments.

### 💸 Flexible Non-Reserved Seating Support
* **Seating Type Selector:** Choose between "Reserved" (locked cabin desks) and "Non-Reserved" (flexible floating desk space).
* **Smart UI Hiding:** Dynamically hides the visual seat picker for non-reserved requests and labels seat locations as **N/A / Flexible** in receipts, directories, and tables.

### 📅 Auto WhatsApp Expiry Alerts (English)
* **Instant Expiry Notifications:** One-click reminder button next to expiring/expired student lists on the dashboard.
* **Dynamic Content Generator:** Crafts professional pre-formatted English WhatsApp reminder messages:
  * *Hello [Student], your membership for Seat X (Room Y) expires tomorrow. Please renew to retain your desk...*
* **Phone Number Sanitizer:** Strips leading zeroes and wraps numbers automatically with `+91` country code.

### 📄 Smart PDF & Print Receipt Generator
* **One-Click PDF Download:** Integrates `html2pdf.js` for fast high-resolution A5 invoice generation.
* **Support Integration:** Instantly binds the custom Library Support phone number and address configured in settings.

### 🔍 Advanced Member Directory Filters
* **Dropdown Filtering:** Sort students by subscription status (Active, Expired, Expiring), Seat Type, Room No, Target Exam, Payment Status, Payment Method, and Package Duration.
* **Interactive Clear Action:** A "Clear Filters" button to reset all criteria and searches instantaneously.

---

## 🛠️ Technology Stack

* **Frontend:** Clean Vanilla HTML5, CSS3 Variables, ES6 JavaScript.
* **Database & Sync:** Google Firebase Realtime Database with cross-tab local `storage` and `BroadcastChannel` syncing.
* **Exporting:** `html2pdf.js` for client-side PDF compilation.
* **Fonts & Icons:** Google Fonts (Outfit, Inter) and Font Awesome 6.

---

## 🚀 Quick Start Guide

### 1. Run Locally
Open the files directly in any web browser, or launch a local web server:
```bash
npx http-server -p 8080
```
Then visit:
* **Admin Dashboard:** `http://localhost:8080/index.html`
* **Student Registration:** `http://localhost:8080/register.html`

### 2. Connect Your Own Database
Go to the **Database Settings** tab at the bottom of the sidebar:
1. Enter your custom Firebase API Credentials.
2. Click **Save Configuration & Connect**.
3. The application will instantly switch to your private cloud storage!

---

<div align="center">
  <sub>Developed with ❤️ for <strong>The Study Cafe</strong>.</sub>
</div>
