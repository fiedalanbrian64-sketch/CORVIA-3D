
# AI Usage Disclosure Record

## Responsible Members
- Fiedalan, Brian
- Mangaoang, John Kenneth Z.

## 1. Application Implementation and Feature Changes
- **AI Tool Used:** GitHub Copilot (AI assistant using Copilot SDK in VS Code).
- **Task Where AI Was Used:** Assistance with implementation and refinement of the CORVIA browser application, including role-based workspaces, local account and station-data workflows, and subsequent feature changes.
- **Manuscript / Project Section:** `index.html`, `style.css`, `app.js`, `config.js`, and `manifest.json`.
- **Exact Prompt Used:** The initial application prompt, as provided by the user:

````text
Act as a Senior Healthcare Systems Architect and Lead UI/UX Engineer. Build a complete, production-ready, highly intuitive, and enterprise-grade web application called "CORVIA - Automated Ward Orchestration System".

The project must be strictly structured into five (5) distinct, fully documented files: `index.html`, `style.css`, `app.js`, `config.js`, and `manifest.json`. Ensure there are ZERO placeholder texts, truncated components, or missing features.

==========================================================================
1. FILE ARCHITECTURE & RESPONSIBILITIES
==========================================================================
1. `index.html` - Semantic HTML5 layout, headers, tickers, modal dialogues, and active view sections.
2. `style.css` - Full responsive hospital light theme, glassmorphic styles, custom typography, animations, and component layouts.
3. `app.js` - Dynamic DOM controller, event handlers, authentication logic, and dashboard workflows.
4. `config.js` - System configuration constants (Ward IDs, Department Routes, Shift Schedules, and Default Telemetry Thresholds).
5. `manifest.json` - PWA (Progressive Web App) manifest configuration allowing desktop and tablet station installation.

==========================================================================
2. WELCOME EXPERIENCE & HUMAN-CENTERED UX DESIGN
==========================================================================
- Welcome & Guided Onboarding Section:
  - Header Banner: "Welcome to CORVIA Ward Orchestration Platform — Streamlining Healthcare Operations with Precision & Empathy."
  - Quick-Start Guide Card: Interactive visual overview explaining how Doctors, Nurses, Health Workers, and Patients access their dedicated modules.
- Visual Clarity & Accessibility:
  - Intuitive navigation layout with high-contrast text ratios, clear field labels, and visual status indicators.
  - Interactive Tooltips: Subtle descriptive helper text under all clinical inputs, action buttons, and dropdown selectors.

==========================================================================
3. ENTERPRISE MEDICAL LIGHT THEME & DESIGN SYSTEM (`style.css`)
==========================================================================
- Clinical Palette:
  - Base Canvas: Crisp Slate Off-White (#F8FAFC to #F1F5F9).
  - Cards & Containers: Pure White (#FFFFFF) elevated panels with soft shadows (`box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08)`) and thin slate borders (`border: 1px solid #E2E8F0`).
  - Accent Colors: Deep Navy Blue (#0F172A) for structure, Medical Cyan (#0EA5E9) for primary buttons, Emerald Green (#10B981) for stable/online states, Alert Red (#EF4444) for emergency warnings, and Amber (#F59E0B) for pending status.
- Key Clinical Animations:
  1. Pulsing Heartbeat Logo: Subtle stroke pulse sequence on the medical cross/heart icon.
  2. Continuous Cardiac ECG Waveform: A smooth, looping SVG cardiac trace running across the gateway banner with ZERO breaks or jumps.

==========================================================================
4. HEADER & REAL-TIME TICKER (`index.html` & `config.js`)
==========================================================================
- Top Announcement Ticker: Displays active "HOSPITAL INTRANET NODE 01" status, active shift details ("Shift 1: Morning Duty | 06:00 - 14:00"), ward synchronization status, and a real-time updating digital clock (HH:MM:SS AM/PM).
- Sticky Header: CORVIA Brand Identity, Tagline, and Active Session Badge displaying user name, assigned role, and a functional "Logout" button.

==========================================================================
5. CREDENTIAL PERSISTENCE & MULTI-ROLE GATEWAY (`app.js`)
==========================================================================
Implement persistent client-side account handling using browser `localStorage`:

A. Admin Provisioning (Sign Up Tab):
- Registration Fields: Full Name, Staff/User ID, Password, Role Category, and Assigned Department Workstation (for Health Workers).
- Persist new accounts in `localStorage`, prevent duplicate IDs, and auto-fill login details upon successful registration.

B. Multi-Role Authentication Gateway (Log In Tab):
- Supported Categories: Doctor, Nurse, Health Worker (with 11 Dynamic Department Modules), and Patient Portal.
- Real-Time Validation: Authenticate credentials against `localStorage` with explicit, user-friendly error messages.
- Password Toggle: Interactive "Show / Hide" toggle button inside password fields.

==========================================================================
6. DETAILED WORKSTATION MODULES & SPECIFICATIONS (`index.html` & `app.js`)
==========================================================================

A. ATTENDING PHYSICIAN COMMAND CONSOLE (Doctor Dashboard)
- KPI Overview Row: Active Inpatients Counter, Critical Telemetry Alerts, Pending Lab Orders.
- Emergency Code Red Dispatch Console: Hospital-wide broadcast system with active banner.
- Rapid Patient Admission Form: Patient Name, Age/Gender, MRN, Admitting Diagnosis, Ward Number, and Bed Allocation.
- Electronic Prescription (e-Rx) Dispatch Console: Patient ID/Bed, Medication Name, Dosage, Route (IV/Oral), Frequency, and Urgency Level (STAT/Routine).

B. NURSE STATION CENTRAL CONSOLE (Nurse Dashboard)
- Digital Vital Signs Entry & Evaluator: Patient Selection, Body Temp (°C), Blood Pressure (mmHg), Heart Rate (bpm), Respiration Rate (cpm), and SpO2 (%) with visual alerts for abnormal readings.
- Patient Call Bell Monitor: Displays active call notifications with patient name, bed location, request type, and an "Acknowledge Call" action button.
- Timed Medication Schedule: Interactive checklist displaying scheduled dosages and "Mark Administered" actions.

C. HEALTH WORKER ISOLATED WORKSTATIONS (11 Functional Panels)
1. ER Triage Specialist: Arrival Mode, Chief Complaint, Vitals, and Triage Level (Red - Immediate, Yellow - Emergent, Green - Non-Urgent).
2. ICU Telemetry Specialist: Heart Rate, SpO2, MAP, Ventilator Mode, PEEP, and Fluid Balance (Intake vs Output).
3. Laboratory Technician: Diagnostic Entry (CBC, Chemistry, Urinalysis, Blood Gas) with Ward Result Broadcast button.
4. Pharmacist / Dispenser: Prescription queue fulfillment, dosage verification, and inventory check.
5. Internal Medicine Ward Staff: Daily SOAP progress notes and shift endorsement log.
6. OPD Consultation Staff: Outpatient queue caller, clinic room selector, and doctor roster.
7. Surgery Ward Staff: Post-op recovery log, surgical procedure details, wound site condition, and drain output (mL).
8. Billing & Subsidy Specialist: Statement of Account calculator with PhilHealth/Malasakit financial assistance inputs.
9. Pathology Staff: Specimen tracking, tissue source, biopsy findings, and diagnostic report approval.
10. Pediatric Ward Staff: Child age/weight logger, pediatric dose calculator, and growth chart centile.
11. DR / OR Staff: WHO Surgical Safety Checklist (Sign In, Time Out, Sign Out) digital verifier.

D. PATIENT PERSONAL HEALTH PORTAL
- Care Team Overview: Patient Name, Assigned Ward & Bed, Primary Physician, and Charge Nurse.
- Emergency Nurse Request Button: Direct alert bell button updating the Nurse Console call monitor.
````
- **AI Output Used:** Code and revisions incorporated into the application files. The available project history describes browser-local account and station-data handling, role workspaces, admission and nurse workflows, vitals, medication/care tracking, handovers, search/history, patient assistance requests, and removal of the Demo Mode interface and generated sample records. A legacy data-recovery routine remains for browsers with prior Demo Mode data.
- **Validation Method:** The recorded browser checks covered sign-up, login, logout, admission and prescription submission, nurse admission acknowledgment, abnormal-vitals flagging, patient assistance request and acknowledgment, handover creation and acknowledgment, patient lookup, local persistence after reload, and removal of the active Demo Mode UI/keys. The retained test notes state that medication-dose confirmation was not conclusively verified and a patient-history text assertion did not pass; these must not be reported as passing tests.

---

## 2. User Guide and Operating Procedures
- **AI Tool Used:** GitHub Copilot (AI assistant using Copilot SDK in VS Code).
- **Task Where AI Was Used:** Drafting and expanding the Filipino user guide, including role descriptions, local-storage limitations, safety cautions, and step-by-step procedures.
- **Manuscript / Project Section:** [`GABAY-SA-PAGGAMIT.md`](./GABAY-SA-PAGGAMIT.md).

- **Exact Prompt Used:**
1."Could you create a user guide document for the web application?"
2."Could you include a step-by-step procedure?"

- **AI Output Used:** Filipino user-guide text describing account setup and login, Doctor/Nurse/Health Worker/Patient workspaces, admission and handoff, vitals and search, medication and care-task tracking, shift handover, patient assistance requests, laboratory workflow, persistence, and privacy/security limitations.
- **Validation Method:** The guide was compared with the available feature descriptions and prior browser-test notes. It identifies CORVIA as a browser-local prototype, warns against real patient data or clinical use, and avoids claiming that the unfinished medication/history checks passed. The group verified button and workflow labels against the current build.
---

## 3. Application Workflow Review
- **AI Tool Used:** GitHub Copilot (AI assistant using Copilot SDK in VS Code).
- **Task Where AI Was Used:** Reviewing whether key application functions worked and whether the removed Demo Mode remained active.
- **Manuscript / Project Section:** Application workflow review of `index.html`, `app.js`, `config.js`, and browser behavior.
- **Exact Prompt Used:**"Could you check if all functions are working properly and verify that the removed features, such as the Demo Mode, are completely gone?"
- **AI Output Used:** A review summary of observed workflows, Demo Mode removal, persistence behavior, and checks that remained inconclusive.
- **Validation Method:** Browser interaction checks and inspection of browser storage were recorded for the workflows listed in Record 1. Repeated tests were performed against the deployed version to document behavior, noting that medication confirmation and the patient-history assertion remained unresolved in the initial test record.

---

## 4. Disclosure Preparation
- **AI Tool Used:** GitHub Copilot (AI assistant using Copilot SDK in VS Code) and Gemini.
- **Task Where AI Was Used:** Preparing and formatting this disclosure record from the requirements and member assignments supplied by the group.
- **Manuscript / Project Section:** `AI_DISCLOSURE.md`.
- **Exact Prompt Used:** The verbatim disclosure requirements and member assignments supplied in the conversation for this task.
- **AI Output Used:** This structured disclosure document, including the project contribution records, assigned responsible members, and explicit limitations on retained chat history.
- **Validation Method:** Checked the document against all required disclosure fields and documentation rules in Section A and Section B of the project guidelines, and verified member assignments and accuracy with the group

---

## Prompt, Reference, and Privacy Attestation
- **Prompt History Limitations:** The initial application prompt supplied by the group is reproduced in Record 1. The available conversation history still omits later prompts for some feature changes; add those verbatim from the complete chat history if required. Do not reconstruct missing wording.
- **Scholarly & Data Integrity:** No scholarly references, fictional experiments, or fabricated data are asserted in this disclosure. All references and factual claims used in the manuscript were independently verified.
- **Data Privacy & Confidentiality:** The group confirms that no real patient records, confidential data, or sensitive personal information were uploaded to AI tools during the development of this browser-local prototype.
