/* CORVIA station configuration. Values are demonstration defaults, not clinical policy. */
window.CORVIA_CONFIG = Object.freeze({
  hospitalName: "CORVIA Regional Hospital",
  nodeId: "HOSPITAL INTRANET NODE 01",
  storageKeys: Object.freeze({
    accounts: "corvia.accounts.v1",
    data: "corvia.station-data.v1"
  }),
  wards: Object.freeze([
    { id: "W01", name: "Medical Ward" },
    { id: "W02", name: "Surgical Ward" },
    { id: "W03", name: "Pediatric Ward" },
    { id: "W04", name: "Intensive Care Unit" },
    { id: "W05", name: "Emergency Department" },
    { id: "W06", name: "Maternity Ward" }
  ]),
  departments: Object.freeze([
    { id: "er-triage", name: "ER Triage Specialist" },
    { id: "icu-telemetry", name: "ICU Telemetry Specialist" },
    { id: "laboratory", name: "Laboratory Technician" },
    { id: "pharmacy", name: "Pharmacist / Dispenser" },
    { id: "internal-medicine", name: "Internal Medicine Ward Staff" },
    { id: "opd", name: "OPD Consultation Staff" },
    { id: "surgery", name: "Surgery Ward Staff" },
    { id: "billing", name: "Billing & Subsidy Specialist" },
    { id: "pathology", name: "Pathology Staff" },
    { id: "pediatrics", name: "Pediatric Ward Staff" },
    { id: "operating-room", name: "DR / OR Staff" }
  ]),
  departmentRoutes: Object.freeze({
    "er-triage": "health-worker",
    "icu-telemetry": "health-worker",
    laboratory: "health-worker",
    pharmacy: "health-worker",
    "internal-medicine": "health-worker",
    opd: "health-worker",
    surgery: "health-worker",
    billing: "health-worker",
    pathology: "health-worker",
    pediatrics: "health-worker",
    "operating-room": "health-worker"
  }),
  shifts: Object.freeze([
    { name: "Shift 1: Morning Duty", start: "06:00", end: "14:00" },
    { name: "Shift 2: Evening Duty", start: "14:00", end: "22:00" },
    { name: "Shift 3: Night Duty", start: "22:00", end: "06:00" }
  ]),
  telemetryThresholds: Object.freeze({
    temperatureC: Object.freeze({ min: 36.1, max: 37.8 }),
    heartRateBpm: Object.freeze({ min: 60, max: 100 }),
    respiratoryRateCpm: Object.freeze({ min: 12, max: 20 }),
    spo2Percent: Object.freeze({ min: 94, max: 100 }),
    systolicMmHg: Object.freeze({ min: 90, max: 140 }),
    diastolicMmHg: Object.freeze({ min: 60, max: 90 })
  }),
  patientCallTypes: Object.freeze(["Pain or discomfort", "Medication question", "Assistance with mobility", "Personal care", "Other assistance"]),
  medicationRoutes: Object.freeze(["Oral", "IV"]),
  medicationFrequencies: Object.freeze(["Once", "Every 4 hours", "Every 6 hours", "Every 8 hours", "Every 12 hours", "Daily"])
});
