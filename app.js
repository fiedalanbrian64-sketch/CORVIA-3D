/* CORVIA client-side station controller. This browser-only prototype is not a clinical system. */
(() => {
  "use strict";

  const config = window.CORVIA_CONFIG;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const gateway = $("#gateway-view");
  const workspace = $("#workspace-view");
  const workspaceContent = $("#workspace-content");
  const toastRegion = $("#toast-region");
  const blankData = () => ({
    admissions: [], prescriptions: [], vitals: [], calls: [], labOrders: [],
    broadcasts: [], triage: [], telemetry: [], labResults: [], inventory: [],
    soapNotes: [], endorsements: [], opdQueue: [], surgeryLogs: [],
    billingStatements: [], pathology: [], pediatricLogs: [], orChecklists: [],
    roundTasks: [], auditLog: []
  });
  let data = blankData();
  let activeUser = null;
  let confirmationCallback = null;
  let dataWritable = true;
  let authenticating = false;
  let patientSearchFilters = { query: "", ward: "", status: "", department: "", from: "", to: "" };
  const remindedItems = new Set();

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function readStored(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.error(`CORVIA could not read local storage key "${key}".`, error);
      throw new Error("Saved station data is unreadable. Do not clear browser data until it has been reviewed.");
    }
  }

  function saveData() {
    if (!dataWritable) {
      notify("Station data is read-only because saved data could not be verified.", "error");
      throw new Error("Saved data could not be verified. No changes were saved.");
    }
    try {
      localStorage.setItem(config.storageKeys.data, JSON.stringify(data));
    } catch (error) {
      console.error("CORVIA could not save station data.", error);
      notify("Station data could not be saved in this browser. Check available storage and try again.", "error");
      throw error;
    }
  }

  function getAccounts() {
    const accounts = readStored(config.storageKeys.accounts, []);
    if (!Array.isArray(accounts)) throw new Error("The local account store has an invalid format.");
    return accounts;
  }

  function saveAccounts(accounts) {
    try {
      localStorage.setItem(config.storageKeys.accounts, JSON.stringify(accounts));
    } catch (error) {
      console.error("CORVIA could not save account details.", error);
      throw new Error("The account could not be saved. Check browser storage availability and try again.");
    }
  }

  function notify(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 4800);
  }

  function id() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function formatDate(value = new Date()) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  function nurseChoices() {
    const nurses = getAccounts().filter((account) => account.role === "nurse");
    return [{ value: "", label: "Unassigned" }, ...nurses.map((nurse) => ({
      value: nurse.normalizedId,
      label: `${nurse.fullName} · ${nurse.userId}`
    }))];
  }

  function nurseMatches(assignment) {
    if (!assignment) return true;
    return activeUser?.role === "nurse" &&
      (assignment === activeUser.normalizedId || assignment === activeUser.userId ||
        assignment.toLocaleLowerCase() === activeUser.fullName.toLocaleLowerCase());
  }

  function recurrenceMilliseconds(recurrence) {
    if (recurrence === "Each shift") return 8 * 60 * 60 * 1000;
    if (recurrence === "Daily") return 24 * 60 * 60 * 1000;
    const match = /^Every (\d+) hours$/.exec(recurrence || "");
    return match ? Number(match[1]) * 60 * 60 * 1000 : 0;
  }

  function patientNeedsReview(patient) {
    return data.vitals.some((entry) => entry.patientName === patient.name && !entry.stable) ||
      data.telemetry.some((entry) => entry.patientName === patient.name && entry.alert) ||
      data.calls.some((entry) => entry.patientId === patient.mrn && entry.status === "Active");
  }

  function patientDepartments(patient) {
    const departments = new Set(["Nursing"]);
    if (data.triage.some((entry) => entry.patientName === patient.name)) departments.add("Emergency");
    if (data.telemetry.some((entry) => entry.patientName === patient.name)) departments.add("ICU");
    if (data.labResults.some((entry) => entry.patientName === patient.name) ||
        data.labOrders.some((entry) => entry.patient === patient.mrn)) departments.add("Laboratory");
    if (data.prescriptions.some((entry) => entry.patientName === patient.name)) departments.add("Pharmacy");
    if (data.soapNotes.some((entry) => entry.patientName === patient.name) ||
        data.endorsements.some((entry) => entry.patientName === patient.name)) departments.add("Internal Medicine");
    return [...departments];
  }

  function patientHistory(patient) {
    const entries = [
      ...data.vitals.filter((entry) => entry.patientName === patient.name).map((entry) => ({ kind: "Vital signs", details: `${entry.bloodPressure} mmHg · HR ${entry.heartRate} bpm · SpO₂ ${entry.spo2}% · ${entry.stable ? "Within configured range" : "Needs review"}`, at: entry.createdAt })),
      ...data.telemetry.filter((entry) => entry.patientName === patient.name).map((entry) => ({ kind: "ICU telemetry", details: `${entry.heartRate} bpm · SpO₂ ${entry.spo2}% · ${entry.alert ? "Needs review" : "Recorded"}`, at: entry.createdAt })),
      ...data.prescriptions.filter((entry) => entry.patientName === patient.name).map((entry) => ({ kind: "Medication", details: `${entry.medication} · ${entry.status || "Pending"} · ${entry.completedDoses || 0}/${entry.totalDoses || 1} doses`, at: entry.createdAt })),
      ...data.soapNotes.filter((entry) => entry.patientName === patient.name).map((entry) => ({ kind: "Clinical note", details: entry.summary, at: entry.createdAt })),
      ...data.endorsements.filter((entry) => entry.patientName === patient.name).map((entry) => ({ kind: "Handover", details: `${entry.summary} · ${entry.acknowledgmentStatus || "Pending acknowledgment"}`, at: entry.createdAt })),
      ...data.roundTasks.filter((entry) => entry.patientName === patient.name).map((entry) => ({ kind: "Care task", details: `${entry.title} · ${entry.status}`, at: entry.createdAt })),
      ...data.auditLog.filter((entry) => entry.patientName === patient.name).map((entry) => ({ kind: `Audit · ${entry.action}`, details: `${entry.actor} · ${entry.details}`, at: entry.createdAt }))
    ];
    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }

  function logAudit(action, patientName, details) {
    data.auditLog.push({
      id: id(), createdAt: new Date().toISOString(),
      actor: activeUser?.fullName || "System",
      patientName: patientName || "Station",
      action, details
    });
    if (data.auditLog.length > 2000) data.auditLog.splice(0, data.auditLog.length - 2000);
  }

  function checkScheduledReminders() {
    if (activeUser?.role !== "nurse") return;
    data.prescriptions.filter((order) => order.status !== "Course completed" && order.status !== "Administered")
      .forEach((order) => reminderFor(order, "medication", order.scheduledAt, `${order.medication} for ${order.patientName}`));
    data.roundTasks.filter((task) => task.status !== "Completed" && nurseMatches(task.assignedNurse))
      .forEach((task) => reminderFor(task, "round-task", task.scheduledAt, `${task.title} for ${task.patientName}`));
  }

  function reminderFor(record, kind, scheduledAt, label) {
    const dueAt = new Date(scheduledAt).getTime();
    if (!Number.isFinite(dueAt) || dueAt > Date.now()) return "";
    const overdue = Date.now() - dueAt >= 60 * 60 * 1000;
    const reminderKey = `${kind}:${record.id}:${scheduledAt}`;
    if (!remindedItems.has(reminderKey)) {
      remindedItems.add(reminderKey);
      notify(`${overdue ? "Overdue" : "Due now"}: ${label}`, overdue ? "error" : "success");
    }
    return overdue ? "Overdue" : "Due now";
  }

  function searchPatients() {
    const query = patientSearchFilters.query.trim().toLocaleLowerCase();
    const from = patientSearchFilters.from ? new Date(`${patientSearchFilters.from}T00:00:00`).getTime() : 0;
    const to = patientSearchFilters.to ? new Date(`${patientSearchFilters.to}T23:59:59`).getTime() : Infinity;
    return data.admissions.filter((patient) => {
      const admissionTime = new Date(patient.createdAt).getTime();
      const queryMatches = !query || [patient.name, patient.mrn, patient.diagnosis, patient.ward, patient.bed].some((value) => String(value || "").toLocaleLowerCase().includes(query));
      const status = patientNeedsReview(patient) ? "needs-review" : "active";
      const departments = patientDepartments(patient);
      return queryMatches && (!patientSearchFilters.ward || patient.ward === patientSearchFilters.ward) &&
        (!patientSearchFilters.status || patientSearchFilters.status === status) &&
        (!patientSearchFilters.department || departments.includes(patientSearchFilters.department)) &&
        admissionTime >= from && admissionTime <= to;
    });
  }

  function roleName(user = activeUser) {
    if (!user) return "";
    if (user.role === "health-worker") {
      return config.departments.find((department) => department.id === user.department)?.name || "Health Worker";
    }
    return ({ doctor: "Doctor", nurse: "Nurse", patient: "Patient" })[user.role] || user.role;
  }

  function showGateway() {
    workspace.hidden = true;
    workspace.classList.remove("is-entering");
    gateway.hidden = false;
    $("#session-badge").hidden = true;
    activeUser = null;
  }

  function showWorkspace() {
    gateway.hidden = true;
    workspace.hidden = false;
    $("#session-badge").hidden = false;
    $("#session-name").textContent = activeUser.fullName;
    $("#session-role").textContent = roleName();
    $("#session-avatar").textContent = activeUser.fullName.trim().charAt(0).toUpperCase();
    renderWorkspace();
    checkScheduledReminders();
    workspace.classList.remove("is-entering");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      workspace.classList.add("is-entering");
      workspace.addEventListener("animationend", (event) => {
        if (event.target === workspace) workspace.classList.remove("is-entering");
      }, { once: true });
    }
  }

  function setMessage(element, message, success = false) {
    element.textContent = message;
    element.classList.toggle("success", success);
  }

  function departmentOptions(selected = "") {
    return `<option value="">Select department</option>${config.departments.map((department) =>
      `<option value="${department.id}" ${department.id === selected ? "selected" : ""}>${escapeHtml(department.name)}</option>`
    ).join("")}`;
  }

  function toggleDepartment(roleSelect, wrapper, departmentSelect) {
    const isWorker = roleSelect.value === "health-worker";
    wrapper.hidden = !isWorker;
    departmentSelect.required = isWorker;
    if (isWorker && !departmentSelect.options.length) departmentSelect.innerHTML = departmentOptions();
    if (!isWorker) departmentSelect.value = "";
  }

  function switchTab(tab) {
    const isLogin = tab === "login";
    $("#login-tab").classList.toggle("is-active", isLogin);
    $("#signup-tab").classList.toggle("is-active", !isLogin);
    $("#login-tab").setAttribute("aria-selected", String(isLogin));
    $("#signup-tab").setAttribute("aria-selected", String(!isLogin));
    $("#login-panel").hidden = !isLogin;
    $("#signup-panel").hidden = isLogin;
    (isLogin ? $("#login-id") : $("#signup-name")).focus();
  }

  function bytesToBase64(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  async function passwordDigest(password, saltText) {
    if (!globalThis.crypto?.subtle) {
      throw new Error("Secure password storage is unavailable. Open CORVIA over HTTPS or localhost in a supported browser.");
    }
    const salt = saltText ? Uint8Array.from(atob(saltText), (char) => char.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" }, key, 256);
    return { salt: bytesToBase64(salt), hash: bytesToBase64(new Uint8Array(bits)) };
  }

  async function registerAccount(form) {
    const message = $("#signup-message");
    setMessage(message, "");
    const fields = new FormData(form);
    const fullName = String(fields.get("fullName")).trim();
    const userId = String(fields.get("userId")).trim();
    const password = String(fields.get("password"));
    const role = String(fields.get("role"));
    const department = String(fields.get("department") || "");
    const normalizedId = userId.toLocaleLowerCase();
    try {
      if (role === "health-worker" && !config.departments.some((entry) => entry.id === department)) {
        throw new Error("Select an assigned department workstation.");
      }
      const accounts = getAccounts();
      if (accounts.some((account) => account.userId.toLocaleLowerCase() === normalizedId)) {
        throw new Error("That Staff / User ID is already registered. Choose a different ID or log in.");
      }
      const digest = await passwordDigest(password);
      accounts.push({ fullName, userId, normalizedId, role, department: role === "health-worker" ? department : "", ...digest, createdAt: new Date().toISOString() });
      saveAccounts(accounts);
      $("#login-id").value = userId;
      $("#login-password").value = password;
      $("#login-role").value = role;
      toggleDepartment($("#login-role"), $("#login-department-wrap"), $("#login-department"));
      $("#login-department").value = role === "health-worker" ? department : "";
      switchTab("login");
      setMessage($("#login-message"), "Account created. Your ID and role are ready; enter your password to open your workspace.", true);
    } catch (error) {
      console.error("CORVIA account registration failed.", error);
      setMessage(message, error.message || "Account creation failed. Please try again.");
    }
  }

  async function authenticate(form) {
    if (authenticating) return;
    authenticating = true;
    const submitButton = $("#login-submit");
    const submitLabel = $("#login-submit-label");
    submitButton.disabled = true;
    submitButton.setAttribute("aria-busy", "true");
    submitLabel.textContent = "Signing in…";
    const message = $("#login-message");
    setMessage(message, "");
    try {
      const fields = new FormData(form);
      const userId = String(fields.get("userId")).trim();
      const password = String(fields.get("password"));
      const role = String(fields.get("role"));
      const department = String(fields.get("department") || "");
      const account = getAccounts().find((entry) => entry.normalizedId === userId.toLocaleLowerCase());
      if (!account || account.role !== role || (role === "health-worker" && account.department !== department)) {
        throw new Error("No matching account was found. Check your role, department, and Staff / User ID.");
      }
      const digest = await passwordDigest(password, account.salt);
      if (digest.hash !== account.hash) throw new Error("The password does not match this account. Check it and try again.");
      activeUser = account;
      setMessage(message, "");
      showWorkspace();
    } catch (error) {
      console.error("CORVIA sign-in failed.", error);
      setMessage(message, error.message || "Sign-in could not be completed. Please try again.");
    } finally {
      authenticating = false;
      submitButton.disabled = false;
      submitButton.removeAttribute("aria-busy");
      submitLabel.textContent = "Open my workspace";
    }
  }

  function tickClock() {
    $("#live-clock").textContent = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(new Date());
    const now = new Date();
    const time = now.getHours() * 60 + now.getMinutes();
    const shift = time >= 360 && time < 840 ? config.shifts[0] : time >= 840 && time < 1320 ? config.shifts[1] : config.shifts[2];
    $("#shift-status").textContent = `${shift.name} | ${shift.start} - ${shift.end}`;
  }

  function formField(name, label, options = {}) {
    const { type = "text", hint = "", required = true, min, max, step, choices, value = "" } = options;
    const idValue = `field-${name}`;
    const requiredAttr = required ? "required" : "";
    let control;
    if (choices) {
      control = `<select id="${idValue}" name="${name}" ${requiredAttr}><option value="">Select ${escapeHtml(label.toLowerCase())}</option>${choices.map((choice) => {
        const option = typeof choice === "string" ? { value: choice, label: choice } : choice;
        return `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`;
      }).join("")}</select>`;
    } else if (type === "textarea") {
      control = `<textarea id="${idValue}" name="${name}" ${requiredAttr}></textarea>`;
    } else if (type === "checkbox") {
      control = `<label class="check-row" for="${idValue}"><input id="${idValue}" name="${name}" type="checkbox" ${requiredAttr}><span>${escapeHtml(label)}</span></label>`;
      return `<div class="field-wrap">${control}${hint ? `<small class="helper">${escapeHtml(hint)}</small>` : ""}</div>`;
    } else {
      const attrs = [
        `type="${type}"`, `id="${idValue}"`, `name="${name}"`, requiredAttr,
        min !== undefined ? `min="${min}"` : "", max !== undefined ? `max="${max}"` : "",
        step !== undefined ? `step="${step}"` : "",
        value !== "" ? `value="${escapeHtml(value)}"` : ""
      ].filter(Boolean).join(" ");
      control = `<input ${attrs}>`;
    }
    return `<div class="field-wrap"><label for="${idValue}">${escapeHtml(label)}</label>${control}${hint ? `<small class="helper">${escapeHtml(hint)}</small>` : ""}</div>`;
  }

  function wardChoices() {
    return config.wards.map((ward) => ({ value: ward.id, label: `${ward.id} · ${ward.name}` }));
  }

  function patientChoices() {
    const rows = data.admissions.map((patient) => ({ value: patient.mrn, label: `${patient.name} · ${patient.mrn} · ${patient.ward} / ${patient.bed}` }));
    return rows.length ? rows : [{ value: "", label: "No admissions are available" }];
  }

  function patientSearchCard() {
    const patients = searchPatients();
    const departmentChoices = ["Nursing", "Emergency", "ICU", "Laboratory", "Pharmacy", "Internal Medicine"];
    const rows = patients.map((patient) => {
      const needsReview = patientNeedsReview(patient);
      const history = patientHistory(patient);
      return `<details class="patient-history-row"><summary><span><strong>${escapeHtml(patient.name)} · ${escapeHtml(patient.mrn)}</strong><small>${escapeHtml(patient.diagnosis)} · ${escapeHtml(patient.ward)} / ${escapeHtml(patient.bed)} · Admitted ${escapeHtml(formatDate(patient.createdAt))}</small></span>${tag(needsReview ? "Needs review" : "Admitted", needsReview ? "critical" : "done")}</summary><div class="history-details"><p><strong>Departments:</strong> ${escapeHtml(patientDepartments(patient).join(", "))} · <strong>Nurse:</strong> ${escapeHtml(patient.nurse || "Unassigned")}</p>${recordRows(history.slice(0, 20), (entry) => `<div class="history-entry"><strong>${escapeHtml(entry.kind)}</strong><span>${escapeHtml(entry.details)}</span><time>${escapeHtml(formatDate(entry.at))}</time></div>`, "No additional history is recorded for this patient.")}</div></details>`;
    });
    const options = (values, selected, placeholder) => `<option value="">${placeholder}</option>${values.map((value) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}`;
    return card(`Patient census & record search · ${patients.length}`, `<form id="patient-search-form" class="patient-search-form" role="search">
      <label>Find patient<input name="query" type="search" value="${escapeHtml(patientSearchFilters.query)}" placeholder="Name, MRN, diagnosis, ward, or bed"></label>
      <label>Ward<select name="ward">${options(config.wards.map((ward) => ward.id), patientSearchFilters.ward, "All wards")}</select></label>
      <label>Status<select name="status">${options(["active", "needs-review"], patientSearchFilters.status, "All statuses")}</select></label>
      <label>Department<select name="department">${options(departmentChoices, patientSearchFilters.department, "All departments")}</select></label>
      <label>Admitted from<input name="from" type="date" value="${escapeHtml(patientSearchFilters.from)}"></label>
      <label>Admitted to<input name="to" type="date" value="${escapeHtml(patientSearchFilters.to)}"></label>
      <div class="patient-search-actions"><button class="button button-primary button-small" type="submit">Search records</button><button class="button button-quiet button-small" type="reset" data-action="clear-patient-search">Clear filters</button></div>
    </form>${recordRows(patients, (patient) => rows[patients.indexOf(patient)], "No patient records match these filters. Dates use the admission date.")}`, "span-12");
  }

  function formCard(title, description, formName, fields, submitText, extraClass = "") {
    return `<div class="form-card ${extraClass}"><h2>${escapeHtml(title)}</h2><p class="subheading">${escapeHtml(description)}</p><form data-form="${formName}"><div class="form-grid">${fields.join("")}</div><div class="form-actions"><button class="button button-primary" type="submit">${escapeHtml(submitText)} <span aria-hidden="true">→</span></button></div><small class="helper">Submit saves this entry to the current browser station. Verify all details before recording.</small></form></div>`;
  }

  function card(title, content, span = "span-6", extraClass = "") {
    return `<section class="card ${span}${extraClass ? ` ${extraClass}` : ""}"><h2>${escapeHtml(title)}</h2>${content}</section>`;
  }

  function emptyState(text) {
    return `<div class="empty-state">${escapeHtml(text)}</div>`;
  }

  function tag(label, type = "") {
    return `<span class="tag ${type}">${escapeHtml(label)}</span>`;
  }

  function recordRows(records, render, emptyText) {
    if (!records.length) return emptyState(emptyText);
    return `<div class="record-list">${records.map(render).join("")}</div>`;
  }

  function countAbnormalVitals() {
    return data.vitals.filter((entry) => !entry.stable).length + data.telemetry.filter((entry) => entry.alert).length;
  }

  function kpi(label, value, note) {
    return `<section class="card span-3 kpi-card"><span class="kpi-label">${escapeHtml(label)}</span><strong class="kpi-value">${escapeHtml(value)}</strong><small class="kpi-note">${escapeHtml(note)}</small></section>`;
  }

  function doctorDashboard() {
    const pendingLabs = data.labOrders.filter((order) => order.status === "Pending").length;
    const activeBroadcast = data.broadcasts.find((entry) => entry.active);
    const admissions = data.admissions;
    const admissionFields = [
      formField("name", "Patient name", { hint: "Enter the name as verified during admission." }),
      formField("age", "Age (years)", { type: "number", min: 0, max: 125, hint: "Use completed years; enter 0 for an infant." }),
      formField("gender", "Gender", { choices: ["Female", "Male", "Another identity", "Not recorded"], hint: "Record the patient's stated or documented gender." }),
      formField("mrn", "Medical record number (MRN)", { hint: "Use a unique patient identifier. Patients use this ID to match their portal account." }),
      formField("diagnosis", "Admitting diagnosis", { type: "textarea", hint: "Document the confirmed or working admission diagnosis." }),
      formField("ward", "Ward number", { choices: wardChoices(), hint: "Select the assigned ward." }),
      formField("bed", "Bed allocation", { hint: "Enter the confirmed bed label within the selected ward." }),
      formField("assignedNurse", "Assigned nurse", { choices: nurseChoices(), required: false, hint: "Select the nurse receiving this intake alert; unassigned admissions appear in the nurse station queue." })
    ];
    const prescriptionFields = [
      formField("patient", "Patient ID / bed", { choices: patientChoices(), hint: "Choose an admitted patient; this order appears in the nurse medication list." }),
      formField("medication", "Medication name", { hint: "Verify medication against the authorized order." }),
      formField("dosage", "Dosage", { hint: "Enter the prescribed dose and units." }),
      formField("route", "Route", { choices: config.medicationRoutes, hint: "Select the prescribed administration route." }),
      formField("frequency", "Frequency", { choices: config.medicationFrequencies, hint: "Select the prescribed interval." }),
      formField("urgency", "Urgency level", { choices: ["Routine", "STAT"], hint: "Select STAT only when explicitly ordered." }),
      formField("scheduledAt", "Scheduled date and time", { type: "datetime-local", hint: "Enter the prescribed administration time in this station's local time." }),
      formField("totalDoses", "Planned total doses", { type: "number", min: 1, max: 365, required: false, value: "1", hint: "Enter the prescribed course length; defaults to one dose." })
    ];
    const labFields = [
      formField("patient", "Patient ID / bed", { choices: patientChoices(), hint: "Choose an admitted patient for the laboratory request." }),
      formField("test", "Diagnostic test", { choices: ["CBC", "Chemistry", "Urinalysis", "Blood Gas"], hint: "Select the requested diagnostic panel." }),
      formField("priority", "Order priority", { choices: ["Routine", "Urgent"], hint: "Use the priority specified in the authorized order." })
    ];
    const taskFields = [
      formField("patient", "Patient / MRN", { choices: patientChoices(), hint: "Select the inpatient for this physician-ordered care task." }),
      formField("title", "Care task / round item", { hint: "Enter the exact task from the approved care plan." }),
      formField("assignedNurse", "Assigned nurse", { choices: nurseChoices(), required: false, hint: "Optional. Unassigned tasks appear in the nurse task queue." }),
      formField("scheduledAt", "Due date and time", { type: "datetime-local", hint: "Set when the task should appear as due." }),
      formField("recurrence", "Repeat schedule", { choices: ["None", "Every 4 hours", "Every 6 hours", "Every 8 hours", "Each shift", "Daily"], hint: "Creates a next reminder after completion; follow the authorized order." })
    ];
    return `<div class="workspace-grid">
      ${card("Emergency Code Red dispatch", `<div class="notice danger">Broadcast an emergency alert only under approved hospital protocol. This browser-only prototype does not contact emergency services.</div>${activeBroadcast ? `<div class="alert-banner" role="alert"><div><strong>CODE RED ACTIVE</strong>${escapeHtml(activeBroadcast.message)}<small> · ${escapeHtml(formatDate(activeBroadcast.createdAt))}</small></div><button class="button button-quiet button-small" type="button" data-action="clear-broadcast" title="End the active station banner">Clear alert</button></div>` : `<form data-form="broadcast"><label for="broadcast-message">Emergency message</label><textarea id="broadcast-message" name="message" required minlength="4"></textarea><small class="helper">Share only concise operational details appropriate for an approved station-wide alert.</small><div class="form-actions"><button class="button button-danger" type="submit">Activate Code Red</button></div><small class="helper">Activation displays a banner on CORVIA workspaces in this browser only.</small></form>`}`, "span-12", activeBroadcast ? "priority-card" : "")}
      ${kpi("Active inpatients", admissions.length, "Admissions recorded at this station")}
      ${kpi("Telemetry alerts", countAbnormalVitals(), "Out-of-range entries require clinical review")}
      ${kpi("Pending lab orders", pendingLabs, "Orders awaiting a result")}
      ${card("Rapid patient admission", formCard("Admission details", "Create a station record and allocate a ward bed.", "admission", admissionFields, "Record admission"), "span-6")}
      ${card("Electronic prescription dispatch", formCard("Prescription details", "Record an order for the selected inpatient.", "prescription", prescriptionFields, "Dispatch prescription"), "span-6")}
      ${card("Laboratory order dispatch", formCard("Diagnostic order", "Add a request to the station laboratory queue.", "lab-order", labFields, "Send lab request"), "span-12")}
      ${card("Care task & ward-round schedule", formCard("Physician-ordered task", "Create a dated nursing reminder from an authorized order or care plan.", "round-task", taskFields, "Schedule care task"), "span-12")}
      ${card("Recent admissions", recordRows(admissions.slice().reverse().slice(0, 6), (patient) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(patient.name)} · ${escapeHtml(patient.mrn)}</strong><small>${escapeHtml(patient.diagnosis)}<br>${escapeHtml(patient.ward)} / Bed ${escapeHtml(patient.bed)} · ${escapeHtml(formatDate(patient.createdAt))}</small></div>${tag("Admitted", "done")}</div>`, "No admissions have been recorded yet."), "span-12")}
      ${card("Station laboratory queue", recordRows(data.labOrders.slice().reverse().slice(0, 5), (order) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(order.test)} · ${escapeHtml(order.patient)}</strong><small>${escapeHtml(order.status)} · ${escapeHtml(order.result || "Awaiting result")}</small></div>${tag(order.status, order.status === "Pending" ? "pending" : "done")}</div>`, "No laboratory orders are pending."), "span-12")}
    </div>`;
  }

  function nurseDashboard() {
    const patientOptions = patientChoices();
    const vitalsFields = [
      formField("patient", "Patient selection", { choices: patientOptions, hint: "Select the patient whose observations you are recording." }),
      formField("temperature", "Body temperature (°C)", { type: "number", min: 25, max: 45, step: .1, hint: "Enter measured temperature in degrees Celsius." }),
      formField("bloodPressure", "Blood pressure (mmHg)", { hint: "Enter systolic/diastolic, for example 120/80." }),
      formField("heartRate", "Heart rate (bpm)", { type: "number", min: 1, max: 300, hint: "Enter measured beats per minute." }),
      formField("respRate", "Respiration rate (cpm)", { type: "number", min: 1, max: 100, hint: "Enter measured cycles per minute." }),
      formField("spo2", "SpO₂ (%)", { type: "number", min: 1, max: 100, hint: "Enter measured peripheral oxygen saturation." })
    ];
    const callRecords = data.calls.filter((call) => call.status === "Active" && (!call.assignedNurse || nurseMatches(call.assignedNurse))).slice().reverse();
    const incomingAdmissions = data.admissions.filter((patient) =>
      !patient.intakeAcknowledgedAt && (!patient.assignedNurse || nurseMatches(patient.assignedNurse))
    ).slice().reverse();
    const dueTasks = data.roundTasks.filter((task) => task.status !== "Completed" && nurseMatches(task.assignedNurse))
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    const handovers = data.endorsements.filter((entry) => entry.acknowledgmentStatus !== "Acknowledged");
    const outstandingPrescriptions = data.prescriptions.filter((order) => order.status !== "Course completed" && order.status !== "Administered")
      .slice().reverse().sort((a, b) => Number(a.urgency !== "STAT") - Number(b.urgency !== "STAT") || new Date(a.scheduledAt) - new Date(b.scheduledAt));
    const completedPrescriptions = data.prescriptions.filter((order) => order.status === "Course completed" || order.status === "Administered").slice().reverse().slice(0, 8);
    const dueMedicationCount = outstandingPrescriptions.filter((order) => new Date(order.scheduledAt).getTime() <= Date.now()).length;
    const dueTaskCount = dueTasks.filter((task) => new Date(task.scheduledAt).getTime() <= Date.now()).length;
    const completedTaskEvents = data.auditLog.filter((entry) => entry.action === "Completed scheduled care task").slice().reverse().slice(0, 10);
    return `<div class="workspace-grid">
      ${incomingAdmissions.length ? card(`New admission handoff · ${incomingAdmissions.length}`, recordRows(incomingAdmissions, (patient) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(patient.name)} · ${escapeHtml(patient.mrn)}</strong><small>${escapeHtml(patient.ward)} / Bed ${escapeHtml(patient.bed)} · ${escapeHtml(patient.diagnosis)}<br>Assigned to ${escapeHtml(patient.nurse || "any nurse")} · Received ${escapeHtml(formatDate(patient.createdAt))}</small></div><div class="record-actions"><button class="button button-primary button-small" type="button" data-action="ack-admission" data-id="${escapeHtml(patient.id)}">Acknowledge intake</button></div></div>`, "No new admissions are awaiting acknowledgment."), "span-12", "priority-card") : ""}
      ${card(callRecords.length ? `Priority patient calls · ${callRecords.length}` : "Patient call bell monitor", recordRows(callRecords, (call) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(call.patientName)} · ${escapeHtml(call.ward)} / ${escapeHtml(call.bed)}</strong><small>${escapeHtml(call.requestType)} · ${escapeHtml(formatDate(call.createdAt))}</small></div><div class="record-actions"><button class="button button-primary button-small" type="button" data-action="ack-call" data-id="${escapeHtml(call.id)}" title="Acknowledge this patient request">Acknowledge call</button></div></div>`, "No active patient calls. New requests will appear here."), "span-12", callRecords.length ? "priority-card" : "")}
      ${dueMedicationCount ? card(`Medication reminders · ${dueMedicationCount} due`, `<div class="notice warning">Scheduled doses are due or overdue. Verify each order and patient against the approved medication record.</div>`, "span-12", "priority-card") : ""}
      ${card("Timed medication schedule", outstandingPrescriptions.length ? `<div class="record-list">${outstandingPrescriptions.map((order) => { const due = reminderFor(order, "medication", order.scheduledAt, `${order.medication} for ${order.patientName}`); const completedDoses = Number(order.completedDoses || 0); const totalDoses = Number(order.totalDoses || 1); return `<div class="record-item ${due ? "record-item-urgent" : ""}"><div class="record-item-main"><strong>${escapeHtml(order.medication)} · ${escapeHtml(order.dosage)}</strong><small>${escapeHtml(order.patientName)} · ${escapeHtml(order.route)} · ${escapeHtml(order.frequency)} · ${escapeHtml(order.urgency)}<br>Dose ${Math.min(completedDoses + 1, totalDoses)} of ${totalDoses} · Scheduled ${escapeHtml(formatDate(order.scheduledAt))}</small></div><div class="record-actions">${tag(due || order.urgency, due || order.urgency === "STAT" ? "urgent" : "pending")}<button class="button button-primary button-small" type="button" data-action="administer-medication" data-id="${escapeHtml(order.id)}" title="Record the next dose after verifying medication and patient">Record dose</button></div></div>`; }).join("")}</div>` : emptyState("No unadministered prescriptions are available for this station."), "span-12", dueMedicationCount ? "priority-card" : "")}
      ${dueTaskCount ? card(`Care reminders · ${dueTaskCount} due`, `<div class="notice warning">Scheduled care tasks are due or overdue. Follow the documented plan and local protocol.</div>`, "span-12", "priority-card") : ""}
      ${card("Scheduled rounds & care tasks", dueTasks.length ? `<div class="record-list">${dueTasks.map((task) => { const due = reminderFor(task, "round-task", task.scheduledAt, `${task.title} for ${task.patientName}`); return `<div class="record-item ${due ? "record-item-urgent" : ""}"><div class="record-item-main"><strong>${escapeHtml(task.title)} · ${escapeHtml(task.patientName)}</strong><small>${escapeHtml(task.patientMrn)} · ${escapeHtml(task.ward)} / ${escapeHtml(task.bed)} · ${escapeHtml(task.recurrence || "One time")}<br>Due ${escapeHtml(formatDate(task.scheduledAt))} · Ordered by ${escapeHtml(task.orderedBy)}</small></div><div class="record-actions">${tag(due || "Scheduled", due ? "urgent" : "pending")}<button class="button button-primary button-small" type="button" data-action="complete-round-task" data-id="${escapeHtml(task.id)}">Complete task</button></div></div>`; }).join("")}</div>` : emptyState("No care tasks are assigned to this nurse."), "span-12", dueTaskCount ? "priority-card" : "")}
      ${card("Recently completed care tasks", recordRows(completedTaskEvents, (entry) => `<div class="history-entry"><strong>${escapeHtml(entry.patientName)} · Complete</strong><span>${escapeHtml(entry.details)} · ${escapeHtml(entry.actor)}</span><time>${escapeHtml(formatDate(entry.createdAt))}</time></div>`, "No care tasks have been completed at this station."), "span-12")}
      ${handovers.length ? card(`Handover acknowledgment · ${handovers.length} pending`, recordRows(handovers, (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.patientName)} · ${escapeHtml(entry.originatingUnit || "Nursing")} → ${escapeHtml(entry.receivingUnit || "Nursing")}</strong><small>${escapeHtml(entry.summary)} · Sent by ${escapeHtml(entry.createdBy || "care team")}<br>${escapeHtml(formatDate(entry.createdAt))}</small></div><button class="button button-primary button-small" type="button" data-action="ack-endorsement" data-id="${escapeHtml(entry.id)}">Acknowledge handover</button></div>`, "No handovers await acknowledgment."), "span-12", "priority-card") : ""}
      ${card("Ward rounding overview", recordRows(data.admissions, (patient) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(patient.name)} · ${escapeHtml(patient.mrn)}</strong><small>${escapeHtml(patient.ward)} / ${escapeHtml(patient.bed)} · Assigned nurse: ${escapeHtml(patient.nurse || "Unassigned")} · ${escapeHtml(patient.diagnosis)}</small></div>${tag(patientNeedsReview(patient) ? "Needs review" : "Admitted", patientNeedsReview(patient) ? "critical" : "done")}</div>`, "No inpatients are currently recorded."), "span-12")}
      ${patientSearchCard()}
      ${card("Digital vital signs entry", `${formCard("Observation record", "Enter measured values; out-of-range readings are flagged for review.", "vitals", vitalsFields, "Evaluate and save observations")}<div id="vitals-result" aria-live="polite"></div>`, "span-8")}
      ${card("Latest observations", recordRows(data.vitals.slice().reverse().slice(0, 8), (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.patientName)} · ${escapeHtml(entry.bloodPressure)} mmHg</strong><small>Temp ${escapeHtml(entry.temperature)}°C · HR ${escapeHtml(entry.heartRate)} bpm · RR ${escapeHtml(entry.respRate)} cpm · SpO₂ ${escapeHtml(entry.spo2)}%<br>${escapeHtml(formatDate(entry.createdAt))}</small></div>${tag(entry.stable ? "Within configured range" : "Review reading", entry.stable ? "done" : "critical")}</div>`, "No vital signs have been recorded."), "span-12")}
      ${card("Completed medication courses", recordRows(completedPrescriptions, (order) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(order.medication)} · ${escapeHtml(order.patientName)}</strong><small>${escapeHtml(order.completedDoses || 1)} of ${escapeHtml(order.totalDoses || 1)} doses · Completed ${escapeHtml(formatDate(order.completedAt || order.administeredAt || order.createdAt))}</small></div>${tag("Course complete", "done")}</div>`, "No medication courses have been completed."), "span-12")}
      ${card("Nursing history & audit trail", recordRows(data.auditLog.slice().reverse().slice(0, 30), (entry) => `<div class="history-entry"><strong>${escapeHtml(entry.action)} · ${escapeHtml(entry.patientName)}</strong><span>${escapeHtml(entry.details)} · ${escapeHtml(entry.actor)}</span><time>${escapeHtml(formatDate(entry.createdAt))}</time></div>`, "No audit events have been recorded."), "span-12")}
    </div>`;
  }

  function getPatientAdmission() {
    return data.admissions.find((patient) => patient.mrn.toLocaleLowerCase() === activeUser.userId.toLocaleLowerCase()) ||
      data.admissions.find((patient) => patient.name.toLocaleLowerCase() === activeUser.fullName.toLocaleLowerCase());
  }

  function patientDashboard() {
    const admission = getPatientAdmission();
    const call = data.calls.find((entry) => entry.patientId === admission?.mrn && entry.status === "Active");
    const team = `<div class="patient-team"><div class="team-cell"><span>Patient</span><strong>${escapeHtml(admission?.name || activeUser.fullName)}</strong></div><div class="team-cell"><span>Assigned ward &amp; bed</span><strong>${admission ? `${escapeHtml(admission.ward)} / ${escapeHtml(admission.bed)}` : "Not assigned at this station"}</strong></div><div class="team-cell"><span>Primary physician</span><strong>${escapeHtml(admission?.physician || "Care team assignment pending")}</strong></div><div class="team-cell"><span>Charge nurse</span><strong>${escapeHtml(admission?.nurse || "Care team assignment pending")}</strong></div></div>`;
    return `<div class="workspace-grid">
      ${card("Your care team", `${admission ? `<div class="notice success">Your station record is linked to ${escapeHtml(admission.mrn)}. Contact your care team to correct any assignment details.</div>` : `<div class="notice warning">No admission matched this account ID or name. Ask your care team to verify that the account ID matches your medical record number.</div>`}${team}`, "span-8")}
      ${card("Request nurse assistance", `${call ? `<div class="notice warning">Your request is active. A nurse has been notified on this browser station.</div>` : `<p>Use this button to send an assistance request to the nurse console at this station. For immediate danger, use the hospital's established emergency procedure.</p>`}${!call && admission ? `<label for="patient-call-type">Request type</label><select id="patient-call-type">${config.patientCallTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("")}</select><small class="helper">Choose the reason that best describes the assistance you need.</small>` : ""}<button class="button emergency-button" type="button" data-action="patient-call" ${!admission || call ? "disabled" : ""} title="Send a patient assistance request to the nurse console">${call ? "Request is active" : "Request nurse assistance"}</button><small class="helper">This request is visible only in this browser's CORVIA nurse console; it is not an emergency service.</small>`, "span-4")}
      ${admission ? card("Your admission details", `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(admission.diagnosis)}</strong><small>Admitted ${escapeHtml(formatDate(admission.createdAt))}<br>Medical record number: ${escapeHtml(admission.mrn)}</small></div></div>`, "span-12") : ""}
    </div>`;
  }

  function workerDashboard() {
    const dept = activeUser.department;
    const patientField = () => formField("patient", "Patient / MRN", { choices: patientChoices(), hint: "Choose the current station patient record associated with this entry." });
    let title = roleName();
    let content = "";
    switch (dept) {
      case "er-triage": {
        const fields = [
          formField("patientName", "Patient name", { hint: "Use the verified name or authorized temporary identifier." }),
          formField("arrivalMode", "Arrival mode", { choices: ["Walk-in", "Ambulance", "Referral", "Transfer"], hint: "Record how the patient arrived at the emergency department." }),
          formField("complaint", "Chief complaint", { type: "textarea", hint: "Document the patient's presenting concern in their words when practical." }),
          formField("temperature", "Temperature (°C)", { type: "number", step: .1, min: 25, max: 45, hint: "Enter the measured temperature." }),
          formField("heartRate", "Heart rate (bpm)", { type: "number", min: 1, max: 300, hint: "Enter measured beats per minute." }),
          formField("bloodPressure", "Blood pressure (mmHg)", { hint: "Enter systolic/diastolic, for example 120/80." }),
          formField("respRate", "Respiration rate (cpm)", { type: "number", min: 1, max: 100, hint: "Enter measured cycles per minute." }),
          formField("spo2", "SpO₂ (%)", { type: "number", min: 1, max: 100, hint: "Enter measured oxygen saturation." }),
          formField("triageLevel", "Triage level", { choices: [{ value: "Red - Immediate", label: "Red - Immediate" }, { value: "Yellow - Emergent", label: "Yellow - Emergent" }, { value: "Green - Non-Urgent", label: "Green - Non-Urgent" }], hint: "Select the level using the facility's approved triage protocol." })
        ];
        content = formCard("ER arrival & triage", "Record arrival, presenting concern, observations, and assigned triage level.", "triage", fields, "Save triage assessment") + card("Recent triage assessments", recordRows(data.triage.slice().reverse().slice(0, 8), (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.patientName)} · ${escapeHtml(entry.triageLevel)}</strong><small>${escapeHtml(entry.complaint)} · ${escapeHtml(entry.arrivalMode)} · HR ${escapeHtml(entry.heartRate)} bpm · SpO₂ ${escapeHtml(entry.spo2)}%<br>${escapeHtml(formatDate(entry.createdAt))}</small></div>${tag(entry.triageLevel.split(" ")[0], entry.triageLevel.startsWith("Red") ? "critical" : "pending")}</div>`, "No triage assessments have been recorded."), "span-12");
        break;
      }
      case "icu-telemetry": {
        const fields = [
          patientField(), formField("heartRate", "Heart rate (bpm)", { type: "number", min: 1, max: 300, hint: "Enter measured beats per minute." }),
          formField("spo2", "SpO₂ (%)", { type: "number", min: 1, max: 100, hint: "Enter measured oxygen saturation." }),
          formField("map", "MAP (mmHg)", { type: "number", min: 1, max: 250, hint: "Enter the monitored mean arterial pressure." }),
          formField("ventilatorMode", "Ventilator mode", { choices: ["Room air / spontaneous", "CPAP", "BiPAP", "Assist control", "SIMV", "Other"], hint: "Select the current mode shown on the bedside device." }),
          formField("peep", "PEEP (cm H₂O)", { type: "number", min: 0, max: 40, step: .5, hint: "Enter the displayed positive end-expiratory pressure." }),
          formField("intake", "Fluid intake (mL)", { type: "number", min: 0, hint: "Enter intake for the documented observation period." }),
          formField("output", "Fluid output (mL)", { type: "number", min: 0, hint: "Enter measured output for the same observation period." })
        ];
        content = formCard("ICU telemetry observation", "Capture monitored values for handoff and review; this tool does not interpret alarms.", "telemetry", fields, "Save telemetry observation") + card("Recent telemetry", recordRows(data.telemetry.slice().reverse().slice(0, 8), (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.patientName)} · ${escapeHtml(entry.heartRate)} bpm · SpO₂ ${escapeHtml(entry.spo2)}%</strong><small>MAP ${escapeHtml(entry.map)} mmHg · ${escapeHtml(entry.ventilatorMode)} · PEEP ${escapeHtml(entry.peep)} · Fluid balance ${escapeHtml(entry.balance)} mL<br>${escapeHtml(formatDate(entry.createdAt))}</small></div>${tag(entry.alert ? "Review" : "Recorded", entry.alert ? "critical" : "done")}</div>`, "No telemetry observations have been recorded."), "span-12");
        break;
      }
      case "laboratory": {
        const fields = [
          patientField(), formField("test", "Diagnostic entry", { choices: ["CBC", "Chemistry", "Urinalysis", "Blood Gas"], hint: "Select the type of diagnostic result being documented." }),
          formField("result", "Result summary", { type: "textarea", hint: "Enter the verified result and units as released by the laboratory." }),
          formField("interpretation", "Interpretation / comment", { type: "textarea", required: false, hint: "Include reference or specimen notes needed for the receiving care team." })
        ];
        content = formCard("Laboratory result entry", "Record a verified diagnostic result and broadcast it to this station's ward queue.", "lab-result", fields, "Broadcast ward result") + card("Laboratory queue", recordRows(data.labOrders.slice().reverse().slice(0, 10), (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.test)} · ${escapeHtml(entry.patient)}</strong><small>${escapeHtml(entry.result || "Awaiting result")} · ${escapeHtml(formatDate(entry.createdAt))}</small></div>${tag(entry.status, entry.status === "Pending" ? "pending" : "done")}</div>`, "No lab orders are in this station queue."), "span-12");
        break;
      }
      case "pharmacy": {
        const pending = data.prescriptions.filter((entry) => entry.status === "Pending").slice().reverse();
        const fields = [
          formField("medication", "Medication name", { hint: "Enter the medication exactly as identified in the inventory." }),
          formField("quantity", "Available stock", { type: "number", min: 0, hint: "Enter the current verified on-hand quantity." }),
          formField("unit", "Stock unit", { hint: "Examples: tablets, vials, bottles. Use your inventory's unit." })
        ];
        content = card("Prescription fulfillment queue", recordRows(pending, (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.medication)} · ${escapeHtml(entry.dosage)}</strong><small>${escapeHtml(entry.patientName)} · ${escapeHtml(entry.route)} · ${escapeHtml(entry.frequency)} · ${escapeHtml(entry.urgency)}<br>Ordered ${escapeHtml(formatDate(entry.createdAt))}</small></div><div class="record-actions">${tag(entry.urgency, entry.urgency === "STAT" ? "urgent" : "pending")}<button class="button button-primary button-small" type="button" data-action="fulfill-prescription" data-id="${escapeHtml(entry.id)}" title="Verify this prescription and mark it fulfilled">Mark fulfilled</button></div></div>`, "There are no pending prescriptions."), "span-12") + formCard("Inventory check", "Record a count for local workstation reference; this is not a pharmacy inventory system.", "inventory", fields, "Save stock count") + card("Latest stock counts", recordRows(data.inventory.slice().reverse().slice(0, 8), (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.medication)} · ${escapeHtml(entry.quantity)} ${escapeHtml(entry.unit)}</strong><small>Counted ${escapeHtml(formatDate(entry.createdAt))}</small></div>${tag("Count recorded", "done")}</div>`, "No stock counts recorded."), "span-12");
        break;
      }
      case "internal-medicine": {
        const fields = [
          patientField(), formField("subjective", "S · Subjective", { type: "textarea", hint: "Record the patient's account and reported symptoms." }),
          formField("objective", "O · Objective", { type: "textarea", hint: "Record observed findings and available measurements." }),
          formField("assessment", "A · Assessment", { type: "textarea", hint: "Enter the responsible clinician's documented assessment." }),
          formField("plan", "P · Plan", { type: "textarea", hint: "Record the documented plan and follow-up." })
        ];
        const endorsementFields = [
          formField("patient", "Patient / MRN", { choices: patientChoices(), hint: "Select the patient relevant to this handoff." }),
          formField("receivingUnit", "Receiving ward / unit", { choices: wardChoices(), hint: "Select the nurse unit responsible for acknowledging the handoff." }),
          formField("endorsement", "Shift endorsement", { type: "textarea", hint: "Summarize outstanding care tasks and handoff items." })
        ];
        content = formCard("Daily SOAP progress note", "Record a structured progress note for the selected patient.", "soap", fields, "Save SOAP note") + formCard("Shift endorsement log", "Capture relevant continuity-of-care handoff information.", "endorsement", endorsementFields, "Save endorsement") + card("Recent notes & endorsements", recordRows([...data.soapNotes, ...data.endorsements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10), (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.patientName)} · ${escapeHtml(entry.kind)}</strong><small>${escapeHtml(entry.summary)}<br>${escapeHtml(formatDate(entry.createdAt))}</small></div>${entry.kind === "Shift endorsement" ? tag(entry.acknowledgmentStatus || "Pending acknowledgment", entry.acknowledgmentStatus === "Acknowledged" ? "done" : "pending") : tag(entry.kind, "done")}</div>`, "No notes or endorsements have been recorded."), "span-12");
        break;
      }
      case "opd": {
        const fields = [
          formField("patientName", "Patient name", { hint: "Enter the verified outpatient name." }),
          formField("clinicRoom", "Clinic room", { choices: ["Clinic 1", "Clinic 2", "Clinic 3", "Clinic 4", "Procedure Room"], hint: "Select the assigned consultation room." }),
          formField("doctor", "Doctor roster", { hint: "Enter the scheduled clinician's name." })
        ];
        const queue = data.opdQueue.filter((entry) => entry.status !== "Called").slice();
        content = formCard("Outpatient queue registration", "Add a patient to the station's consultation queue.", "opd-queue", fields, "Add to queue") + card("OPD consultation queue", recordRows(queue, (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.patientName)} · ${escapeHtml(entry.clinicRoom)}</strong><small>Clinician: ${escapeHtml(entry.doctor)} · Added ${escapeHtml(formatDate(entry.createdAt))}</small></div><button class="button button-primary button-small" type="button" data-action="call-opd" data-id="${escapeHtml(entry.id)}" title="Mark this patient as called to the clinic room">Call patient</button></div>`, "The outpatient queue is clear."), "span-12");
        break;
      }
      case "surgery": {
        const fields = [
          patientField(), formField("procedure", "Surgical procedure", { hint: "Enter the procedure as recorded in the operative documentation." }),
          formField("woundCondition", "Wound site condition", { choices: ["Clean / dry / intact", "Dressing intact", "Drainage observed", "Requires review"], hint: "Choose the observed wound site condition." }),
          formField("drainOutput", "Drain output (mL)", { type: "number", min: 0, step: .1, hint: "Record measured output for the period noted." }),
          formField("recoveryNotes", "Post-operative recovery log", { type: "textarea", hint: "Document relevant recovery observations and handoff information." })
        ];
        content = formCard("Post-operative recovery log", "Record observed recovery details and measured drain output.", "surgery-log", fields, "Save recovery log") + card("Recent recovery logs", recordRows(data.surgeryLogs.slice().reverse().slice(0, 10), (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.patientName)} · ${escapeHtml(entry.procedure)}</strong><small>${escapeHtml(entry.woundCondition)} · Drain ${escapeHtml(entry.drainOutput)} mL<br>${escapeHtml(entry.recoveryNotes)} · ${escapeHtml(formatDate(entry.createdAt))}</small></div>${tag("Recorded", "done")}</div>`, "No recovery logs have been recorded."), "span-12");
        break;
      }
      case "billing": {
        const fields = [
          formField("patientName", "Patient name / reference", { hint: "Use the approved billing reference; avoid unnecessary identifiers." }),
          formField("total", "Statement total (PHP)", { type: "number", min: 0, step: .01, hint: "Enter the current statement amount in Philippine pesos." }),
          formField("philhealth", "PhilHealth assistance (PHP)", { type: "number", min: 0, step: .01, value: 0, hint: "Enter the verified assistance amount, not an estimate." }),
          formField("malasakit", "Malasakit assistance (PHP)", { type: "number", min: 0, step: .01, value: 0, hint: "Enter verified assistance amount; confirm eligibility with the appropriate office." })
        ];
        const statements = data.billingStatements.slice().reverse().slice(0, 10);
        content = `<div class="notice warning">For station arithmetic only. Not a financial quote, eligibility decision, or billing system.</div>${formCard("Statement of account calculator", "Enter verified statement and assistance amounts to calculate an indicative balance.", "billing", fields, "Calculate and save")}${card("Recent calculations", recordRows(statements, (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.patientName)} · ₱${Number(entry.balance).toFixed(2)} indicative balance</strong><small>Total ₱${Number(entry.total).toFixed(2)} · PhilHealth ₱${Number(entry.philhealth).toFixed(2)} · Malasakit ₱${Number(entry.malasakit).toFixed(2)}<br>${escapeHtml(formatDate(entry.createdAt))}</small></div>${tag("Estimate only", "pending")}</div>`, "No calculations have been recorded."), "span-12")}`;
        break;
      }
      case "pathology": {
        const fields = [
          formField("specimenId", "Specimen tracking ID", { hint: "Enter the laboratory tracking identifier." }),
          formField("tissueSource", "Tissue source", { hint: "Record the source as labeled on the specimen." }),
          formField("findings", "Biopsy findings", { type: "textarea", hint: "Enter the approved report text from the pathologist." }),
          formField("approvedBy", "Diagnostic report approved by", { hint: "Enter the responsible approving pathologist." }),
          formField("approved", "I confirm the report has been reviewed and approved", { type: "checkbox", hint: "Required before the station records approval." })
        ];
        content = formCard("Specimen tracking & report approval", "Record specimen provenance and the responsible report approval.", "pathology", fields, "Record approved report") + card("Recent pathology records", recordRows(data.pathology.slice().reverse().slice(0, 10), (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.specimenId)} · ${escapeHtml(entry.tissueSource)}</strong><small>${escapeHtml(entry.findings)}<br>Approved by ${escapeHtml(entry.approvedBy)} · ${escapeHtml(formatDate(entry.createdAt))}</small></div>${tag("Approved", "done")}</div>`, "No pathology reports have been recorded."), "span-12");
        break;
      }
      case "pediatrics": {
        const fields = [
          formField("patientName", "Child name / reference", { hint: "Use the approved pediatric record identifier." }),
          formField("ageMonths", "Age (months)", { type: "number", min: 0, max: 240, hint: "Enter age in completed months." }),
          formField("weightKg", "Weight (kg)", { type: "number", min: .1, max: 250, step: .01, hint: "Enter the latest measured weight in kilograms." }),
          formField("doseMgKg", "Dose entered by clinician (mg/kg)", { type: "number", min: 0, step: .01, hint: "Enter only a dose explicitly prescribed or directed by a qualified clinician." }),
          formField("centile", "Growth chart centile", { type: "number", min: 0, max: 100, hint: "Enter the value read from the approved growth chart; do not infer." })
        ];
        content = `<div class="notice warning">Arithmetic support only. This calculator does not recommend doses, validate a prescription, or replace a pediatric reference and qualified clinical review.</div>${formCard("Pediatric growth & dose arithmetic", "Log measured age, weight, and centile; calculate entered mg/kg × kg only.", "pediatric", fields, "Calculate and save")}${card("Recent pediatric entries", recordRows(data.pediatricLogs.slice().reverse().slice(0, 10), (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.patientName)} · ${escapeHtml(entry.weightKg)} kg · ${escapeHtml(entry.ageMonths)} months</strong><small>Entered dose arithmetic: ${escapeHtml(entry.calculatedDose)} mg · Centile ${escapeHtml(entry.centile)}<br>${escapeHtml(formatDate(entry.createdAt))}</small></div>${tag("Review with clinician", "pending")}</div>`, "No pediatric entries have been recorded."), "span-12")}`;
        break;
      }
      case "operating-room": {
        const fields = [
          formField("patient", "Patient / MRN", { choices: patientChoices(), hint: "Select the patient listed for the procedure." }),
          formField("procedure", "Planned procedure", { hint: "Confirm the procedure against the approved record." }),
          formField("signIn", "Sign In completed with team", { type: "checkbox", hint: "Verify required Sign In checks per the facility's current checklist." }),
          formField("timeOut", "Time Out completed with team", { type: "checkbox", hint: "Verify the team Time Out before incision per facility protocol." }),
          formField("signOut", "Sign Out completed with team", { type: "checkbox", hint: "Verify Sign Out and handoff requirements before the patient leaves the room." }),
          formField("notes", "Checklist notes", { type: "textarea", required: false, hint: "Record any checklist discrepancy and escalation." })
        ];
        content = formCard("WHO Surgical Safety Checklist", "Record the team's Sign In, Time Out, and Sign Out verification.", "or-checklist", fields, "Save checklist verification") + card("Recent checklist records", recordRows(data.orChecklists.slice().reverse().slice(0, 8), (entry) => `<div class="record-item"><div class="record-item-main"><strong>${escapeHtml(entry.patientName)} · ${escapeHtml(entry.procedure)}</strong><small>Sign In: ${entry.signIn ? "Complete" : "Not complete"} · Time Out: ${entry.timeOut ? "Complete" : "Not complete"} · Sign Out: ${entry.signOut ? "Complete" : "Not complete"}<br>${escapeHtml(entry.notes || "No notes")} · ${escapeHtml(formatDate(entry.createdAt))}</small></div>${tag(entry.complete ? "All stages verified" : "Incomplete", entry.complete ? "done" : "pending")}</div>`, "No checklist records have been recorded."), "span-12");
        break;
      }
      default:
        content = `<div class="notice danger">This account has no configured department route. Log out and contact the station administrator.</div>`;
    }
    return `<div class="workspace-grid">${content}</div>`;
  }

  function broadcastBanner() {
    const broadcast = data.broadcasts.find((entry) => entry.active);
    return broadcast ? `<div class="station-alert" role="alert"><span class="station-alert-indicator" aria-hidden="true">!</span><div><strong>CODE RED · ACTIVE STATION ALERT</strong><span>${escapeHtml(broadcast.message)} · ${escapeHtml(formatDate(broadcast.createdAt))}</span></div></div>` : "";
  }

  function renderWorkspace() {
    const role = activeUser.role;
    const isWorker = role === "health-worker";
    $("#workspace-heading").textContent = isWorker ? roleName() : ({ doctor: "Attending physician command console", nurse: "Nurse station central console", patient: "Patient personal health portal" })[role];
    $("#workspace-section-name").textContent = (isWorker ? roleName() : role).toLocaleUpperCase();
    $("#workspace-description").textContent = ({
      doctor: "Coordinate admissions, prescribing, and station-wide operational communication.",
      nurse: "Document observations, respond to patient calls, and track medication orders.",
      patient: "Review your station care-team assignment and request nurse assistance.",
      "health-worker": "Complete department-specific station workflows and review saved entries."
    })[role];
    const dashboard = role === "doctor" ? doctorDashboard() : role === "nurse" ? nurseDashboard() : role === "patient" ? patientDashboard() : workerDashboard();
    workspaceContent.innerHTML = `${role !== "doctor" ? broadcastBanner() : ""}<aside class="workspace-prototype-notice" role="note" aria-label="Prototype and privacy notice"><span class="prototype-notice-icon" aria-hidden="true">i</span><p><strong>Local prototype — not a clinical system</strong><span>Data is stored only in this browser. This station is not connected to hospital records or emergency services. Do not enter real patient information.</span></p></aside>${dashboard}`;
    if ($("#field-total")) {
      $("#field-total").addEventListener("input", updateBillingPreview);
      $("#field-philhealth").addEventListener("input", updateBillingPreview);
      $("#field-malasakit").addEventListener("input", updateBillingPreview);
    }
  }

  function updateBillingPreview() {
    const total = Number($("#field-total").value || 0);
    const philhealth = Number($("#field-philhealth").value || 0);
    const malasakit = Number($("#field-malasakit").value || 0);
    let preview = $("#billing-preview");
    if (!preview) {
      preview = document.createElement("div");
      preview.id = "billing-preview";
      preview.className = "metric-result pending";
      $("#field-malasakit").closest(".form-card").querySelector("form").append(preview);
    }
    preview.textContent = `Indicative balance: ₱${Math.max(0, total - philhealth - malasakit).toFixed(2)} · assistance cannot exceed total`;
    preview.classList.toggle("alert", philhealth + malasakit > total);
    preview.classList.toggle("pending", philhealth + malasakit <= total);
  }

  function patientById(patientId) {
    return data.admissions.find((patient) => patient.mrn === patientId);
  }

  function formValues(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    $$(".field-wrap input[type=checkbox]", form).forEach((input) => { values[input.name] = input.checked; });
    return values;
  }

  function checkPatientSelection(values) {
    const patient = patientById(values.patient);
    if (!patient) throw new Error("Select an admitted patient before saving this entry.");
    return patient;
  }

  function addRecord(collection, record) {
    const storedRecord = { id: id(), createdAt: new Date().toISOString(), ...record };
    data[collection].push(storedRecord);
    const summary = storedRecord.medication || storedRecord.title || storedRecord.kind || storedRecord.test || storedRecord.diagnosis || storedRecord.ward || "Record saved";
    logAudit(`Created ${collection}`, storedRecord.patientName || storedRecord.name, summary);
    saveData();
    renderWorkspace();
  }

  function evaluateVitals(values) {
    const limits = config.telemetryThresholds;
    const [systolic, diastolic] = values.bloodPressure.split("/").map(Number);
    const numeric = {
      temperature: Number(values.temperature), heartRate: Number(values.heartRate),
      respRate: Number(values.respRate), spo2: Number(values.spo2),
      systolic, diastolic
    };
    const stable = numeric.temperature >= limits.temperatureC.min && numeric.temperature <= limits.temperatureC.max &&
      numeric.heartRate >= limits.heartRateBpm.min && numeric.heartRate <= limits.heartRateBpm.max &&
      numeric.respRate >= limits.respiratoryRateCpm.min && numeric.respRate <= limits.respiratoryRateCpm.max &&
      numeric.spo2 >= limits.spo2Percent.min && numeric.spo2 <= limits.spo2Percent.max &&
      numeric.systolic >= limits.systolicMmHg.min && numeric.systolic <= limits.systolicMmHg.max &&
      numeric.diastolic >= limits.diastolicMmHg.min && numeric.diastolic <= limits.diastolicMmHg.max;
    return { stable, numeric };
  }

  function handleForm(form) {
    const values = formValues(form);
    const now = new Date().toISOString();
    switch (form.dataset.form) {
      case "broadcast":
        if (data.broadcasts.some((entry) => entry.active)) throw new Error("A Code Red station alert is already active. Clear it before activating another.");
        if (values.message.trim().length < 4) throw new Error("Enter an emergency message with at least 4 characters.");
        confirmAction("Activate a Code Red alert across CORVIA workspaces in this browser station? This does not contact emergency services.", () => {
          data.broadcasts.push({ id: id(), message: values.message.trim(), active: true, createdAt: now });
          logAudit("Activated station alert", "Station", values.message.trim());
          saveData(); renderWorkspace(); notify("Code Red alert is active on this browser station.", "error");
        }, "Confirm Code Red activation");
        break;
      case "admission":
        if (data.admissions.some((entry) => entry.mrn.toLocaleLowerCase() === values.mrn.trim().toLocaleLowerCase())) throw new Error("That medical record number is already assigned to an admission.");
        if (data.admissions.some((entry) => entry.ward === values.ward && entry.bed.toLocaleLowerCase() === values.bed.trim().toLocaleLowerCase())) throw new Error("That bed is already allocated in this station.");
        if (values.assignedNurse && !getAccounts().some((account) => account.normalizedId === values.assignedNurse && account.role === "nurse")) throw new Error("Select an active nurse account or leave the admission unassigned.");
        const assignedNurse = getAccounts().find((account) => account.normalizedId === values.assignedNurse && account.role === "nurse");
        addRecord("admissions", {
          ...values, name: values.name.trim(), mrn: values.mrn.trim(), bed: values.bed.trim(),
          physician: activeUser.fullName, nurse: assignedNurse?.fullName || "Unassigned",
          assignedNurse: assignedNurse?.normalizedId || "", intakeAcknowledgedAt: ""
        });
        notify(assignedNurse ? `Admission recorded. ${assignedNurse.fullName} will see it in the nurse intake queue.` : "Admission recorded. It is flagged for nurse assignment and intake acknowledgment."); break;
      case "prescription": {
        const patient = checkPatientSelection(values);
        const totalDoses = Number(values.totalDoses || 1);
        if (!Number.isInteger(totalDoses) || totalDoses < 1 || totalDoses > 365) throw new Error("Planned total doses must be a whole number between 1 and 365.");
        if (totalDoses > 1 && !recurrenceMilliseconds(values.frequency)) throw new Error("Choose a recurring frequency when the prescribed course has more than one dose.");
        addRecord("prescriptions", { ...values, totalDoses, completedDoses: 0, patientName: patient.name, patientBed: `${patient.ward} / ${patient.bed}`, status: "Pending" });
        notify("Prescription added to the station medication queue."); break;
      }
      case "round-task": {
        const patient = checkPatientSelection(values);
        if (values.assignedNurse && !getAccounts().some((account) => account.normalizedId === values.assignedNurse && account.role === "nurse")) throw new Error("Select an active nurse account or leave this task unassigned.");
        const assignedNurse = getAccounts().find((account) => account.normalizedId === values.assignedNurse && account.role === "nurse");
        const scheduledAt = new Date(values.scheduledAt);
        if (!Number.isFinite(scheduledAt.getTime())) throw new Error("Enter a valid due date and time for this care task.");
        addRecord("roundTasks", {
          ...values, title: values.title.trim(), assignedNurse: assignedNurse?.normalizedId || "",
          patientName: patient.name, patientMrn: patient.mrn, ward: patient.ward, bed: patient.bed,
          orderedBy: activeUser.fullName, scheduledAt: scheduledAt.toISOString(), status: "Pending",
          recurrence: values.recurrence === "None" ? "" : values.recurrence
        });
        notify("Care task scheduled for the nurse station."); break;
      }
      case "lab-order": {
        const patient = checkPatientSelection(values);
        addRecord("labOrders", { ...values, patient: patient.mrn, patientName: patient.name, status: "Pending" });
        notify("Diagnostic request added to the station laboratory queue."); break;
      }
      case "vitals": {
        const patient = checkPatientSelection(values);
        if (!/^\d{2,3}\/\d{2,3}$/.test(values.bloodPressure)) throw new Error("Enter blood pressure as systolic/diastolic, for example 120/80.");
        const evaluation = evaluateVitals(values);
        addRecord("vitals", { ...values, patientName: patient.name, ward: patient.ward, bed: patient.bed, stable: evaluation.stable, values: evaluation.numeric });
        notify(evaluation.stable ? "Observations saved within configured station thresholds." : "Observations saved with an out-of-range flag. Follow clinical escalation policy.", evaluation.stable ? "success" : "error"); break;
      }
      case "triage":
        addRecord("triage", { ...values, patientName: values.patientName.trim() });
        notify("Triage assessment recorded."); break;
      case "telemetry": {
        const patient = checkPatientSelection(values);
        const balance = Number(values.intake) - Number(values.output);
        const alert = Number(values.spo2) < config.telemetryThresholds.spo2Percent.min || Number(values.heartRate) < config.telemetryThresholds.heartRateBpm.min || Number(values.heartRate) > config.telemetryThresholds.heartRateBpm.max;
        addRecord("telemetry", { ...values, patientName: patient.name, balance, alert });
        notify(alert ? "Telemetry saved with an out-of-range flag for review." : "Telemetry observation saved.", alert ? "error" : "success"); break;
      }
      case "lab-result": {
        const patient = checkPatientSelection(values);
        data.labResults.push({ id: id(), ...values, patientName: patient.name, createdAt: now });
        const order = data.labOrders.find((entry) => entry.patient === patient.mrn && entry.test === values.test && entry.status === "Pending");
        if (order) { order.status = "Result broadcast"; order.result = values.result; }
        logAudit("Recorded laboratory result", patient.name, `${values.test}: ${values.result}`);
        saveData(); renderWorkspace(); notify("Verified result broadcast to the station ward queue."); break;
      }
      case "inventory":
        addRecord("inventory", { ...values, quantity: Number(values.quantity), medication: values.medication.trim(), unit: values.unit.trim() });
        notify("Stock count saved for local station reference."); break;
      case "soap": {
        const patient = checkPatientSelection(values);
        addRecord("soapNotes", { ...values, patientName: patient.name, kind: "SOAP note", summary: `${values.subjective} ${values.assessment}`.slice(0, 250) });
        notify("SOAP progress note saved."); break;
      }
      case "endorsement": {
        const patient = checkPatientSelection(values);
        const receivingUnit = config.wards.find((ward) => ward.id === values.receivingUnit);
        addRecord("endorsements", {
          patientName: patient.name, patientMrn: patient.mrn, kind: "Shift endorsement",
          summary: values.endorsement.trim(), originatingUnit: roleName(),
          receivingUnit: receivingUnit?.name || "Nursing unit",
          createdBy: activeUser.fullName, acknowledgmentStatus: "Pending"
        });
        notify("Handover saved and placed in the receiving nurse station acknowledgment queue."); break;
      }
      case "opd-queue":
        addRecord("opdQueue", { ...values, patientName: values.patientName.trim(), status: "Waiting" });
        notify("Patient added to the OPD queue."); break;
      case "surgery-log": {
        const patient = checkPatientSelection(values);
        addRecord("surgeryLogs", { ...values, patientName: patient.name, drainOutput: Number(values.drainOutput) });
        notify("Post-operative recovery log saved."); break;
      }
      case "billing": {
        const total = Number(values.total);
        const philhealth = Number(values.philhealth);
        const malasakit = Number(values.malasakit);
        if (philhealth + malasakit > total) throw new Error("Assistance amounts cannot exceed the statement total.");
        const balance = total - philhealth - malasakit;
        addRecord("billingStatements", { ...values, total, philhealth, malasakit, balance, patientName: values.patientName.trim() });
        notify(`Indicative balance: ₱${balance.toFixed(2)}. This is not a financial quote.`); break;
      }
      case "pathology":
        if (!values.approved) throw new Error("Confirm report review and approval before recording this report.");
        addRecord("pathology", { ...values, approved: true, specimenId: values.specimenId.trim() });
        notify("Approved pathology report recorded."); break;
      case "pediatric": {
        const calculatedDose = Number(values.doseMgKg) * Number(values.weightKg);
        addRecord("pediatricLogs", { ...values, calculatedDose: calculatedDose.toFixed(2), weightKg: Number(values.weightKg), ageMonths: Number(values.ageMonths), centile: Number(values.centile) });
        notify(`Entered-dose arithmetic: ${calculatedDose.toFixed(2)} mg. Verify against an authoritative clinical reference.`); break;
      }
      case "or-checklist": {
        const patient = checkPatientSelection(values);
        const complete = values.signIn && values.timeOut && values.signOut;
        addRecord("orChecklists", { ...values, patientName: patient.name, complete });
        notify(complete ? "All checklist stages recorded as verified." : "Checklist saved as incomplete. Complete required checks per facility protocol.", complete ? "success" : "error"); break;
      }
      default:
        throw new Error("This station action is not available.");
    }
  }

  function confirmAction(message, callback, title = "Confirm action") {
    $("#confirm-title").textContent = title;
    $("#confirm-copy").textContent = message;
    confirmationCallback = callback;
    $("#confirm-dialog").showModal();
  }

  function handleAction(button) {
    const action = button.dataset.action;
    const record = (collection) => data[collection].find((entry) => entry.id === button.dataset.id);
    if (action === "clear-patient-search") {
      patientSearchFilters = { query: "", ward: "", status: "", department: "", from: "", to: "" };
      renderWorkspace();
    } else if (action === "clear-broadcast") {
      confirmAction("Clear the active Code Red banner from this browser station?", () => {
        const broadcast = data.broadcasts.find((entry) => entry.active);
        if (broadcast) {
          broadcast.active = false;
          logAudit("Cleared station alert", "Station", broadcast.message);
        }
        saveData(); renderWorkspace(); notify("The station alert has been cleared.");
      }, "Clear Code Red alert?");
    } else if (action === "ack-admission") {
      const patient = record("admissions");
      if (patient && !patient.intakeAcknowledgedAt && nurseMatches(patient.assignedNurse)) {
        patient.intakeAcknowledgedAt = new Date().toISOString();
        patient.intakeAcknowledgedBy = activeUser.fullName;
        logAudit("Acknowledged admission intake", patient.name, `${patient.ward} / ${patient.bed}`);
        saveData(); renderWorkspace(); notify("Admission intake acknowledged.");
      }
    } else if (action === "ack-call") {
      const call = record("calls");
      if (call) {
        call.status = "Acknowledged"; call.acknowledgedAt = new Date().toISOString();
        call.acknowledgedBy = activeUser.fullName;
        logAudit("Acknowledged patient call", call.patientName, call.requestType);
        saveData(); renderWorkspace(); notify("Patient call acknowledged.");
      }
    } else if (action === "ack-endorsement") {
      const endorsement = record("endorsements");
      if (endorsement && endorsement.acknowledgmentStatus !== "Acknowledged") {
        endorsement.acknowledgmentStatus = "Acknowledged";
        endorsement.acknowledgedAt = new Date().toISOString();
        endorsement.acknowledgedBy = activeUser.fullName;
        logAudit("Acknowledged shift handover", endorsement.patientName, `${endorsement.originatingUnit} to ${endorsement.receivingUnit}`);
        saveData(); renderWorkspace(); notify("Patient handover acknowledgment recorded.");
      }
    } else if (action === "complete-round-task") {
      const task = record("roundTasks");
      if (task && task.status !== "Completed" && nurseMatches(task.assignedNurse)) {
        const recurrence = recurrenceMilliseconds(task.recurrence);
        task.completedAt = new Date().toISOString();
        task.completedBy = activeUser.fullName;
        if (recurrence) {
          task.status = "Pending";
          task.scheduledAt = new Date(Date.now() + recurrence).toISOString();
        } else {
          task.status = "Completed";
        }
        logAudit("Completed scheduled care task", task.patientName, `${task.title}${recurrence ? `; next due ${formatDate(task.scheduledAt)}` : ""}`);
        saveData(); renderWorkspace(); notify(recurrence ? `Task completed. Next reminder: ${formatDate(task.scheduledAt)}.` : "Care task marked complete.");
      }
    } else if (action === "administer-medication") {
      const order = record("prescriptions");
      if (order) confirmAction(`Confirm ${order.medication} ${order.dosage} was administered to ${order.patientName} as prescribed?`, () => {
        const now = new Date();
        const totalDoses = Number(order.totalDoses || 1);
        order.completedDoses = Number(order.completedDoses || 0) + 1;
        order.lastAdministeredAt = now.toISOString();
        order.administeredBy = activeUser.fullName;
        if (order.completedDoses >= totalDoses) {
          order.status = "Course completed";
          order.completedAt = now.toISOString();
        } else {
          const interval = recurrenceMilliseconds(order.frequency);
          order.status = "Pending";
          order.scheduledAt = new Date(now.getTime() + interval).toISOString();
        }
        logAudit("Recorded medication dose", order.patientName, `${order.medication}; dose ${order.completedDoses}/${totalDoses}; ${order.status}`);
        saveData(); renderWorkspace();
        notify(order.status === "Course completed" ? "Medication course marked complete." : `Dose recorded. Next dose due ${formatDate(order.scheduledAt)}.`);
      }, "Confirm medication administration");
    } else if (action === "patient-call") {
      const patient = getPatientAdmission();
      if (!patient) return notify("No matching admission is available for this account.", "error");
      data.calls.push({ id: id(), patientId: patient.mrn, patientName: patient.name, ward: patient.ward, bed: patient.bed, assignedNurse: patient.assignedNurse || "", requestType: $("#patient-call-type")?.value || "Patient assistance request", status: "Active", createdAt: new Date().toISOString() });
      logAudit("Sent nurse assistance request", patient.name, $("#patient-call-type")?.value || "Patient assistance request");
      saveData(); renderWorkspace(); notify("Assistance request sent to the nurse console on this station.");
    } else if (action === "fulfill-prescription") {
      const order = record("prescriptions");
      if (order) confirmAction(`Confirm dosage and inventory verification for ${order.medication}, ${order.dosage}, for ${order.patientName}?`, () => {
        order.status = "Fulfilled"; order.fulfilledAt = new Date().toISOString();
        logAudit("Fulfilled prescription", order.patientName, order.medication);
        saveData(); renderWorkspace(); notify("Prescription marked fulfilled.");
      }, "Confirm prescription fulfillment");
    } else if (action === "call-opd") {
      const entry = record("opdQueue");
      if (entry) { entry.status = "Called"; entry.calledAt = new Date().toISOString(); saveData(); renderWorkspace(); notify(`${entry.patientName} marked as called to ${entry.clinicRoom}.`); }
    }
  }

  function loadData() {
    dataWritable = true;
    try {
      const stored = readStored(config.storageKeys.data, {});
      data = { ...blankData(), ...stored };
      Object.keys(blankData()).forEach((key) => {
        if (!Array.isArray(data[key])) throw new Error(`Saved station collection "${key}" is invalid.`);
      });
    } catch (error) {
      console.error("CORVIA station data could not be initialized.", error);
      data = blankData();
      dataWritable = false;
      notify(`${error.message} New entries will not replace the unreadable data.`, "error");
      $("#sync-status").textContent = "Review required";
    }
  }

  function restoreLegacyDemoData() {
    const modeKey = "corvia.demo-mode.v1";
    const backupKey = "corvia.demo-backup.v1";
    if (localStorage.getItem(modeKey) !== "true") return;
    try {
      const backupText = localStorage.getItem(backupKey);
      if (backupText === null) throw new Error("The previous station-data backup is missing.");
      const backup = JSON.parse(backupText);
      if (!backup || !Object.prototype.hasOwnProperty.call(backup, "raw") ||
          (backup.raw !== null && typeof backup.raw !== "string")) {
        throw new Error("The previous station-data backup could not be verified.");
      }
      if (backup.raw === null) localStorage.removeItem(config.storageKeys.data);
      else localStorage.setItem(config.storageKeys.data, backup.raw);
      localStorage.removeItem(modeKey);
      localStorage.removeItem(backupKey);
      notify("Previous station data restored. The sample station has been removed.");
    } catch (error) {
      console.error("CORVIA could not restore station data from a previous demo session.", error);
      notify("Previous sample mode was detected, but its saved station data could not be restored. Do not clear browser data.", "error");
    }
  }

  function bindEvents() {
    $("#current-year").textContent = String(new Date().getFullYear());
    $("#login-tab").addEventListener("click", () => switchTab("login"));
    $("#signup-tab").addEventListener("click", () => switchTab("signup"));
    $("#login-role").addEventListener("change", () => toggleDepartment($("#login-role"), $("#login-department-wrap"), $("#login-department")));
    $("#signup-role").addEventListener("change", () => toggleDepartment($("#signup-role"), $("#signup-department-wrap"), $("#signup-department")));
    $("#login-panel").addEventListener("submit", (event) => { event.preventDefault(); authenticate(event.currentTarget); });
    $("#signup-panel").addEventListener("submit", (event) => { event.preventDefault(); registerAccount(event.currentTarget); });
    $$(".password-toggle").forEach((button) => button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.togglePassword);
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.textContent = visible ? "Hide" : "Show";
      button.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    }));
    $("#logout-button").addEventListener("click", showGateway);
    $("#return-gateway").addEventListener("click", showGateway);
    workspaceContent.addEventListener("submit", (event) => {
      if (event.target.id === "patient-search-form") {
        event.preventDefault();
        patientSearchFilters = Object.fromEntries(new FormData(event.target).entries());
        renderWorkspace();
        $("#patient-search-form input[name=query]")?.focus({ preventScroll: true });
        return;
      }
      const form = event.target.closest("form[data-form]");
      if (!form) return;
      event.preventDefault();
      try { handleForm(form); }
      catch (error) { console.error("CORVIA station workflow failed.", error); notify(error.message || "The station action could not be completed.", "error"); }
    });
    workspaceContent.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (button) handleAction(button);
    });
    $("#confirm-dialog").addEventListener("close", () => {
      if ($("#confirm-dialog").returnValue === "confirm" && confirmationCallback) confirmationCallback();
      confirmationCallback = null;
    });
    window.addEventListener("storage", (event) => {
      if (event.key === config.storageKeys.data) {
        loadData();
        if (activeUser && dataWritable) renderWorkspace();
        if (dataWritable) notify("Station data synchronized from another CORVIA tab.");
      }
    });
    window.setInterval(checkScheduledReminders, 30000);
  }

  function startIntro() {
    const intro = $("#intro-splash");
    const skipButton = $("#skip-intro");
    if (!intro || !skipButton) return;

    const introStorageKey = "corvia.intro-seen.v1";
    try {
      if (window.sessionStorage.getItem(introStorageKey) === "true") {
        intro.remove();
        $("#main-content").inert = false;
        $(".site-header").inert = false;
        $(".ticker").inert = false;
        return;
      }
      window.sessionStorage.setItem(introStorageKey, "true");
    } catch (error) {
      console.error("CORVIA could not save the intro preference for this browser session.", error);
    }

    let dismissed = false;
    const dismiss = (focusGateway = false) => {
      if (dismissed) return;
      dismissed = true;
      intro.classList.add("is-leaving");
      $("#main-content").inert = false;
      $(".site-header").inert = false;
      $(".ticker").inert = false;
      if (focusGateway) $("#login-role").focus({ preventScroll: true });
      window.setTimeout(() => intro.remove(), 600);
    };

    skipButton.addEventListener("click", () => dismiss(true), { once: true });
    const introDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 850 : 2600;
    window.setTimeout(() => dismiss(), introDuration);
  }

  restoreLegacyDemoData();
  loadData();
  bindEvents();
  startIntro();
  tickClock();
  window.scrollTo(0, 0);
  window.setInterval(tickClock, 1000);
})();
