import React, { useEffect, useRef, useState } from "react";
import aimiesLogoImage from "./assets/aimies-logo.svg";

const STORAGE_KEY = "aimies.people.role.portal";
const SESSION_KEY = "aimies.people.role.session";
const LOCAL_PASSWORDS_KEY = "aimies.people.local.passwords";
const REMEMBERED_EMAIL_KEY = "aimies.people.remembered.email";
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://127.0.0.1:5018" : "");
const DEFAULT_ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "sayanezrin@gmail.com";
const LOCAL_ADMIN_PASSWORD = import.meta.env.VITE_LOCAL_ADMIN_PASSWORD || "";
const ACCOUNTANT_EMAIL = import.meta.env.VITE_ACCOUNTANT_EMAIL || "";
const OWNER_WHATSAPP_NUMBER = import.meta.env.VITE_OWNER_WHATSAPP_NUMBER || "";
const COMPANY_LEGAL_NAME = import.meta.env.VITE_COMPANY_LEGAL_NAME || "AIMIE FOODS AND OIL EXPORTS";
const COMPANY_ADDRESS = import.meta.env.VITE_COMPANY_ADDRESS || "8/147, Mannam, Chittattukara, N. Paravoor, PIN - 683520";
const COMPANY_GSTIN = import.meta.env.VITE_COMPANY_GSTIN || "32AYAPR8158A1ZN";
const COMPANY_FSSAI = import.meta.env.VITE_COMPANY_FSSAI || "10020041002649";
const COMPANY_PHONE = import.meta.env.VITE_COMPANY_PHONE || "0484 2940548";
const COMPANY_MOBILE = import.meta.env.VITE_COMPANY_MOBILE || "7511111178, 9895505488";
const COMPANY_EMAIL = import.meta.env.VITE_COMPANY_EMAIL || "aimiefoodsandoilexports@gmail.com";
const ALLOW_LOCAL_FALLBACK_LOGIN = import.meta.env.DEV && import.meta.env.VITE_ALLOW_LOCAL_FALLBACK_LOGIN !== "false";
const CHECKIN_LOCATION = {
  latitude: Number(import.meta.env.VITE_CHECKIN_LATITUDE || 10.011327),
  longitude: Number(import.meta.env.VITE_CHECKIN_LONGITUDE || 76.3607931),
  radiusMeters: Number(import.meta.env.VITE_CHECKIN_RADIUS_METERS || 200)
};

const roles = {
  admin: { title: "Admin", email: DEFAULT_ADMIN_EMAIL, password: LOCAL_ADMIN_PASSWORD },
  hr: { title: "HR / Accountant", email: "hr@aimies.local" },
  employee: { title: "Employee", email: "employee@aimies.local" },
  localSeller: { title: "Local Seller", email: "seller@aimies.local" }
};

const seedState = {
  employees: [],
  logins: [],
  ledger: [],
  expenses: [],
  leaves: [],
  attendance: [],
  sellerCustomers: [],
  sellerBills: [],
  sellerPerformaBills: []
};

function today() {
  return dateInputValue(new Date());
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

function readState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...seedState, ...JSON.parse(saved) } : seedState;
  } catch {
    return seedState;
  }
}

function writeState(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // The UI remains usable even if browser storage is unavailable.
  }
}

function readRememberedEmail() {
  try {
    return window.localStorage.getItem(REMEMBERED_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

function writeRememberedEmail(email) {
  try {
    const normalizedEmail = String(email || "").trim();
    if (normalizedEmail) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
  } catch {
    // Remembering the email is only a convenience.
  }
}

function hasPortalData(value) {
  return Boolean(value?.employees && value?.ledger && value?.expenses && value?.leaves && value?.attendance);
}

function readSession() {
  try {
    const saved = window.localStorage.getItem(SESSION_KEY);
    const session = saved ? JSON.parse(saved) : null;
    return session?.token ? session : null;
  } catch {
    return null;
  }
}

function writeSession(value) {
  try {
    if (value) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Session persistence is a convenience; the current tab can still continue.
  }
}

function isInstalledWebApp() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function readLocalPasswords() {
  try {
    const saved = window.localStorage.getItem(LOCAL_PASSWORDS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function writeLocalPasswords(value) {
  try {
    window.localStorage.setItem(LOCAL_PASSWORDS_KEY, JSON.stringify(value));
  } catch {
    // Local fallback passwords are best-effort only.
  }
}

function normalizeRole(role) {
  const value = role?.trim().toLowerCase() || "employee";
  if (value === "hr / accountant" || value === "accountant") return "hr";
  if (value === "local seller" || value === "local-seller" || value === "localseller" || value === "seller") return "localSeller";
  return value;
}

function getFirstName(name, email = "") {
  const nameFirst = String(name || "").trim().split(/\s+/).find(Boolean);
  const emailFirst = String(email || "").trim().split("@")[0]?.split(/[._-]/).find(Boolean);
  const rawFirst = nameFirst || emailFirst || "Employee";
  return rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();
}

function initialPasswordForUser(user) {
  return `${getFirstName(user?.name, user?.email)}@123`;
}

function localPasswordKey(email, role) {
  return `${normalizeRole(role)}:${String(email || "").trim().toLowerCase()}`;
}

function getLocalPasswordLogin({ email, password, selectedRole, store }) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedRole = normalizeRole(selectedRole);

  if (normalizedEmail === roles.admin.email) {
    if (normalizedRole !== "admin" || !roles.admin.password || password.trim() !== roles.admin.password) return null;
    return { email: normalizedEmail, name: "Saya Nezrin", role: "admin", provider: "local-password", token: `local-${Date.now()}`, mustChangePassword: true };
  }

  const registeredUser = [
    { email: roles.hr.email, name: roles.hr.title, accessRole: "hr" },
    { email: roles.employee.email, name: roles.employee.title, accessRole: "employee" },
    { email: roles.localSeller.email, name: roles.localSeller.title, accessRole: "localSeller" },
    ...(store.logins || []),
    ...(store.employees || [])
  ].find((user) => user.email?.trim().toLowerCase() === normalizedEmail && normalizeRole(user.accessRole) === normalizedRole);

  if (!registeredUser) return null;
  const savedPassword = readLocalPasswords()[localPasswordKey(normalizedEmail, normalizedRole)];
  if (savedPassword) {
    if (password.trim() !== savedPassword) return null;
  } else if (password.trim() !== initialPasswordForUser({ ...registeredUser, email: normalizedEmail })) {
    return null;
  }

  return {
    email: normalizedEmail,
    name: registeredUser?.name || roles[normalizedRole]?.title || "Employee",
    role: normalizedRole,
    provider: "local-password",
    token: `local-${Date.now()}`,
    mustChangePassword: !savedPassword
  };
}

async function apiJson(path, options = {}) {
  const session = readSession();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || payload.detail || `API request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

async function savePortalState(value) {
  writeState(value);
  try {
    await apiJson("/api/portal", {
      method: "PUT",
      body: JSON.stringify(value)
    });
  } catch {
    // Local storage remains the offline fallback when the API is unavailable.
  }
}

function findChangedAttendanceRecord(previousAttendance = [], nextAttendance = []) {
  return nextAttendance.find((record) => {
    const previous = previousAttendance.find((item) => item.id === record.id);
    return !previous || JSON.stringify(previous) !== JSON.stringify(record);
  });
}

function money(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function amountInWords(value) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const belowHundred = (number) => number < 20 ? ones[number] : `${tens[Math.floor(number / 10)]}${number % 10 ? ` ${ones[number % 10]}` : ""}`;
  const belowThousand = (number) => {
    const hundred = Math.floor(number / 100);
    const rest = number % 100;
    return `${hundred ? `${ones[hundred]} Hundred` : ""}${hundred && rest ? " " : ""}${rest ? belowHundred(rest) : ""}`.trim();
  };
  let number = Math.round(Number(value || 0));
  if (!number) return "INR Zero Only";
  const parts = [];
  const crore = Math.floor(number / 10000000);
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  number %= 10000000;
  const lakh = Math.floor(number / 100000);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  number %= 100000;
  const thousand = Math.floor(number / 1000);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  number %= 1000;
  if (number) parts.push(belowThousand(number));
  return `INR ${parts.join(" ")} Only`;
}

const financePrimaryColumns = [
  { key: "buyerSupplierPincode", label: "Buyer/Supplier - Pincode" },
  { key: "ledgerName", label: "Ledger Name" },
  { key: "ledgerAmount", label: "Ledger Amount", currency: true },
  { key: "ledgerAmountDrCr", label: "Ledger Amount Dr/Cr" },
  { key: "itemName", label: "Item Name" },
  { key: "billedQuantity", label: "Billed Quantity" },
  { key: "itemRate", label: "Item Rate", currency: true },
  { key: "itemRatePer", label: "Item Rate per" },
  { key: "itemAmount", label: "Item Amount", currency: true },
  { key: "changeMode", label: "Change Mode" },
  { key: "narration", label: "Narration" }
];
const financeRegisterColumns = [{ key: "date", label: "Date" }, ...financePrimaryColumns];
const ledgerCsvColumns = ["id", "type", "date", "account", "category", "amount", "note", "createdBy", ...financePrimaryColumns];
const expenseCsvColumns = ["id", "employeeId", "employeeName", "category", "date", "amount", "notes", "status", "submittedAt", "createdBy", "receiptName"];
const financeExportColumns = financeRegisterColumns;
const TOAST_EVENT = "aimies-toast";

const stockMaterials = [
  { id: "oil", name: "Oil", unit: "L" },
  { id: "bottle500", name: "500 ml Bottle", unit: "pcs" },
  { id: "bottle1l", name: "1 L Bottle", unit: "pcs" },
  { id: "bottle2l", name: "2 L Bottle", unit: "pcs" },
  { id: "can5l", name: "5 L Can", unit: "pcs" },
  { id: "can15kg", name: "15 kg Can", unit: "pcs" },
  { id: "sticker500", name: "500 ml Sticker", unit: "pcs" },
  { id: "sticker1l", name: "1 L Sticker", unit: "pcs" },
  { id: "sticker2l", name: "2 L Sticker", unit: "pcs" },
  { id: "sticker5l", name: "5 L Sticker", unit: "pcs" },
  { id: "sticker15kg", name: "15 kg Sticker", unit: "pcs" },
  { id: "bottleCap", name: "Bottle Cap", unit: "pcs" },
  { id: "canCap", name: "Can Cap", unit: "pcs" },
  { id: "band", name: "Band", unit: "pcs" },
  { id: "plastic", name: "Plastic / Wrap", unit: "pcs" },
  { id: "box500", name: "500 ml Box", unit: "pcs" },
  { id: "box1l", name: "1 L Box", unit: "pcs" },
  { id: "box2l", name: "2 L Box", unit: "pcs" },
  { id: "box5l", name: "5 L Box", unit: "pcs" },
  { id: "box15kg", name: "15 kg Box", unit: "pcs" }
];
const stockMaterialMap = Object.fromEntries(stockMaterials.map((material) => [material.id, material]));
const stockProducts = [
  { id: "p500", name: "500 ml Bottle", piecesPerCase: 24, drawPerPiece: { oil: 0.5, bottle500: 1, sticker500: 1, bottleCap: 1, band: 1 }, drawPerCase: { plastic: 1, box500: 1 } },
  { id: "p1l", name: "1 L Bottle", piecesPerCase: 12, drawPerPiece: { oil: 1, bottle1l: 1, sticker1l: 1, bottleCap: 1, band: 1 }, drawPerCase: { plastic: 1 } },
  { id: "p2l", name: "2 L Bottle", piecesPerCase: 6, drawPerPiece: { oil: 2, bottle2l: 1, sticker2l: 1, bottleCap: 1, band: 1 }, drawPerCase: { plastic: 1, box2l: 1 } },
  { id: "p5l", name: "5 L Can", piecesPerCase: 4, drawPerPiece: { oil: 5, can5l: 1, sticker5l: 1, canCap: 1, band: 1 }, drawPerCase: { plastic: 1, box5l: 1 } },
  { id: "p15kg", name: "15 kg Can", piecesPerCase: 1, drawPerPiece: { oil: 16.3, can15kg: 1, sticker15kg: 1, canCap: 1, band: 1 }, drawPerCase: { plastic: 1, box15kg: 1 } }
];
const oilPackConversions = [
  { id: "pouch-1l", name: "Pouch 1 Ltr", kgPerPiece: 0.91, piecesPerBox: 10 },
  { id: "pouch-half-ltr", name: "Pouch 1/2 Ltr", kgPerPiece: 0.455, piecesPerBox: 20 },
  { id: "bottle-1l", name: "Bottle 1 Ltr", kgPerPiece: 0.91, piecesPerBox: 12 },
  { id: "bottle-half-ltr", name: "Bottle 1/2 Ltr", kgPerPiece: 0.455, piecesPerBox: 24 },
  { id: "bottle-910ml", name: "Bottle 910 ML", kgPerPiece: 0.828, piecesPerBox: 12 },
  { id: "bottle-455ml", name: "Bottle 455 ML", kgPerPiece: 0.414, piecesPerBox: 24 },
  { id: "yellow-bottle-2l", name: "Yellow Bottle 2 Ltr", kgPerPiece: 1.82, piecesPerBox: 6 },
  { id: "yellow-bottle-5l", name: "Yellow Bottle 5 Ltr", kgPerPiece: 4.55, piecesPerBox: 4 },
  { id: "pouch-800g", name: "Pouch 800 Gm", kgPerPiece: 0.8, piecesPerBox: 10 },
  { id: "pouch-400g", name: "Pouch 400 Gm", kgPerPiece: 0.4, piecesPerBox: 20 },
  { id: "jar-15kg", name: "Jar 15 Kg", kgPerPiece: 15, piecesPerBox: 1 },
  { id: "bottle-900ml", name: "Bottle 900 ML", kgPerPiece: 0.819, piecesPerBox: 12 },
  { id: "bottle-450ml", name: "Bottle 450 ML", kgPerPiece: 0.41, piecesPerBox: 24 }
].map((item) => ({ ...item, kgPerBox: item.kgPerPiece * item.piecesPerBox }));
const oilPackConversionMap = Object.fromEntries(oilPackConversions.map((item) => [item.id, item]));
const sellerOilItems = [
  { id: "oil-half-bottle-box", name: "Aimies Coconut Oil 1/2 Ltr Bottle - (Box)", unit: "box", stockKey: "bottle-half-ltr", hsn: "15131900" },
  { id: "oil-half-bottle-piece", name: "Aimies Coconut Oil 1/2 Ltr Bottle - Piece", unit: "piece", stockKey: "bottle-half-ltr", hsn: "15131900" },
  { id: "oil1l", name: "Aimies Coconut Oil 1 Ltr Bottle - (Box)", unit: "box", stockKey: "bottle-1l", hsn: "15131900" },
  { id: "oil-1l-bottle-piece", name: "Aimies Coconut Oil 1 Ltr Bottle - Piece", unit: "piece", stockKey: "bottle-1l", hsn: "15131900" },
  { id: "oil-half-pouch-box", name: "Aimies Coconut Oil 1/2 Ltr Pouch - (Box)", unit: "box", stockKey: "pouch-half-ltr", hsn: "15131900" },
  { id: "oil-half-pouch-piece", name: "Aimies Coconut Oil 1/2 Ltr Pouch - Piece", unit: "piece", stockKey: "pouch-half-ltr", hsn: "15131900" },
  { id: "oil-1l-pouch-box", name: "Aimies Coconut Oil 1 Ltr Pouch - (Box)", unit: "box", stockKey: "pouch-1l", hsn: "15131900" },
  { id: "oil-1l-pouch-piece", name: "Aimies Coconut Oil 1 Ltr Pouch - Piece", unit: "piece", stockKey: "pouch-1l", hsn: "15131900" },
  { id: "oil-400g-pouch-box", name: "Aimies Coconut Oil 400 GM Pouch - (Box)", unit: "box", stockKey: "pouch-400g", hsn: "15131900" },
  { id: "oil-400g-pouch-piece", name: "Aimies Coconut Oil 400 GM Pouch - (Piece)", unit: "piece", stockKey: "pouch-400g", hsn: "15131900" },
  { id: "oil-455ml-bottle-box", name: "Aimies Coconut Oil 455 ML Bottle Box", unit: "box", stockKey: "bottle-455ml", hsn: "15131900" },
  { id: "oil-455ml-bottle-piece", name: "Aimies Coconut Oil 455 ML Bottle Piece", unit: "piece", stockKey: "bottle-455ml", hsn: "15131900" },
  { id: "oil-800g-pouch-box", name: "Aimies Coconut Oil 800 GM Pouch - (Box)", unit: "box", stockKey: "pouch-800g", hsn: "15131900" },
  { id: "oil-800g-pouch-piece", name: "Aimies Coconut Oil 800 GM Pouch - (Piece)", unit: "piece", stockKey: "pouch-800g", hsn: "15131900" },
  { id: "oil-910ml-bottle-box", name: "Aimies Coconut Oil 910 ML Bottle Box", unit: "box", stockKey: "bottle-910ml", hsn: "15131900" },
  { id: "oil-910ml-bottle-piece", name: "Aimies Coconut Oil 910 ML Bottle Piece", unit: "piece", stockKey: "bottle-910ml", hsn: "15131900" },
  { id: "oil-2l-bottle-box", name: "Aimies Coconut Oil 2 Ltr Bottle - Box", unit: "box", hsn: "15131900" },
  { id: "oil2l", name: "Aimies Coconut Oil 2 Ltr Bottle Piece", unit: "piece", hsn: "15131900" },
  { id: "oil-5l-jar-box", name: "Aimies Coconut Oil Jar 5 Ltr Box", unit: "box", hsn: "15131900" },
  { id: "oil-5l-jar-piece", name: "Aimies Coconut Oil Jar 5 Ltr Piece", unit: "piece", hsn: "15131900" },
  { id: "oil-15kg-jar", name: "Aimies Coconut Oil Jar 15 KG", unit: "piece", stockKey: "jar-15kg", hsn: "15131900" },
  { id: "coconut-oil-15kg-jar", name: "Coconut Oil Jar 15 Kg", unit: "piece", stockKey: "jar-15kg", hsn: "15131900" },
  { id: "oil-yellow-1l-box", name: "Aimies Coconut Oil Yellow Bottle 1 Ltr Box", unit: "box", hsn: "15131900" },
  { id: "oil-yellow-1l-piece", name: "Aimies Coconut Oil Yellow Bottle 1 Ltr Piece", unit: "piece", hsn: "15131900" },
  { id: "oil-yellow-2l-box", name: "Aimies Coconut Oil Yellow Bottle 2 Ltr Box", unit: "box", stockKey: "yellow-bottle-2l", hsn: "15131900" },
  { id: "oil-yellow-2l-piece", name: "Aimies Coconut Oil Yellow Bottle 2 Ltr Piece", unit: "piece", stockKey: "yellow-bottle-2l", hsn: "15131900" },
  { id: "oil-yellow-5l-box", name: "Aimies Coconut Oil Yellow Bottle 5 Ltr Box", unit: "box", stockKey: "yellow-bottle-5l", hsn: "15131900" },
  { id: "oil-yellow-5l-piece", name: "Aimies Coconut Oil Yellow Bottle 5 Ltr Piece", unit: "piece", stockKey: "yellow-bottle-5l", hsn: "15131900" },
  { id: "oil-900ml-bottle-box", name: "Aimies Coconut Oil 900 ML Bottle Box", unit: "box", stockKey: "bottle-900ml", hsn: "15131900" },
  { id: "oil-900ml-bottle-piece", name: "Aimies Coconut Oil 900 ML Bottle Piece", unit: "piece", stockKey: "bottle-900ml", hsn: "15131900" },
  { id: "oil-450ml-bottle-box", name: "Aimies Coconut Oil 450 ML Bottle Box", unit: "box", stockKey: "bottle-450ml", hsn: "15131900" },
  { id: "oil-450ml-bottle-piece", name: "Aimies Coconut Oil 450 ML Bottle Piece", unit: "piece", stockKey: "bottle-450ml", hsn: "15131900" },
  { id: "coconut-oil", name: "Coconut Oil", unit: "litre", rawMaterialId: "oil", hsn: "15131900" },
  { id: "aimies-coconut-oil", name: "Aimies Coconut Oil", unit: "litre", rawMaterialId: "oil", hsn: "15131900" },
  { id: "custom", name: "Custom Oil Item", unit: "item", hsn: "15131900" }
];
const indianStates = [
  ["Andaman and Nicobar Islands", "35"], ["Andhra Pradesh", "37"], ["Arunachal Pradesh", "12"],
  ["Assam", "18"], ["Bihar", "10"], ["Chandigarh", "04"], ["Chhattisgarh", "22"],
  ["Dadra and Nagar Haveli and Daman and Diu", "26"], ["Delhi", "07"], ["Goa", "30"],
  ["Gujarat", "24"], ["Haryana", "06"], ["Himachal Pradesh", "02"], ["Jammu and Kashmir", "01"],
  ["Jharkhand", "20"], ["Karnataka", "29"], ["Kerala", "32"], ["Ladakh", "38"],
  ["Lakshadweep", "31"], ["Madhya Pradesh", "23"], ["Maharashtra", "27"], ["Manipur", "14"],
  ["Meghalaya", "17"], ["Mizoram", "15"], ["Nagaland", "13"], ["Odisha", "21"],
  ["Puducherry", "34"], ["Punjab", "03"], ["Rajasthan", "08"], ["Sikkim", "11"],
  ["Tamil Nadu", "33"], ["Telangana", "36"], ["Tripura", "16"], ["Uttar Pradesh", "09"],
  ["Uttarakhand", "05"], ["West Bengal", "19"]
].map(([name, code]) => ({ name, code }));
const stateCodeByName = Object.fromEntries(indianStates.map((state) => [state.name, state.code]));
const GST_RATES = [0, 5, 18];
const LITRE_TO_KG = 0.91;
const initialStockLevels = Object.fromEntries(stockMaterials.map((material) => [material.id, 0]));
const initialFinishedGoods = Object.fromEntries(oilPackConversions.map((item) => [item.id, 0]));

function normalizeStock(stock = {}) {
  return {
    levels: { ...initialStockLevels, ...(stock.levels || {}) },
    finishedGoods: { ...initialFinishedGoods, ...(stock.finishedGoods || {}) },
    movements: Array.isArray(stock.movements) ? stock.movements : []
  };
}

function oilQuantityConversion(pack, quantity, unit) {
  const numericQuantity = Math.max(0, Number(quantity || 0));
  if (!pack) return { pieces: 0, kg: unit === "litre" ? numericQuantity * LITRE_TO_KG : unit === "kg" ? numericQuantity : 0 };
  if (unit === "box") return { pieces: numericQuantity * pack.piecesPerBox, kg: numericQuantity * pack.kgPerBox };
  if (unit === "litre") return { pieces: numericQuantity * LITRE_TO_KG / pack.kgPerPiece, kg: numericQuantity * LITRE_TO_KG };
  if (unit === "kg") return { pieces: numericQuantity / pack.kgPerPiece, kg: numericQuantity };
  return { pieces: numericQuantity, kg: numericQuantity * pack.kgPerPiece };
}

function productCaseDraw(product) {
  const draw = {};
  for (const [material, amount] of Object.entries(product.drawPerPiece)) {
    draw[material] = (draw[material] || 0) + amount * product.piecesPerCase;
  }
  for (const [material, amount] of Object.entries(product.drawPerCase)) {
    draw[material] = (draw[material] || 0) + amount;
  }
  return draw;
}

function productionCapacity(product, levels) {
  const draw = productCaseDraw(product);
  const limits = Object.entries(draw).map(([material, amount]) => ({
    material,
    cases: Math.floor((Number(levels[material]) || 0) / amount)
  }));
  const cases = limits.length ? Math.min(...limits.map((item) => item.cases)) : 0;
  const limiting = limits.sort((left, right) => left.cases - right.cases)[0]?.material || "";
  return { cases, pieces: cases * product.piecesPerCase, limiting };
}

function stockAmount(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? number.toLocaleString("en-IN") : number.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

function toast(message, type = "success") {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { id: uid("TOAST"), message, type } }));
}

function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const onToast = (event) => {
      const item = event.detail;
      setItems((current) => [...current, item]);
      window.setTimeout(() => {
        setItems((current) => current.filter((toastItem) => toastItem.id !== item.id));
      }, 3200);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((item) => (
        <div className={`toast-message ${item.type}`} key={item.id}>{item.message}</div>
      ))}
    </div>
  );
}

function columnKey(column) {
  return typeof column === "string" ? column : column.key;
}

function columnLabel(column) {
  return typeof column === "string" ? column : column.label || column.key;
}

function isCurrencyColumn(column) {
  const key = columnKey(column);
  return Boolean(column?.currency || key === "amount" || key === "salary");
}

function downloadCsv(filename, rows, columns) {
  const resolvedColumns = (columns || Object.keys(rows[0] || {})).map((column) => (
    typeof column === "string" ? { key: column, label: column } : column
  ));
  if (!resolvedColumns.length) {
    toast("No records available to export.", "error");
    return;
  }
  const exportRows = rows.map((row) => ({
    ...row,
    receiptName: row.receipt?.name || ""
  }));
  const csv = [
    resolvedColumns.map((column) => columnLabel(column)).join(","),
    ...exportRows.map((row) => resolvedColumns.map((column) => `"${String(row[columnKey(column)] ?? "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("CSV export downloaded.");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseRecordDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value);
  const raw = String(value).trim();
  const yyyymmdd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    const [, year, month, day] = yyyymmdd;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateInputValue(value) {
  const date = parseRecordDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWithinDateRange(value, from, to) {
  const date = parseRecordDate(value);
  if (!date) return false;
  date.setHours(12, 0, 0, 0);
  const start = from ? parseRecordDate(from) : null;
  const end = to ? parseRecordDate(to) : null;
  if (start) start.setHours(0, 0, 0, 0);
  if (end) end.setHours(23, 59, 59, 999);
  return (!start || date >= start) && (!end || date <= end);
}

function isSameRecordDate(value, selectedDate) {
  if (!selectedDate) return true;
  return dateInputValue(value) === selectedDate;
}

function isSameRecordMonth(value, selectedMonth) {
  if (!selectedMonth) return true;
  return dateInputValue(value).startsWith(selectedMonth);
}

function getPeriodRange(period) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (period === "weekly") {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === "monthly") {
    start.setDate(1);
    end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
  } else if (period === "yearly") {
    start.setMonth(0, 1);
    end.setFullYear(start.getFullYear(), 11, 31);
  }

  return { start, end };
}

function isWithinPeriod(value, period) {
  const date = parseRecordDate(value);
  if (!date) return false;
  const { start, end } = getPeriodRange(period);
  return date >= start && date <= end;
}

function distanceBetweenMeters(first, second) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const deltaLatitude = toRadians(second.latitude - first.latitude);
  const deltaLongitude = toRadians(second.longitude - first.longitude);
  const startLatitude = toRadians(first.latitude);
  const endLatitude = toRadians(second.latitude);
  const value = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function requestCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      () => reject(new Error("Allow location permission to check in.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

async function verifyCheckInLocation() {
  const currentLocation = await requestCurrentLocation();
  const distanceMeters = distanceBetweenMeters(currentLocation, CHECKIN_LOCATION);
  if (distanceMeters > CHECKIN_LOCATION.radiusMeters) {
    throw new Error(`Check-in is allowed only at the office location. You are about ${Math.round(distanceMeters)}m away.`);
  }
  return {
    ...currentLocation,
    distanceMeters: Math.round(distanceMeters),
    allowedRadiusMeters: CHECKIN_LOCATION.radiusMeters
  };
}

function ledgerEntryFromExpense(expense, createdBy = expense.createdBy || "Admin") {
  return {
    id: uid("TXN"),
    type: "Debit",
    date: expense.date || expense.submittedAt || today(),
    account: expense.ledgerName || expense.employeeName || "Admin / Company",
    category: expense.itemName || expense.category,
    amount: Number(expense.amount || 0),
    note: expense.narration || expense.notes || "",
    createdBy,
    sourceExpenseId: expense.id,
    buyerSupplierPincode: expense.buyerSupplierPincode || "",
    ledgerName: expense.ledgerName || expense.employeeName || "",
    ledgerAmount: Number(expense.ledgerAmount || expense.amount || 0),
    ledgerAmountDrCr: expense.ledgerAmountDrCr || "Dr",
    itemName: expense.itemName || expense.category || "",
    billedQuantity: expense.billedQuantity || "",
    itemRate: expense.itemRate || "",
    itemRatePer: expense.itemRatePer || "",
    itemAmount: Number(expense.itemAmount || expense.amount || 0),
    changeMode: expense.changeMode || "",
    narration: expense.narration || expense.notes || ""
  };
}

function buildFinanceRows(store) {
  const ledgerRows = (store.ledger || [])
    .filter((item) => String(item.type || "Debit").toLowerCase() === "debit")
    .map((item) => ({
    source: "Ledger",
    id: item.id,
    type: "Debit",
    date: item.date,
    employeeName: "",
    account: item.account,
    category: item.category,
    amount: Number(item.amount || 0),
    status: "Recorded",
    note: item.note,
    createdBy: item.createdBy || "HR",
    receiptName: "",
    sourceExpenseId: item.sourceExpenseId || "",
    buyerSupplierPincode: item.buyerSupplierPincode || "",
    ledgerName: item.ledgerName || item.account || "",
    ledgerAmount: Number(item.ledgerAmount || item.amount || 0),
    ledgerAmountDrCr: item.ledgerAmountDrCr || "Dr",
    itemName: item.itemName || item.category || "",
    billedQuantity: item.billedQuantity || "",
    itemRate: item.itemRate || "",
    itemRatePer: item.itemRatePer || "",
    itemAmount: Number(item.itemAmount || item.amount || 0),
    changeMode: item.changeMode || "",
    narration: item.narration || item.note || ""
  }));

  const ledgerExpenseIds = new Set((store.ledger || []).map((item) => item.sourceExpenseId).filter(Boolean));
  const expenseRows = (store.expenses || [])
    .filter((item) => item.status === "Approved" && !ledgerExpenseIds.has(item.id))
    .map((item) => ({
    source: "Expense",
    id: item.id,
    type: "Debit",
    date: item.date || item.submittedAt,
    employeeName: item.employeeName,
    account: item.employeeId,
    category: item.category,
    amount: Number(item.amount || 0),
    status: item.status,
    note: item.notes,
    createdBy: item.createdBy || "Employee",
    receiptName: item.receipt?.name || "",
    buyerSupplierPincode: item.buyerSupplierPincode || "",
    ledgerName: item.ledgerName || item.employeeName || "",
    ledgerAmount: Number(item.ledgerAmount || item.amount || 0),
    ledgerAmountDrCr: item.ledgerAmountDrCr || "Dr",
    itemName: item.itemName || item.category || "",
    billedQuantity: item.billedQuantity || "",
    itemRate: item.itemRate || "",
    itemRatePer: item.itemRatePer || "",
    itemAmount: Number(item.itemAmount || item.amount || 0),
    changeMode: item.changeMode || "",
    narration: item.narration || item.notes || ""
  }));

  return [...ledgerRows, ...expenseRows].sort((a, b) => {
    const first = parseRecordDate(a.date)?.getTime() || 0;
    const second = parseRecordDate(b.date)?.getTime() || 0;
    return second - first;
  });
}

function downloadExcelReport(filename, title, sheets) {
  const hasRows = sheets.some((sheet) => sheet.rows.length);
  if (!hasRows) {
    toast("No records available for this report.", "error");
    return;
  }

  const body = sheets.map((sheet) => `
    <h2>${escapeHtml(sheet.title)}</h2>
    <table>
      <thead><tr>${sheet.columns.map((column) => `<th>${escapeHtml(columnLabel(column))}</th>`).join("")}</tr></thead>
      <tbody>
        ${sheet.rows.map((row) => `<tr>${sheet.columns.map((column) => {
          const key = columnKey(column);
          const value = row[key];
          return `<td>${escapeHtml(isCurrencyColumn(column) ? (value === "" || value === null || value === undefined ? "" : Number(value || 0)) : value ?? "")}</td>`;
        }).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}h1,h2{margin:12px 0}table{border-collapse:collapse;margin-bottom:24px}th,td{border:1px solid #b8c2cf;padding:6px 8px;white-space:nowrap}th{background:#e9eef6}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("Excel report downloaded.");
}

function downloadFinanceRegisterExcel(filename, rows) {
  if (!rows.length) {
    toast("No finance records available for this report.", "error");
    return;
  }

  const headerRow = financePrimaryColumns
    .map((column) => `<th>${escapeHtml(column.label)}</th>`)
    .join("");
  const bodyRows = rows.map((row) => `
    <tr>${financePrimaryColumns.map((column) => {
      const value = row[column.key];
      return `<td>${escapeHtml(isCurrencyColumn(column) ? (value === "" || value === null || value === undefined ? "" : Number(value || 0)) : value ?? "")}</td>`;
    }).join("")}</tr>
  `).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:0}table{border-collapse:collapse}th,td{border:1px solid #d0d0d0;padding:4px 8px;white-space:nowrap}th{background:#ffcc33;color:#000;font-weight:400}</style></head><body><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("Finance Excel report downloaded.");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function readEmployeeDocument(file) {
  if (!file) return null;
  const allowed = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!allowed) throw new Error("Upload an Aadhaar card image or PDF.");
  if (file.size > 2 * 1024 * 1024) throw new Error("Aadhaar card document must be 2 MB or smaller.");
  return { name: file.name, type: file.type, size: file.size, dataUrl: await fileToDataUrl(file) };
}

function EmployeeDocumentLinks({ document }) {
  if (!document?.dataUrl) return <span>--</span>;
  return (
    <span className="document-links">
      <a href={document.dataUrl} target="_blank" rel="noreferrer" title={`View ${document.name}`}>View</a>
      <a href={document.dataUrl} download={document.name} title={`Download ${document.name}`}>Download</a>
    </span>
  );
}

function App() {
  const [store, setStore] = useState(readState);
  const [session, setSession] = useState(readSession);
  const [activePage, setActivePage] = useState("home");
  const [apiStatus, setApiStatus] = useState("connecting");
  const [installPrompt, setInstallPrompt] = useState(null);
  const healthFailuresRef = useRef(0);

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);

  const refreshBackendHealth = () => fetch(`${API_URL}/api/health/mongodb`)
    .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Health check failed: ${response.status}`)))
    .then((payload) => {
      if (payload.storage === "mongodb") {
        healthFailuresRef.current = 0;
        setApiStatus("connected");
      } else if (payload.storage === "connecting") {
        healthFailuresRef.current = 0;
        setApiStatus((current) => current === "connected" ? "connected" : "connecting");
      } else if (payload.storage === "fallback") {
        healthFailuresRef.current = 0;
        setApiStatus("fallback");
      } else if (payload.storage === "unavailable") {
        setApiStatus("offline");
      } else {
        healthFailuresRef.current += 1;
        if (healthFailuresRef.current >= 2) setApiStatus("offline");
      }
      return payload;
    })
    .catch(() => {
      healthFailuresRef.current += 1;
      if (healthFailuresRef.current >= 2) setApiStatus("offline");
      return null;
    });

  const refreshPortalState = () => apiJson("/api/portal")
    .then((payload) => {
      if (!hasPortalData(payload)) return null;
      const nextPayload = { ...seedState, ...payload, logins: payload.logins || [] };
      setStore(nextPayload);
      writeState(nextPayload);
      return nextPayload;
    })
    .catch(() => {
      return null;
    });

  useEffect(() => {
    if (!session?.token) return;
    let cancelled = false;
    let retryTimer;
    let healthInterval;
    let portalInterval;

    const loadPortal = () => {
      refreshPortalState()
        .then((payload) => {
          if (cancelled) return;
          if (payload) return;
          retryTimer = window.setTimeout(loadPortal, 3000);
        });
    };

    refreshBackendHealth();
    healthInterval = window.setInterval(refreshBackendHealth, 10000);
    loadPortal();
    portalInterval = window.setInterval(refreshPortalState, 5000);
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(healthInterval);
      window.clearInterval(portalInterval);
    };
  }, [session?.token]);

  useEffect(() => {
    if (!session) return;
    const allowed = getNavItemsForRole(session.role).some((item) => item.id === activePage);
    if (!allowed) setActivePage("home");
  }, [activePage, session]);

  const commit = (updater) => {
    setStore((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      savePortalState(next).then(() => {
        window.setTimeout(refreshPortalState, 250);
      });
      return next;
    });
  };

  const commitAttendance = async (updater, attendanceRecord) => {
    let savedLocal = false;
    try {
      const latest = attendanceRecord ? null : await apiJson("/api/portal");
      const base = attendanceRecord
        ? store
        : hasPortalData(latest) ? { ...seedState, ...latest, logins: latest.logins || [] } : readState();
      const next = typeof updater === "function" ? updater(base) : updater;
      const changedRecord = attendanceRecord || findChangedAttendanceRecord(base.attendance, next.attendance);
      if (!changedRecord) throw new Error("No attendance change found.");

      const savedPortal = await apiJson("/api/portal/attendance-record", {
        method: "POST",
        body: JSON.stringify({ record: changedRecord })
      });
      if (savedPortal?.storage && savedPortal.storage !== "mongodb") {
        throw new Error("Backend storage is not connected to MongoDB yet. Attendance was not saved.");
      }
      writeState(next);
      setStore(next);
      savedLocal = true;
      if (hasPortalData(savedPortal)) {
        const nextPortal = { ...seedState, ...savedPortal, logins: savedPortal.logins || [] };
        writeState(nextPortal);
        setStore(nextPortal);
      }
      window.setTimeout(refreshPortalState, 250);
      return true;
    } catch (error) {
      if (!savedLocal && !attendanceRecord) commit(updater);
      if (error.status === 401 || error.status === 403) {
        toast("Backend rejected this login session. Please sign out and sign in again, then mark attendance.", "error");
      } else {
        toast(error.message || "Attendance was not saved to the shared database. Please try again.", "error");
      }
      return false;
    }
  };

  const deleteAttendance = async (attendanceId) => {
    try {
      const savedPortal = await apiJson(`/api/portal/attendance-record/${encodeURIComponent(attendanceId)}`, {
        method: "DELETE"
      });
      if (savedPortal?.storage && savedPortal.storage !== "mongodb") {
        throw new Error("Backend storage is not connected to MongoDB yet. Attendance was not deleted.");
      }
      if (hasPortalData(savedPortal)) {
        const nextPortal = { ...seedState, ...savedPortal, logins: savedPortal.logins || [] };
        writeState(nextPortal);
        setStore(nextPortal);
      } else {
        setStore((current) => ({
          ...current,
          attendance: (current.attendance || []).filter((record) => record.id !== attendanceId)
        }));
      }
      window.setTimeout(refreshPortalState, 250);
      toast("Attendance deleted.");
      return true;
    } catch (error) {
      toast(error.message || "Attendance was not deleted from the shared database. Please try again.", "error");
      return false;
    }
  };

  if (!session) {
    return <><LoginScreen store={store} onLogin={(nextSession) => { writeSession(nextSession); setSession(nextSession); setActivePage("home"); }} /><ToastHost /></>;
  }

  if (session.mustChangePassword) {
    return <><PasswordChangeScreen session={session} onChanged={(nextSession) => { writeSession(nextSession); setSession(nextSession); setActivePage("home"); }} onLogout={() => { writeSession(null); setSession(null); }} /><ToastHost /></>;
  }

  return (
    <div className="portal-shell">
      <Sidebar session={session} activePage={activePage} onPageChange={setActivePage} onLogout={() => { writeSession(null); setSession(null); }} />
      <main className="portal-main">
        <Header session={session} store={store} activePage={activePage} apiStatus={apiStatus} />
        <InstallAppNotice installPrompt={installPrompt} onPromptUsed={() => setInstallPrompt(null)} />
        <RolePage session={session} activePage={activePage} store={store} commit={commit} commitAttendance={commitAttendance} deleteAttendance={deleteAttendance} />
      </main>
      <ToastHost />
    </div>
  );
}

function InstallAppNotice({ installPrompt, onPromptUsed }) {
  const [visible, setVisible] = useState(() => !isInstalledWebApp());
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");

  if (!visible) return null;

  const installApp = async () => {
    if (!installPrompt) {
      toast(isIos ? "Tap Share, then Add to Home Screen." : "Open browser menu and choose Add to Home screen.", "error");
      return;
    }

    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => null);
    onPromptUsed();
    setVisible(false);
  };

  return (
    <section className="install-app-notice" aria-label="Install mobile app notice">
      <div>
        <strong>Download Aimies People on your phone</strong>
        <span>{isIos ? "Tap Share, then Add to Home Screen." : "Install it as a mobile web app for faster check-in."}</span>
      </div>
      <button type="button" className="primary-button" onClick={installApp}>{installPrompt ? "Install App" : "How to Install"}</button>
      <button type="button" className="icon-action" aria-label="Dismiss install notice" title="Dismiss" onClick={() => setVisible(false)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </svg>
      </button>
    </section>
  );
}

function LoginScreen({ store, onLogin }) {
  const [selectedRole, setSelectedRole] = useState("admin");
  const [form, setForm] = useState({ email: readRememberedEmail(), password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const selectRole = (role) => {
    setSelectedRole(role);
    setForm((current) => ({ ...current, password: "" }));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      const login = await apiJson("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ email: form.email, password: form.password, selectedRole })
      });
      writeRememberedEmail(form.email);
      toast("Signed in successfully.");
      onLogin({ ...login.user, token: login.token });
    } catch (error) {
      if (ALLOW_LOCAL_FALLBACK_LOGIN) {
        const localLogin = getLocalPasswordLogin({ ...form, selectedRole, store });
        if (localLogin) {
          writeRememberedEmail(form.email);
          toast("Signed in with local fallback storage.");
          onLogin(localLogin);
          return;
        }
      }
      setError(error.status === 401
        ? "Check the selected dashboard, email, and password."
        : "Backend login is unavailable. Check the selected dashboard, email, and password.");
    }
  };

  return (
    <div className="login-page">
      <section className="login-copy">
        <img src={aimiesLogoImage} alt="Aimies" />
        <h1>Work smarter. Track better. Approve faster.</h1>
        <p>Choose your login to manage employee records, finance entries, approvals, attendance, leave, reimbursements, and seller work.</p>
      </section>
      <form className="login-panel" onSubmit={submit} autoComplete="on">
        <h2>Sign in</h2>
        <div className="role-picker" aria-label="Select login role">
          {Object.entries(roles).map(([key, role]) => (
            <button type="button" key={key} className={selectedRole === key ? "active" : ""} onClick={() => selectRole(key)}>
              {role.title}
            </button>
          ))}
        </div>
        <label>Email<input type="email" name="email" autoComplete="username" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Password
          <span className="password-field">
            <input type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((value) => !value)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {showPassword ? (
                  <>
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 8.5 4.2 10 7a15.7 15.7 0 0 1-3.1 4" />
                    <path d="M6.6 6.6A15.5 15.5 0 0 0 2 12c1.5 2.8 5 7 10 7 1.4 0 2.7-.3 3.8-.8" />
                  </>
                ) : (
                  <>
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </span>
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit">Open Dashboard</button>
        <div className="credential-list">
          <span>First password: FirstName@123</span>
          <span>Use the email assigned by Admin.</span>
        </div>
      </form>
    </div>
  );
}

function PasswordChangeScreen({ session, onChanged, onLogout }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation must match.");
      toast("New password and confirmation must match.", "error");
      return;
    }
    if (form.newPassword.trim().length < 6) {
      setError("New password must be at least 6 characters.");
      toast("New password must be at least 6 characters.", "error");
      return;
    }
    if (session.provider === "local-password") {
      const passwordKey = localPasswordKey(session.email, session.role);
      const savedPasswords = readLocalPasswords();
      const currentPassword = savedPasswords[passwordKey] || initialPasswordForUser(session);
      if (form.currentPassword.trim() !== currentPassword) {
        setError("Current password is incorrect.");
        toast("Current password is incorrect.", "error");
        return;
      }
      if (form.newPassword.trim() === currentPassword) {
        setError("Choose a new password that is different from the initial password.");
        toast("Choose a different new password.", "error");
        return;
      }
      const nextPasswords = { ...savedPasswords, [passwordKey]: form.newPassword.trim() };
      writeLocalPasswords(nextPasswords);
      toast("Password changed successfully.");
      onChanged({ ...session, mustChangePassword: false });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Password change failed.");
      toast("Password changed successfully.");
      onChanged({ ...payload.user, token: payload.token });
    } catch (error) {
      setError(error.message);
      toast(error.message, "error");
    }
  };

  return (
    <div className="login-page password-change-page">
      <section className="login-copy">
        <img src={aimiesLogoImage} alt="Aimies" />
        <h1>Set your new password</h1>
        <p>Your first password is only for the first sign in. Create a private password before opening the dashboard.</p>
      </section>
      <form className="login-panel" onSubmit={submit}>
        <h2>Password required</h2>
        <p className="change-note">Signed in as {session.email}</p>
        <label>Current password<input type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label>
        <label>New password<input type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label>
        <label>Confirm password<input type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit">Change Password</button>
        <button className="secondary-button" type="button" onClick={onLogout}>Sign out</button>
      </form>
    </div>
  );
}

const navItems = [
  { id: "home", label: "Home" },
  { id: "logins", label: "Add Login", roles: ["admin"] },
  { id: "employees", label: "Employees", roles: ["admin", "hr", "employee"] },
  { id: "sales", label: "Billing", roles: ["admin", "localSeller"] },
  { id: "performa", label: "Performa Bill", roles: ["admin", "localSeller"] },
  { id: "finance", label: "Finance", roles: ["admin", "hr"] },
  { id: "stock", label: "Stock", roles: ["admin", "hr"] },
  { id: "leave", label: "Leave", roles: ["admin", "hr", "employee"] },
  { id: "expenses", label: "Expenses", roles: ["admin", "hr", "employee"] },
  { id: "attendance", label: "Attendance", roles: ["admin", "hr", "employee", "localSeller"] }
];

function getNavItemsForRole(role) {
  return navItems.filter((item) => !item.roles || item.roles.includes(role));
}

function Sidebar({ session, activePage, onPageChange, onLogout }) {
  const availableItems = getNavItemsForRole(session.role);
  return (
    <aside className="sidebar">
      <img src={aimiesLogoImage} alt="" />
      <nav>
        <span className="nav-pill">{session.name}</span>
        {availableItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`nav-link ${activePage === item.id ? "active" : ""}`}
            onClick={() => onPageChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <button onClick={onLogout}>Sign out</button>
    </aside>
  );
}

function Header({ session, store, activePage, apiStatus }) {
  const approvedExpenses = store.expenses.filter((item) => item.status === "Approved").reduce((sum, item) => sum + Number(item.amount), 0);
  const pendingApprovals = store.expenses.filter((item) => item.status === "Pending").length + store.leaves.filter((item) => item.status === "Pending").length;
  const pageTitle = getNavItemsForRole(session.role).find((item) => item.id === activePage)?.label || "Home";
  const statusLabel = apiStatus === "connected"
    ? "Backend storage connected"
    : apiStatus === "connecting"
      ? "Backend storage connecting"
      : apiStatus === "fallback"
        ? "Local JSON storage"
        : "MongoDB unavailable";
  return (
    <header className="page-header">
      <div>
        <p>{session.email}</p>
        <h1>{session.name} - {pageTitle}</h1>
        <span className={`api-status ${apiStatus}`}>{statusLabel}</span>
      </div>
      {session.role !== "employee" && session.role !== "localSeller" && (
        <div className="header-metrics">
          <Metric label="Employees" value={store.employees.length} />
          <Metric label="Pending Approvals" value={pendingApprovals} />
          <Metric label="Approved Expenses" value={money(approvedExpenses)} />
        </div>
      )}
    </header>
  );
}

function RolePage({ session, activePage, store, commit, commitAttendance, deleteAttendance }) {
  if (session.role === "admin") return <AdminPage activePage={activePage} store={store} commit={commit} commitAttendance={commitAttendance} deleteAttendance={deleteAttendance} session={session} />;
  if (session.role === "hr") return <HrPage activePage={activePage} store={store} commit={commit} commitAttendance={commitAttendance} deleteAttendance={deleteAttendance} session={session} />;
  if (session.role === "localSeller") return <LocalSellerPage activePage={activePage} store={store} commit={commit} commitAttendance={commitAttendance} session={session} />;
  return <EmployeePage activePage={activePage} store={store} commit={commit} commitAttendance={commitAttendance} session={session} />;
}

function AdminPage({ activePage, store, commit, commitAttendance, deleteAttendance, session }) {
  if (activePage === "logins") return <DashboardGrid><AddLoginPanel commit={commit} /><LoginAccessTable logins={store.logins || []} commit={commit} className="full-row-panel" /></DashboardGrid>;
  if (activePage === "employees") return <DashboardGrid><AddEmployeePanel commit={commit} /><EmployeeTable employees={store.employees} commit={commit} canDelete className="full-row-panel" /></DashboardGrid>;
  if (activePage === "sales") return <SellerBillingPage store={store} commit={commit} session={session} />;
  if (activePage === "performa") return <SellerPerformaBillPage store={store} commit={commit} session={session} />;
  if (activePage === "finance") return <DashboardGrid><AdminExpenseFormPanel store={store} commit={commit} createdBy="Admin" title="Add Debit Expense" /><FinancePanel store={store} commit={commit} canManage canExport className="full-row-panel" /></DashboardGrid>;
  if (activePage === "stock") return <StockPage store={store} commit={commit} />;
  if (activePage === "leave") return <DashboardGrid><ApprovalPanel title="Leave Applications" items={store.leaves} kind="leaves" commit={commit} /><LeaveTable leaves={store.leaves} /></DashboardGrid>;
  if (activePage === "expenses") return <DashboardGrid><AdminExpenseFormPanel store={store} commit={commit} /><ApprovalPanel title="Expense Approvals" items={store.expenses} kind="expenses" commit={commit} className="full-row-panel" /><ExpenseTable expenses={store.expenses} className="full-row-panel" /></DashboardGrid>;
  if (activePage === "attendance") return <AttendancePage store={store} commit={commit} commitAttendance={commitAttendance} deleteAttendance={deleteAttendance} session={session} />;
  return <AdminHome store={store} commit={commit} />;
}

function HrPage({ activePage, store, commit, commitAttendance, deleteAttendance, session }) {
  if (activePage === "employees") return <DashboardGrid><EmployeeTable employees={store.employees} /></DashboardGrid>;
  if (activePage === "leave") return <DashboardGrid><LeaveTable leaves={store.leaves} /></DashboardGrid>;
  if (activePage === "expenses") return <DashboardGrid><ApprovalPanel title="Expense Approval Queue" items={store.expenses} kind="expenses" commit={commit} /><ExpenseTable expenses={store.expenses} /></DashboardGrid>;
  if (activePage === "attendance") return <AttendancePage store={store} commit={commit} commitAttendance={commitAttendance} deleteAttendance={deleteAttendance} session={session} />;
  if (activePage === "finance") return <DashboardGrid><AdminExpenseFormPanel store={store} commit={commit} createdBy="HR" title="Add Debit Expense" /><FinancePanel store={store} canExport className="full-row-panel" /></DashboardGrid>;
  if (activePage === "stock") return <StockPage store={store} commit={commit} />;
  return <DashboardGrid><FinancePanel store={store} canExport className="full-row-panel" /><ApprovalPanel title="Expense Approval Queue" items={store.expenses} kind="expenses" commit={commit} className="full-row-panel" /></DashboardGrid>;
}

function LocalSellerPage({ activePage, store, commit, commitAttendance, session }) {
  if (activePage === "attendance") return <EmployeePage activePage="attendance" store={store} commit={commit} commitAttendance={commitAttendance} session={session} />;
  if (activePage === "performa") return <SellerPerformaBillPage store={store} commit={commit} session={session} />;
  return <SellerBillingPage store={store} commit={commit} session={session} />;
}

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function sellerBillText(bill) {
  const lines = [
    COMPANY_LEGAL_NAME,
    bill.documentTitle,
    `Bill No: ${bill.billNumber}`,
    `Date: ${bill.date}`,
    bill.irn ? `IRN: ${bill.irn}` : "IRN: Pending / not entered",
    bill.ackNo ? `Ack No: ${bill.ackNo}` : "",
    bill.ackDate ? `Ack Date: ${bill.ackDate}` : "",
    `Buyer: ${bill.customerName}`,
    `Phone: ${bill.customerPhone}`,
    bill.customerAddress ? `Address: ${bill.customerAddress}` : "",
    bill.customerGstin ? `GSTIN: ${bill.customerGstin}` : "",
    bill.placeOfSupply ? `Place of Supply: ${bill.placeOfSupply}` : "",
    `Payment: ${bill.paymentMode}`,
    bill.destination ? `Destination: ${bill.destination}` : "",
    bill.vehicleNumber ? `Vehicle No: ${bill.vehicleNumber}` : "",
    bill.note ? `Note: ${bill.note}` : "",
    "",
    "Items:",
    ...bill.items.map((item, index) => `${index + 1}. ${item.name} - HSN ${item.hsn} - ${stockAmount(item.quantity)} ${item.unit} - ${money(item.amount)}`),
    "",
    `Subtotal: ${money(bill.subtotal)}`,
    `Taxable Amount: ${money(bill.taxableAmount ?? bill.subtotal)}`,
    bill.cgst ? `CGST: ${money(bill.cgst)} | SGST: ${money(bill.sgst)}` : "",
    bill.igst ? `IGST: ${money(bill.igst)}` : "",
    bill.roundOff ? `Round Off: ${money(bill.roundOff)}` : "",
    `Tax Amount: ${money(bill.taxAmount ?? ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)))}`,
    `Total: ${money(bill.total)}`,
    `Seller: ${bill.sellerName}`,
    "",
    "Thank you for buying from Aimies."
  ];
  return lines.filter(Boolean).join("\n");
}

function SellerBillingPage({ store, commit, session }) {
  const customers = store.sellerCustomers || [];
  const bills = store.sellerBills || [];
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", gstin: "", state: "Kerala", stateCode: "32" });
  const [billInfo, setBillInfo] = useState({ supplyType: "B2C", paymentMode: "Cash", taxPercent: "5", applyRoundOff: false, destination: "", vehicleNumber: "", irn: "", ackNo: "", ackDate: "", ewayBillNo: "", signedQr: "", note: "" });
  const [line, setLine] = useState({ product: "oil1l", customName: "", quantity: "1", quantityUnit: "box", amount: "" });
  const [items, setItems] = useState([]);
  const [printTargetBill, setPrintTargetBill] = useState(null);
  const latestBill = bills[0] || null;
  const previewBill = printTargetBill || latestBill;
  const selectedItem = sellerOilItems.find((item) => item.id === line.product) || sellerOilItems[0];
  const selectedPack = oilPackConversionMap[selectedItem.stockKey];
  const lineConversion = oilQuantityConversion(selectedPack, line.quantity, line.quantityUnit);
  const stock = normalizeStock(store.stock);
  const billSubtotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const taxPercent = Math.max(0, Number(billInfo.taxPercent || 0));
  const taxAmount = billSubtotal * taxPercent / 100;
  const preRoundTotal = billSubtotal + taxAmount;
  const roundOff = billInfo.applyRoundOff ? Math.round(preRoundTotal) - preRoundTotal : 0;
  const billTotal = preRoundTotal + roundOff;

  const selectCustomer = (phone) => {
    const savedCustomer = customers.find((item) => item.phone === phone);
    if (savedCustomer) setCustomer({ name: savedCustomer.name, phone: savedCustomer.phone, address: savedCustomer.address || "", gstin: savedCustomer.gstin || "", state: savedCustomer.state || "Kerala", stateCode: savedCustomer.stateCode || "32" });
  };

  const addItem = (event) => {
    event.preventDefault();
    const quantity = Number(line.quantity);
    const amount = Number(line.amount);
    const name = line.product === "custom" ? line.customName.trim() : selectedItem.name;
    if (!name || !quantity || quantity <= 0 || !amount || amount <= 0) {
      toast("Enter item, quantity, and amount.", "error");
      return;
    }
    setItems((current) => [
      ...current,
      {
        id: uid("ITEM"),
        productId: line.product,
        name,
        hsn: selectedItem.hsn,
        quantity,
        unit: line.quantityUnit,
        stockKey: selectedItem.stockKey || null,
        rawMaterialId: selectedItem.rawMaterialId || null,
        quantityPieces: selectedItem.stockKey ? lineConversion.pieces : null,
        quantityLitres: selectedItem.rawMaterialId ? (line.quantityUnit === "kg" ? quantity / LITRE_TO_KG : quantity) : null,
        quantityKg: lineConversion.kg || null,
        rate: amount / quantity,
        amount
      }
    ]);
    setLine({ product: line.product, customName: "", quantity: "1", quantityUnit: line.quantityUnit, amount: "" });
  };

  const removeItem = (itemId) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
  };

  const generateBill = (event) => {
    event.preventDefault();
    const customerName = customer.name.trim();
    const customerPhone = normalizePhone(customer.phone);
    const customerAddress = customer.address.trim();
    const customerGstin = customer.gstin.trim().toUpperCase();
    const customerState = customer.state.trim() || "Kerala";
    const customerStateCode = customer.stateCode.trim() || "32";
    const irn = billInfo.irn.trim();
    if (!customerName || !customerPhone) {
      toast("Enter buyer name and phone number.", "error");
      return;
    }
    if (billTotal >= 50000 && (!customerAddress || !customerState || !customerStateCode)) {
      toast("For bills of Rs. 50,000 or more, enter buyer address, state, and state code.", "error");
      return;
    }
    if (!items.length) {
      toast("Add at least one oil item before generating bill.", "error");
      return;
    }
    const stockRequired = items.reduce((required, item) => {
      if (item.stockKey) required[item.stockKey] = Number(required[item.stockKey] || 0) + Number(item.quantityPieces || 0);
      return required;
    }, {});
    const insufficientItem = Object.entries(stockRequired).find(([stockKey, pieces]) => pieces > Number(stock.finishedGoods[stockKey] || 0) + 0.000001);
    if (insufficientItem) {
      const [stockKey, pieces] = insufficientItem;
      const available = Number(stock.finishedGoods[stockKey] || 0);
      toast(`Not enough ${oilPackConversionMap[stockKey]?.name || "item"} stock. Required ${stockAmount(pieces)} pieces; available ${stockAmount(available)}.`, "error");
      return;
    }
    const rawOilRequired = items.reduce((total, item) => total + Number(item.quantityLitres || 0), 0);
    if (rawOilRequired > Number(stock.levels.oil || 0) + 0.000001) {
      toast(`Not enough bulk coconut oil stock. Required ${stockAmount(rawOilRequired)} L; available ${stockAmount(stock.levels.oil || 0)} L.`, "error");
      return;
    }

    const bill = {
      id: uid("BILL"),
      billNumber: `LS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(bills.length + 1).padStart(3, "0")}`,
      date: new Date().toLocaleString("en-IN"),
      supplyType: billInfo.supplyType,
      documentTitle: "TAX INVOICE",
      irn,
      ackNo: billInfo.ackNo.trim(),
      ackDate: billInfo.ackDate,
      ewayBillNo: billInfo.ewayBillNo.trim(),
      signedQr: billInfo.signedQr.trim(),
      customerName,
      customerPhone,
      customerAddress,
      customerGstin,
      customerState,
      customerStateCode,
      placeOfSupply: `${customerState}, Code: ${customerStateCode}`,
      paymentMode: billInfo.paymentMode,
      taxPercent,
      taxableAmount: billSubtotal,
      taxAmount,
      taxType: customerState === "Kerala" ? "INTRASTATE" : "INTERSTATE",
      cgst: customerState === "Kerala" ? taxAmount / 2 : 0,
      sgst: customerState === "Kerala" ? taxAmount / 2 : 0,
      igst: customerState === "Kerala" ? 0 : taxAmount,
      subtotal: billSubtotal,
      roundOff,
      destination: billInfo.destination.trim(),
      vehicleNumber: billInfo.vehicleNumber.trim().toUpperCase(),
      note: billInfo.note.trim(),
      items,
      total: billTotal,
      sellerName: session.name,
      sellerEmail: session.email,
      createdAt: new Date().toISOString()
    };

    commit((current) => {
      const currentCustomers = current.sellerCustomers || [];
      const nextCustomer = {
        id: currentCustomers.find((item) => item.phone === customerPhone)?.id || uid("CUST"),
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        gstin: customerGstin,
        state: customerState,
        stateCode: customerStateCode,
        lastBillAt: bill.createdAt,
        totalBills: currentCustomers.find((item) => item.phone === customerPhone)?.totalBills || 0
      };
      nextCustomer.totalBills += 1;
      const currentStock = normalizeStock(current.stock);
      const nextLevels = { ...currentStock.levels };
      const nextFinishedGoods = { ...currentStock.finishedGoods };
      const saleMovements = bill.items.filter((item) => item.stockKey).map((item, index) => {
        nextFinishedGoods[item.stockKey] = Number(nextFinishedGoods[item.stockKey] || 0) - Number(item.quantityPieces || 0);
        return {
          id: `${uid("SALE")}-${index}`, type: "Billing Sale", date: today(), stockKey: item.stockKey, billNumber: bill.billNumber,
          item: item.name, quantity: item.quantity, unit: item.unit, pieces: item.quantityPieces, kg: item.quantityKg,
          note: `${bill.billNumber} - ${customerName}`
        };
      });
      const rawSaleMovements = bill.items.filter((item) => item.rawMaterialId).map((item, index) => {
        nextLevels[item.rawMaterialId] = Number(nextLevels[item.rawMaterialId] || 0) - Number(item.quantityLitres || 0);
        return {
          id: `${uid("SALE-RAW")}-${index}`, type: "Billing Sale", date: today(), rawMaterialId: item.rawMaterialId, billNumber: bill.billNumber,
          item: item.name, quantity: item.quantity, unit: item.unit, litres: item.quantityLitres, kg: item.quantityKg,
          note: `${bill.billNumber} - ${customerName}`
        };
      });
      return {
        ...current,
        sellerBills: [bill, ...(current.sellerBills || [])],
        stock: { ...currentStock, levels: nextLevels, finishedGoods: nextFinishedGoods, movements: [...saleMovements, ...rawSaleMovements, ...currentStock.movements] },
        sellerCustomers: [
          nextCustomer,
          ...currentCustomers.filter((item) => item.phone !== customerPhone)
        ]
      };
    });
    setItems([]);
    setCustomer({ name: "", phone: "", address: "", gstin: "", state: "Kerala", stateCode: "32" });
    setBillInfo({ supplyType: "B2C", paymentMode: "Cash", taxPercent: "5", applyRoundOff: false, destination: "", vehicleNumber: "", irn: "", ackNo: "", ackDate: "", ewayBillNo: "", signedQr: "", note: "" });
    toast("Bill generated and customer list updated.");
  };

  const shareByEmail = (bill) => {
    const subject = encodeURIComponent(`Aimies Local Sale Bill ${bill.billNumber}`);
    const body = encodeURIComponent(sellerBillText(bill));
    const to = ACCOUNTANT_EMAIL ? encodeURIComponent(ACCOUNTANT_EMAIL) : "";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const shareByWhatsApp = (bill) => {
    const text = encodeURIComponent(sellerBillText(bill));
    const phone = OWNER_WHATSAPP_NUMBER ? normalizePhone(OWNER_WHATSAPP_NUMBER).replace(/^\+/, "") : "";
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const printBill = (bill) => {
    setPrintTargetBill(bill);
    window.document.title = `${bill.billNumber} - Aimies Bill`;
    window.setTimeout(() => window.print(), 0);
  };

  const deleteCustomer = (customerId) => {
    const confirmed = window.confirm("Delete this customer from the seller customer list?");
    if (!confirmed) return;
    commit((current) => ({
      ...current,
      sellerCustomers: (current.sellerCustomers || []).filter((item) => item.id !== customerId)
    }));
    toast("Customer deleted.");
  };

  const deleteBill = (billId) => {
    const confirmed = window.confirm("Delete this bill from history?");
    if (!confirmed) return;
    commit((current) => {
      const deletedBill = (current.sellerBills || []).find((bill) => bill.id === billId);
      const currentStock = normalizeStock(current.stock);
      const nextLevels = { ...currentStock.levels };
      const nextFinishedGoods = { ...currentStock.finishedGoods };
      const saleMovements = currentStock.movements.filter((movement) => movement.type === "Billing Sale" && movement.billNumber === deletedBill?.billNumber);
      saleMovements.forEach((movement) => {
        if (movement.stockKey) nextFinishedGoods[movement.stockKey] = Number(nextFinishedGoods[movement.stockKey] || 0) + Number(movement.pieces || 0);
        if (movement.rawMaterialId) nextLevels[movement.rawMaterialId] = Number(nextLevels[movement.rawMaterialId] || 0) + Number(movement.litres || 0);
      });
      return {
        ...current,
        sellerBills: (current.sellerBills || []).filter((bill) => bill.id !== billId),
        stock: {
          ...currentStock,
          levels: nextLevels,
          finishedGoods: nextFinishedGoods,
          movements: currentStock.movements.filter((movement) => !(movement.type === "Billing Sale" && movement.billNumber === deletedBill?.billNumber))
        }
      };
    });
    toast("Bill deleted and its finished-goods stock restored.");
  };

  return (
    <DashboardGrid>
      <Panel title="Generate Local Sale Bill" className="seller-bill-panel">
        <div className="seller-compliance-note">
          <strong>GST compliance check</strong>
          <span>The printed bill uses the same invoice pattern for every amount. For bills of Rs. 50,000 or more, buyer address, state, and state code are required. For B2B/export GST tax invoices, generate IRN/QR through the authorised IRP first, then enter IRN/Ack details here.</span>
        </div>
        <form className="seller-bill-form" onSubmit={generateBill}>
          <label>Supply Type
            <select value={billInfo.supplyType} onChange={(event) => setBillInfo({ ...billInfo, supplyType: event.target.value })}>
              <option value="B2B">B2B – Business to Business</option>
              <option value="B2C">B2C – Business to Consumer</option>
            </select>
          </label>
          <label>Buyer Name<input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} placeholder="Customer name" /></label>
          <label>Phone Number<input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="Customer phone" /></label>
          <label>Address<input value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} placeholder="Buyer address" /></label>
          <label>GSTIN Optional<input value={customer.gstin} onChange={(event) => setCustomer({ ...customer, gstin: event.target.value })} placeholder="GST number if available" /></label>
          <label>State / Place of Supply
            <select value={customer.state} onChange={(event) => setCustomer({ ...customer, state: event.target.value, stateCode: stateCodeByName[event.target.value] })}>
              {indianStates.map((state) => <option key={state.code} value={state.name}>{state.name}</option>)}
            </select>
          </label>
          <label>State Code<input value={customer.stateCode} readOnly aria-label="State code (automatically populated)" /></label>
          <label>Payment Mode
            <select value={billInfo.paymentMode} onChange={(event) => setBillInfo({ ...billInfo, paymentMode: event.target.value })}>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Credit">Credit</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </label>
          <label>GST Rate
            <select value={billInfo.taxPercent} onChange={(event) => setBillInfo({ ...billInfo, taxPercent: event.target.value })}>
              {GST_RATES.map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
            </select>
          </label>
          <label className="checkbox-label"><input type="checkbox" checked={billInfo.applyRoundOff} onChange={(event) => setBillInfo({ ...billInfo, applyRoundOff: event.target.checked })} />Round off invoice total</label>
          <label>Destination<input value={billInfo.destination} onChange={(event) => setBillInfo({ ...billInfo, destination: event.target.value })} placeholder="Delivery destination" /></label>
          <label>Vehicle No.<input value={billInfo.vehicleNumber} onChange={(event) => setBillInfo({ ...billInfo, vehicleNumber: event.target.value })} placeholder="Optional vehicle number" /></label>
          <label>IRN<input value={billInfo.irn} onChange={(event) => setBillInfo({ ...billInfo, irn: event.target.value })} placeholder="Required for GST tax invoice" /></label>
          <label>Ack No.<input value={billInfo.ackNo} onChange={(event) => setBillInfo({ ...billInfo, ackNo: event.target.value })} placeholder="E-invoice acknowledgement no." /></label>
          <label>Ack Date<input type="date" value={billInfo.ackDate} onChange={(event) => setBillInfo({ ...billInfo, ackDate: event.target.value })} /></label>
          <label>e-Way Bill No.<input value={billInfo.ewayBillNo} onChange={(event) => setBillInfo({ ...billInfo, ewayBillNo: event.target.value })} placeholder="If applicable" /></label>
          <label className="wide-input">Signed QR Text<input value={billInfo.signedQr} onChange={(event) => setBillInfo({ ...billInfo, signedQr: event.target.value })} placeholder="Paste QR/IRP signed QR text if available" /></label>
          <label>Bill Note<input value={billInfo.note} onChange={(event) => setBillInfo({ ...billInfo, note: event.target.value })} placeholder="Optional note" /></label>
          {customers.length ? (
            <label>Saved Customer
              <select value="" onChange={(event) => selectCustomer(event.target.value)}>
                <option value="">Select previous customer</option>
                {customers.map((item) => <option key={item.id} value={item.phone}>{item.name} - {item.phone}</option>)}
              </select>
            </label>
          ) : null}
          <button className="primary-button" type="submit">Generate Bill</button>
        </form>
      </Panel>

      <Panel title="Add Oil Item" className="seller-bill-panel full-row-panel">
        <form className="seller-bill-form" onSubmit={addItem}>
          <label>Oil Item
            <select value={line.product} onChange={(event) => {
              const product = sellerOilItems.find((item) => item.id === event.target.value);
              setLine({ ...line, product: event.target.value, quantityUnit: product?.unit || "item" });
            }}>
              {sellerOilItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {line.product === "custom" ? <label>Custom Item<input value={line.customName} onChange={(event) => setLine({ ...line, customName: event.target.value })} placeholder="Oil item name" /></label> : null}
          <label>Quantity<input type="number" min="0" step="0.001" value={line.quantity} onChange={(event) => setLine({ ...line, quantity: event.target.value })} /></label>
          <label>Quantity Unit
            <select value={line.quantityUnit} onChange={(event) => setLine({ ...line, quantityUnit: event.target.value })}>
              {[selectedItem.unit, "litre", "kg"].filter((unit, index, all) => all.indexOf(unit) === index).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </label>
          <label>Converted Stock Quantity<input value={`${lineConversion.kg.toFixed(3)} kg${selectedPack ? ` / ${lineConversion.pieces.toFixed(3)} pieces` : ""}`} readOnly /></label>
          <label>Manual Amount<input type="number" min="0" step="0.01" value={line.amount} onChange={(event) => setLine({ ...line, amount: event.target.value })} placeholder="Amount collected" /></label>
          <button className="primary-button" type="submit">Add Item</button>
        </form>
      </Panel>

      <Panel title="Current Bill Items" className="full-row-panel">
        {items.length ? (
          <>
            <div className="data-table seller-item-table">
              <div className="data-head"><span>Item</span><span>Qty</span><span>Amount</span><span>Action</span></div>
              {items.map((item) => (
                <div className="data-row" key={item.id}>
                  <span>{item.name}</span>
                  <span>{stockAmount(item.quantity)} {item.unit}{item.quantityKg !== null && item.quantityKg !== undefined ? ` (${stockAmount(item.quantityKg)} kg)` : ""}</span>
                  <span>{money(item.amount)}</span>
                  <span><button type="button" className="icon-action danger" title="Remove item" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 14h10l1-14" /></svg></button></span>
                </div>
              ))}
            </div>
            <div className="seller-live-totals">
              <span>Taxable Amount: <b>{money(billSubtotal)}</b></span>
              <span>GST ({taxPercent}%): <b>{money(taxAmount)}</b></span>
              {billInfo.applyRoundOff ? <span>Round Off: <b>{money(roundOff)}</b></span> : null}
              <span>Total Invoice Amount: <b>{money(billTotal)}</b></span>
            </div>
          </>
        ) : <p className="empty-note">Add oil items to start a bill.</p>}
      </Panel>

      {previewBill ? (
        <Panel title="Generated Bill" className="full-row-panel seller-preview-panel">
          <BillPreview bill={previewBill} />
          <div className="seller-share-actions">
            <button type="button" className="primary-button" onClick={() => printBill(previewBill)}>Print Bill</button>
            <button type="button" className="secondary-button" onClick={() => shareByEmail(previewBill)}>Send to Accountant Email</button>
            <button type="button" className="secondary-button" onClick={() => shareByWhatsApp(previewBill)}>Send to Owner WhatsApp</button>
          </div>
          <p className="empty-note">Email and WhatsApp open your device apps. Fully automatic sending needs email and WhatsApp API credentials.</p>
        </Panel>
      ) : null}

      <Panel title="Customer List" className="full-row-panel">
        {customers.length ? <SellerCustomerTable customers={customers} onDelete={deleteCustomer} /> : <p className="empty-note">Customers will appear automatically after bills are generated.</p>}
      </Panel>

      <Panel title="Bill History" className="full-row-panel">
        {bills.length ? <SellerBillHistoryTable bills={bills} onPrint={printBill} onDelete={deleteBill} /> : <p className="empty-note">No local seller bills generated yet.</p>}
      </Panel>
    </DashboardGrid>
  );
}

function SellerCustomerTable({ customers, onDelete }) {
  return (
    <div className="data-table seller-customer-table">
      <div className="data-head">
        <span>Name</span><span>Phone</span><span>Address</span><span>GSTIN</span><span>State</span><span>Bills</span><span>Last Bill</span><span>Action</span>
      </div>
      {customers.map((customer) => (
        <div className="data-row" key={customer.id}>
          <span>{customer.name}</span>
          <span>{customer.phone}</span>
          <span>{customer.address || "--"}</span>
          <span>{customer.gstin || "--"}</span>
          <span>{customer.state}{customer.stateCode ? ` (${customer.stateCode})` : ""}</span>
          <span>{customer.totalBills || 0}</span>
          <span>{customer.lastBillAt || "--"}</span>
          <span className="seller-row-actions">
            <button type="button" className="icon-action danger" title="Delete customer" aria-label={`Delete ${customer.name}`} onClick={() => onDelete(customer.id)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 14h10l1-14" /></svg>
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function SellerBillHistoryTable({ bills, onPrint, onDelete }) {
  return (
    <div className="data-table seller-history-table">
      <div className="data-head">
        <span>Bill No</span><span>Document</span><span>Customer</span><span>Phone</span><span>Payment</span><span>Total</span><span>Date</span><span>Action</span>
      </div>
      {bills.map((bill) => (
        <div className="data-row" key={bill.id}>
          <span>{bill.billNumber}</span>
          <span>{bill.documentTitle || "--"}</span>
          <span>{bill.customerName}</span>
          <span>{bill.customerPhone}</span>
          <span>{bill.paymentMode || "--"}</span>
          <span>{money(bill.total)}</span>
          <span>{bill.date}</span>
          <span className="seller-row-actions">
            <button type="button" className="secondary-button compact-action-button" onClick={() => onPrint(bill)}>Print</button>
            <button type="button" className="icon-action danger" title="Delete bill" aria-label={`Delete ${bill.billNumber}`} onClick={() => onDelete(bill.id)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 14h10l1-14" /></svg>
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function SellerPerformaBillPage({ store, commit, session }) {
  const bills = store.sellerPerformaBills || [];
  const [buyer, setBuyer] = useState({ name: "", address1: "", address2: "", phone: "", state: "Kerala", stateCode: "32" });
  const [line, setLine] = useState({ product: "oil1l", customName: "", quantity: "1", unit: "BOX", rateInclTax: "", taxableRate: "" });
  const [items, setItems] = useState([]);
  const [printTargetBill, setPrintTargetBill] = useState(null);
  const selectedItem = sellerOilItems.find((item) => item.id === line.product) || sellerOilItems[0];
  const latestBill = bills[0] || null;
  const previewBill = printTargetBill || latestBill;
  const subtotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const cgst = subtotal * 0.025;
  const sgst = subtotal * 0.025;
  const roundedTotal = Math.round(subtotal + cgst + sgst);
  const roundOff = roundedTotal - (subtotal + cgst + sgst);

  const addItem = (event) => {
    event.preventDefault();
    const quantity = Number(line.quantity);
    const rateInclTax = Number(line.rateInclTax);
    const taxableRate = Number(line.taxableRate || (rateInclTax ? rateInclTax / 1.05 : 0));
    const name = line.product === "custom" ? line.customName.trim() : selectedItem.name;
    if (!name || !quantity || quantity <= 0 || !rateInclTax || rateInclTax <= 0) {
      toast("Enter item, quantity, and rate.", "error");
      return;
    }
    setItems((current) => [
      ...current,
      { id: uid("PFITEM"), name, hsn: selectedItem.hsn, quantity, unit: line.unit || selectedItem.unit.toUpperCase(), rateInclTax, taxableRate, amount: quantity * taxableRate }
    ]);
    setLine({ product: line.product, customName: "", quantity: "1", unit: line.unit, rateInclTax: "", taxableRate: "" });
  };

  const removeItem = (itemId) => setItems((current) => current.filter((item) => item.id !== itemId));

  const generatePerforma = (event) => {
    event.preventDefault();
    if (!buyer.name.trim() || !buyer.phone.trim()) {
      toast("Enter buyer name and phone number.", "error");
      return;
    }
    if (!items.length) {
      toast("Add at least one item before generating performa bill.", "error");
      return;
    }
    const bill = {
      id: uid("PF"),
      billNumber: String(bills.length + 1).padStart(5, "0"),
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-"),
      buyerName: buyer.name.trim(),
      buyerAddress1: buyer.address1.trim(),
      buyerAddress2: buyer.address2.trim(),
      buyerPhone: normalizePhone(buyer.phone),
      buyerState: buyer.state.trim() || "Kerala",
      buyerStateCode: buyer.stateCode.trim() || "32",
      items,
      subtotal,
      cgst,
      sgst,
      roundOff,
      total: roundedTotal,
      sellerName: session.name,
      createdAt: new Date().toISOString()
    };
    commit((current) => ({
      ...current,
      sellerPerformaBills: [bill, ...(current.sellerPerformaBills || [])]
    }));
    setItems([]);
    setBuyer({ name: "", address1: "", address2: "", phone: "", state: "Kerala", stateCode: "32" });
    toast("Performa bill generated.");
  };

  const printPerforma = (bill) => {
    setPrintTargetBill(bill);
    window.document.title = `Performa ${bill.billNumber} - Aimies`;
    window.setTimeout(() => window.print(), 0);
  };

  const deletePerforma = (billId) => {
    const confirmed = window.confirm("Delete this performa bill?");
    if (!confirmed) return;
    commit((current) => ({
      ...current,
      sellerPerformaBills: (current.sellerPerformaBills || []).filter((bill) => bill.id !== billId)
    }));
    toast("Performa bill deleted.");
  };

  return (
    <DashboardGrid>
      <Panel title="Create Performa Bill" className="seller-bill-panel">
        <form className="seller-bill-form" onSubmit={generatePerforma}>
          <label>Buyer Name<input value={buyer.name} onChange={(event) => setBuyer({ ...buyer, name: event.target.value })} placeholder="SABU VP" /></label>
          <label>Phone<input value={buyer.phone} onChange={(event) => setBuyer({ ...buyer, phone: event.target.value })} placeholder="Buyer mobile" /></label>
          <label>Address Line 1<input value={buyer.address1} onChange={(event) => setBuyer({ ...buyer, address1: event.target.value })} placeholder="Shop / place" /></label>
          <label>Address Line 2<input value={buyer.address2} onChange={(event) => setBuyer({ ...buyer, address2: event.target.value })} placeholder="City, district, PIN" /></label>
          <label>State<input value={buyer.state} onChange={(event) => setBuyer({ ...buyer, state: event.target.value })} /></label>
          <label>State Code<input value={buyer.stateCode} onChange={(event) => setBuyer({ ...buyer, stateCode: event.target.value })} /></label>
          <button className="primary-button" type="submit">Generate Performa</button>
        </form>
      </Panel>

      <Panel title="Add Performa Item" className="seller-bill-panel">
        <form className="seller-bill-form" onSubmit={addItem}>
          <label>Item
            <select value={line.product} onChange={(event) => setLine({ ...line, product: event.target.value })}>
              {sellerOilItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {line.product === "custom" ? <label>Custom Item<input value={line.customName} onChange={(event) => setLine({ ...line, customName: event.target.value })} /></label> : null}
          <label>Quantity<input type="number" min="0" step="0.1" value={line.quantity} onChange={(event) => setLine({ ...line, quantity: event.target.value })} /></label>
          <label>Unit<input value={line.unit} onChange={(event) => setLine({ ...line, unit: event.target.value.toUpperCase() })} placeholder="BOX / NOS" /></label>
          <label>Rate incl. tax<input type="number" min="0" step="0.01" value={line.rateInclTax} onChange={(event) => setLine({ ...line, rateInclTax: event.target.value, taxableRate: event.target.value ? (Number(event.target.value) / 1.05).toFixed(2) : "" })} /></label>
          <label>Taxable Rate<input type="number" min="0" step="0.01" value={line.taxableRate} onChange={(event) => setLine({ ...line, taxableRate: event.target.value })} /></label>
          <button className="primary-button" type="submit">Add Item</button>
        </form>
      </Panel>

      <Panel title="Current Performa Items" className="full-row-panel">
        {items.length ? (
          <>
            <div className="data-table performa-item-table">
              <div className="data-head"><span>Item</span><span>HSN/SAC</span><span>Qty</span><span>Rate incl.</span><span>Rate</span><span>Amount</span><span>Action</span></div>
              {items.map((item) => (
                <div className="data-row" key={item.id}>
                  <span>{item.name}</span><span>{item.hsn}</span><span>{stockAmount(item.quantity)} {item.unit}</span><span>{money(item.rateInclTax)}</span><span>{money(item.taxableRate)}</span><span>{money(item.amount)}</span>
                  <span><button type="button" className="icon-action danger" title="Remove item" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 14h10l1-14" /></svg></button></span>
                </div>
              ))}
            </div>
            <p className="seller-total">Performa total: {money(roundedTotal)}</p>
          </>
        ) : <p className="empty-note">Add items to start a performa bill.</p>}
      </Panel>

      {previewBill ? (
        <Panel title="Generated Performa" className="full-row-panel seller-preview-panel">
          <PerformaBillPreview bill={previewBill} />
          <div className="seller-share-actions">
            <button type="button" className="primary-button" onClick={() => printPerforma(previewBill)}>Print Performa</button>
          </div>
        </Panel>
      ) : null}

      <Panel title="Performa Bill History" className="full-row-panel">
        {bills.length ? <PerformaHistoryTable bills={bills} onPrint={printPerforma} onDelete={deletePerforma} /> : <p className="empty-note">No performa bills generated yet.</p>}
      </Panel>
    </DashboardGrid>
  );
}

function PerformaHistoryTable({ bills, onPrint, onDelete }) {
  return (
    <div className="data-table performa-history-table">
      <div className="data-head"><span>No.</span><span>Buyer</span><span>Phone</span><span>Total</span><span>Date</span><span>Action</span></div>
      {bills.map((bill) => (
        <div className="data-row" key={bill.id}>
          <span>{bill.billNumber}</span><span>{bill.buyerName}</span><span>{bill.buyerPhone}</span><span>{money(bill.total)}</span><span>{bill.date}</span>
          <span className="seller-row-actions">
            <button type="button" className="secondary-button compact-action-button" onClick={() => onPrint(bill)}>Print</button>
            <button type="button" className="icon-action danger" title="Delete performa" aria-label={`Delete performa ${bill.billNumber}`} onClick={() => onDelete(bill.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M6 7l1 14h10l1-14" /></svg></button>
          </span>
        </div>
      ))}
    </div>
  );
}

function PerformaBillPreview({ bill }) {
  const totalQuantity = bill.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  return (
    <article className="performa-preview">
      <h2>PERFORMA</h2>
      <section className="performa-top">
        <div className="performa-company">
          <strong>{COMPANY_LEGAL_NAME}</strong>
          <span>{COMPANY_ADDRESS}</span>
          <span>Fssai Lic. No{COMPANY_FSSAI}</span>
          <span>GSTIN/UIN: {COMPANY_GSTIN}</span>
          <span>State Name : Kerala, Code : 32</span>
          <span>E-Mail : {COMPANY_EMAIL}</span>
          <b>To</b>
          <strong>{bill.buyerName}</strong>
          <span>{bill.buyerAddress1}</span>
          <span>{bill.buyerAddress2}</span>
          <span>Mob: {bill.buyerPhone}</span>
          <span>State Name : {bill.buyerState}</span>
        </div>
        <div className="performa-invoice-box">
          <span>Invoice No.<b>{bill.billNumber}</b></span>
          <span>Dated<b>{bill.date}</b></span>
        </div>
      </section>
      <div className="data-table performa-preview-table">
        <div className="data-head"><span>Sl No</span><span>Item Details</span><span>HSN/SAC</span><span>Quantity</span><span>Rate (incl. of tax)</span><span>Rate</span><span>Amount</span></div>
        {bill.items.map((item, index) => (
          <div className="data-row" key={item.id}>
            <span>{index + 1}</span><span>{item.name}</span><span>{item.hsn}</span><span>{stockAmount(item.quantity)} {item.unit}</span><span>{stockAmount(item.rateInclTax)}</span><span>{stockAmount(item.taxableRate)}</span><span>{stockAmount(item.amount)}</span>
          </div>
        ))}
        <div className="data-row performa-summary-row"><span></span><span></span><span></span><span></span><span></span><span></span><span>{stockAmount(bill.subtotal)}</span></div>
        <div className="data-row performa-summary-row"><span></span><span>CGST 2.5%</span><span></span><span></span><span></span><span></span><span>{stockAmount(bill.cgst)}</span></div>
        <div className="data-row performa-summary-row"><span></span><span>SGST 2.5%</span><span></span><span></span><span></span><span></span><span>{stockAmount(bill.sgst)}</span></div>
        <div className="data-row performa-summary-row"><span></span><span>ROUND OFF</span><span></span><span></span><span></span><span></span><span>{stockAmount(bill.roundOff)}</span></div>
        <div className="data-row performa-total-row"><span></span><span>Total</span><span></span><span>{stockAmount(totalQuantity)}</span><span></span><span></span><span>Rs. {stockAmount(bill.total)}</span></div>
      </div>
      <strong className="performa-words">{amountInWords(bill.total)}</strong>
      <section className="performa-footer-grid">
        <div>
          <b>Terms & Conditions :</b>
          <span>1) The Bill amount should be settled through RTGS before unloading the products.</span>
          <span>2) After making sure the items delivered is in proper condition, the Received Note should be given to the staff with Seal and Sign.</span>
          <span>3) The rate of the product will remain the same only till the date mentioned in the purchase order and is subjected to market fluctuation from thereafter.</span>
        </div>
        <div>
          <b>for {COMPANY_LEGAL_NAME}</b>
          <span>Company's Bank Details</span>
          <span>A/c Holder's Name : {COMPANY_LEGAL_NAME}</span>
          <span>Bank Name : HDFC</span>
          <span>A/c No. : 50200063275093</span>
          <span>Branch & IFS Code : CHENDAMANGALAM & HDFC0000823</span>
          <span>SWIFT Code : HDFCINBBCOC</span>
          <strong>Authorised Signatory</strong>
        </div>
      </section>
    </article>
  );
}

function BillPreview({ bill }) {
  return (
    <article className="seller-bill-preview">
      <header>
        <img src={aimiesLogoImage} alt="Aimies" />
        <div>
          <strong>{COMPANY_LEGAL_NAME}</strong>
          <span>{bill.documentTitle || "TAX INVOICE"}</span>
          <small>{COMPANY_ADDRESS}</small>
          <small>GSTIN: {COMPANY_GSTIN} | FSSAI: {COMPANY_FSSAI}</small>
          <small>Phone: {COMPANY_PHONE} | Mob: {COMPANY_MOBILE}</small>
          <small>Email: {COMPANY_EMAIL}</small>
        </div>
      </header>
      <div className="seller-bill-meta">
        <span><b>Bill No</b>{bill.billNumber}</span>
        <span><b>Date</b>{bill.date}</span>
        <span><b>Supply Type</b>{bill.supplyType || (bill.documentType === "tax" ? "B2B" : "B2C")}</span>
        {bill.irn ? <span><b>IRN</b>{bill.irn}</span> : null}
        {bill.ackNo ? <span><b>Ack No.</b>{bill.ackNo}</span> : null}
        {bill.ackDate ? <span><b>Ack Date</b>{bill.ackDate}</span> : null}
        {bill.ewayBillNo ? <span><b>e-Way Bill No.</b>{bill.ewayBillNo}</span> : null}
        <span><b>Payment</b>{bill.paymentMode}</span>
        <span><b>Place of Supply</b>{bill.placeOfSupply}</span>
        <span><b>Buyer</b>{bill.customerName}</span>
        <span><b>Phone</b>{bill.customerPhone}</span>
        {bill.customerAddress ? <span><b>Address</b>{bill.customerAddress}</span> : null}
        {bill.customerGstin ? <span><b>GSTIN</b>{bill.customerGstin}</span> : null}
        {bill.destination ? <span><b>Destination</b>{bill.destination}</span> : null}
        {bill.vehicleNumber ? <span><b>Vehicle No.</b>{bill.vehicleNumber}</span> : null}
        {bill.note ? <span><b>Note</b>{bill.note}</span> : null}
      </div>
      <div className="data-table seller-item-table">
        <div className="data-head"><span>Item</span><span>HSN</span><span>Qty</span><span>Rate</span><span>Amount</span></div>
        {bill.items.map((item) => (
          <div className="data-row" key={item.id}>
            <span>{item.name}</span>
            <span>{item.hsn}</span>
            <span>{stockAmount(item.quantity)} {item.unit}{item.quantityKg !== null && item.quantityKg !== undefined ? ` (${stockAmount(item.quantityKg)} kg)` : ""}</span>
            <span>{money(item.rate)}</span>
            <span>{money(item.amount)}</span>
          </div>
        ))}
      </div>
      <div className="seller-tax-summary">
        <span><b>Taxable Amount</b>{money(bill.taxableAmount ?? bill.subtotal ?? bill.total)}</span>
        {(bill.taxType ? bill.taxType === "INTRASTATE" : !bill.igst) ? <><span><b>CGST ({Number(bill.taxPercent || 0) / 2}%)</b>{money(bill.cgst || 0)}</span><span><b>SGST ({Number(bill.taxPercent || 0) / 2}%)</b>{money(bill.sgst || 0)}</span></> : <span><b>IGST ({bill.taxPercent || 0}%)</b>{money(bill.igst || 0)}</span>}
        <span><b>Tax Amount</b>{money(bill.taxAmount ?? ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)))}</span>
        {bill.roundOff ? <span><b>Round Off</b>{money(bill.roundOff)}</span> : null}
      </div>
      {bill.signedQr ? <p className="seller-qr-text"><b>Signed QR:</b> {bill.signedQr}</p> : null}
      <footer>
        <span>Seller: {bill.sellerName}</span>
        <strong>Total: {money(bill.total)}</strong>
      </footer>
    </article>
  );
}

function StockPage({ store, commit }) {
  const stock = normalizeStock(store.stock);
  const [topUp, setTopUp] = useState({ material: "oil", quantity: "", note: "" });
  const [finishedTopUp, setFinishedTopUp] = useState({ stockKey: oilPackConversions[0].id, quantity: "", unit: "box", note: "" });
  const [dispatch, setDispatch] = useState({ product: oilPackConversions[0].id, cases: "1", location: "" });
  const selectedFinishedPack = oilPackConversionMap[finishedTopUp.stockKey] || oilPackConversions[0];
  const finishedConversion = oilQuantityConversion(selectedFinishedPack, finishedTopUp.quantity, finishedTopUp.unit);
  const selectedProduct = oilPackConversionMap[dispatch.product] || oilPackConversions[0];
  const dispatchCases = Math.max(0, parseInt(dispatch.cases, 10) || 0);
  const dispatchPieces = dispatchCases * selectedProduct.piecesPerBox;
  const dispatchKg = dispatchPieces * selectedProduct.kgPerPiece;
  const dispatchShortage = dispatchPieces > Number(stock.finishedGoods[selectedProduct.id] || 0);
  const stockUpdates = stock.movements.filter((movement) => movement.type === "Stock Updated");
  const finishedStockUpdates = stock.movements.filter((movement) => movement.type === "Finished Goods Updated");
  const billingSales = stock.movements.filter((movement) => movement.type === "Billing Sale");
  const dispatches = stock.movements.filter((movement) => movement.type === "Dispatch");

  const commitStock = (updater) => {
    commit((current) => {
      const currentStock = normalizeStock(current.stock);
      const nextStock = typeof updater === "function" ? updater(currentStock) : updater;
      return { ...current, stock: normalizeStock(nextStock) };
    });
  };

  const addMaterialStock = (event) => {
    event.preventDefault();
    const quantity = Number(topUp.quantity);
    if (!quantity || quantity <= 0) {
      toast("Enter a valid stock quantity.", "error");
      return;
    }
    const material = stockMaterialMap[topUp.material];
    commitStock((current) => ({
      ...current,
      levels: { ...current.levels, [topUp.material]: Number(current.levels[topUp.material] || 0) + quantity },
      movements: [
        { id: uid("STK"), type: "Stock Updated", date: today(), materialId: topUp.material, item: material.name, quantity, unit: material.unit, note: topUp.note || "Admin stock update" },
        ...current.movements
      ]
    }));
    setTopUp({ material: topUp.material, quantity: "", note: "" });
    toast(`${material.name} stock updated.`);
  };

  const addFinishedGoodsStock = (event) => {
    event.preventDefault();
    const quantity = Number(finishedTopUp.quantity);
    if (!quantity || quantity <= 0 || !finishedConversion.pieces) {
      toast("Enter a valid finished-goods quantity.", "error");
      return;
    }
    commitStock((current) => ({
      ...current,
      finishedGoods: {
        ...current.finishedGoods,
        [selectedFinishedPack.id]: Number(current.finishedGoods[selectedFinishedPack.id] || 0) + finishedConversion.pieces
      },
      movements: [
        {
          id: uid("FG"), type: "Finished Goods Updated", date: today(), stockKey: selectedFinishedPack.id,
          item: selectedFinishedPack.name, quantity, unit: finishedTopUp.unit, pieces: finishedConversion.pieces,
          kg: finishedConversion.kg, note: finishedTopUp.note || "Finished goods stock update"
        },
        ...current.movements
      ]
    }));
    setFinishedTopUp({ ...finishedTopUp, quantity: "", note: "" });
    toast(`${selectedFinishedPack.name} stock increased by ${stockAmount(finishedConversion.pieces)} pieces (${stockAmount(finishedConversion.kg)} kg).`);
  };

  const recordDispatch = (event) => {
    event.preventDefault();
    if (!dispatchCases) {
      toast("Enter sold/exported case count.", "error");
      return;
    }
    if (dispatchShortage) {
      toast(`Not enough ${selectedProduct.name} finished stock for this dispatch.`, "error");
      return;
    }
    commitStock((current) => {
      const nextFinishedGoods = { ...current.finishedGoods };
      nextFinishedGoods[selectedProduct.id] = Number(nextFinishedGoods[selectedProduct.id] || 0) - dispatchPieces;
      return {
        ...current,
        finishedGoods: nextFinishedGoods,
        movements: [
          { id: uid("DSP"), type: "Dispatch", date: today(), stockKey: selectedProduct.id, item: selectedProduct.name, quantity: dispatchCases, unit: "boxes", pieces: dispatchPieces, kg: dispatchKg, note: dispatch.location || "Export dispatch" },
          ...current.movements
        ]
      };
    });
    setDispatch({ ...dispatch, cases: "1", location: "" });
    toast(`${dispatchCases} box${dispatchCases > 1 ? "es" : ""} dispatched and finished stock deducted.`);
  };

  const deleteMovement = (movement) => {
    const confirmed = window.confirm(`Delete this ${movement.type.toLowerCase()} record for ${movement.item}?`);
    if (!confirmed) return;
    commitStock((current) => {
      const nextLevels = { ...current.levels };
      const nextFinishedGoods = { ...current.finishedGoods };
      if (movement.type === "Stock Updated") {
        const materialId = movement.materialId || stockMaterials.find((material) => material.name === movement.item)?.id;
        if (materialId) nextLevels[materialId] = Number(nextLevels[materialId] || 0) - Number(movement.quantity || 0);
      }
      if (movement.type === "Dispatch") {
        const stockKey = movement.stockKey || movement.productId;
        if (stockKey && oilPackConversionMap[stockKey]) {
          nextFinishedGoods[stockKey] = Number(nextFinishedGoods[stockKey] || 0) + Number(movement.pieces || 0);
        } else {
          const legacyProduct = stockProducts.find((item) => item.id === movement.productId || item.name === movement.item);
          if (legacyProduct) {
            const legacyDraw = productCaseDraw(legacyProduct);
            for (const [material, amount] of Object.entries(legacyDraw)) {
              nextLevels[material] = Number(nextLevels[material] || 0) + amount * Number(movement.quantity || 0);
            }
          }
        }
      }
      if (movement.type === "Finished Goods Updated" && movement.stockKey) {
        nextFinishedGoods[movement.stockKey] = Number(nextFinishedGoods[movement.stockKey] || 0) - Number(movement.pieces || 0);
      }
      if (movement.type === "Billing Sale" && movement.stockKey) {
        nextFinishedGoods[movement.stockKey] = Number(nextFinishedGoods[movement.stockKey] || 0) + Number(movement.pieces || 0);
      }
      if (movement.type === "Billing Sale" && movement.rawMaterialId) {
        nextLevels[movement.rawMaterialId] = Number(nextLevels[movement.rawMaterialId] || 0) + Number(movement.litres || 0);
      }
      return {
        ...current,
        levels: nextLevels,
        finishedGoods: nextFinishedGoods,
        movements: current.movements.filter((item) => item.id !== movement.id)
      };
    });
    toast(`${movement.type} record deleted.`);
  };

  return (
    <DashboardGrid>
      <Panel title="Raw Material Stock Updater">
        <form className="stock-form" onSubmit={addMaterialStock}>
          <label>Material
            <select value={topUp.material} onChange={(event) => setTopUp({ ...topUp, material: event.target.value })}>
              {stockMaterials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
            </select>
          </label>
          <label>Quantity
            <input type="number" min="0" step="0.1" value={topUp.quantity} onChange={(event) => setTopUp({ ...topUp, quantity: event.target.value })} placeholder="0" />
          </label>
          <label>Note
            <input value={topUp.note} onChange={(event) => setTopUp({ ...topUp, note: event.target.value })} placeholder="Monthly stock update" />
          </label>
          <button className="primary-button" type="submit">Add Stock</button>
        </form>
      </Panel>

      <Panel title="Stock Updater - Coconut Oil Items">
        <form className="stock-form" onSubmit={addFinishedGoodsStock}>
          <label>Stock Item
            <select value={finishedTopUp.stockKey} onChange={(event) => setFinishedTopUp({ ...finishedTopUp, stockKey: event.target.value })}>
              {oilPackConversions.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.kgPerPiece.toFixed(3)} kg × {item.piecesPerBox} pcs/box</option>)}
            </select>
          </label>
          <label>Quantity
            <input type="number" min="0" step="0.001" value={finishedTopUp.quantity} onChange={(event) => setFinishedTopUp({ ...finishedTopUp, quantity: event.target.value })} placeholder="0" />
          </label>
          <label>Unit
            <select value={finishedTopUp.unit} onChange={(event) => setFinishedTopUp({ ...finishedTopUp, unit: event.target.value })}>
              <option value="box">Box</option><option value="piece">Piece</option><option value="litre">Litre</option><option value="kg">KG</option>
            </select>
          </label>
          <label>Converted Quantity<input value={`${finishedConversion.pieces.toFixed(3)} pieces / ${finishedConversion.kg.toFixed(3)} kg`} readOnly /></label>
          <label>Note<input value={finishedTopUp.note} onChange={(event) => setFinishedTopUp({ ...finishedTopUp, note: event.target.value })} placeholder="Production / opening stock" /></label>
          <button className="primary-button" type="submit">Add Finished Stock</button>
        </form>
      </Panel>

      <Panel title="Record Sold / Exported Boxes">
        <form className="stock-form" onSubmit={recordDispatch}>
          <label>Pack
            <select value={dispatch.product} onChange={(event) => setDispatch({ ...dispatch, product: event.target.value })}>
              {oilPackConversions.map((product) => <option key={product.id} value={product.id}>{product.name} - {product.piecesPerBox} pcs/box</option>)}
            </select>
          </label>
          <label>Boxes Sold
            <input type="number" min="1" value={dispatch.cases} onChange={(event) => setDispatch({ ...dispatch, cases: event.target.value })} />
          </label>
          <label>Location
            <input value={dispatch.location} onChange={(event) => setDispatch({ ...dispatch, location: event.target.value })} placeholder="Kerala / export location" />
          </label>
          <button className="primary-button" type="submit" disabled={dispatchShortage}>Dispatch</button>
        </form>
        <div className="stock-deduction">
          <strong>Finished-goods deduction for {dispatchCases || 0} box{dispatchCases === 1 ? "" : "es"}</strong>
          <span className={dispatchShortage ? "short" : ""}>
            {selectedProduct.name}: {stockAmount(dispatchPieces)} pieces / {stockAmount(dispatchKg)} kg required; {stockAmount(stock.finishedGoods[selectedProduct.id] || 0)} pieces available
          </span>
        </div>
      </Panel>

      <Panel title="Finished Goods Capacity" className="full-row-panel">
        <div className="stock-capacity-grid">
          {oilPackConversions.map((product) => {
            const availablePieces = Math.max(0, Number(stock.finishedGoods[product.id] || 0));
            const completeBoxes = Math.floor(availablePieces / product.piecesPerBox);
            const loosePieces = availablePieces - completeBoxes * product.piecesPerBox;
            const totalKg = availablePieces * product.kgPerPiece;
            return (
              <article className="stock-capacity-card" key={product.id}>
                <span>{product.piecesPerBox} pcs / box · {product.kgPerBox.toFixed(3)} kg / box</span>
                <strong>{product.name}</strong>
                <b>{stockAmount(completeBoxes)} boxes</b>
                <small>{stockAmount(availablePieces)} pieces available{loosePieces ? ` (${stockAmount(loosePieces)} loose)` : ""}</small>
                <em>{stockAmount(totalKg)} kg total stock</em>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="Raw Material Stock" className="full-row-panel">
        <div className="data-table stock-material-table">
          <div className="data-head">
            <span>Material</span><span>Available</span><span>Unit</span>
          </div>
          {stockMaterials.map((material) => (
            <div className="data-row" key={material.id}>
              <span>{material.name}</span>
              <span>{stockAmount(stock.levels[material.id])}</span>
              <span>{material.unit}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Coconut Oil Items in Stock" className="full-row-panel">
        <div className="data-table finished-stock-table">
          <div className="data-head"><span>Items</span><span>Gram / KG</span><span>Qty per Box</span><span>Total Qty / Box</span><span>Available Pieces</span><span>Available Boxes</span><span>Available Total KG</span></div>
          {oilPackConversions.map((item) => {
            const pieces = Number(stock.finishedGoods[item.id] || 0);
            return <div className="data-row" key={item.id}>
              <span>{item.name}</span><span>{item.kgPerPiece.toFixed(3)}</span><span>{item.piecesPerBox}</span><span>{item.kgPerBox.toFixed(3)}</span>
              <span>{stockAmount(pieces)}</span><span>{stockAmount(pieces / item.piecesPerBox)}</span><span>{stockAmount(pieces * item.kgPerPiece)}</span>
            </div>;
          })}
        </div>
      </Panel>

      <Panel title="Stock Movement" className="full-row-panel">
        {stock.movements.length ? (
          <div className="stock-movement-groups">
            <StockMovementGroup title="Stock Updation" rows={stockUpdates} emptyText="No stock updates yet." onDelete={deleteMovement} />
            <StockMovementGroup title="Finished Goods Updation" rows={finishedStockUpdates} emptyText="No finished-goods updates yet." onDelete={deleteMovement} />
            <StockMovementGroup title="Billing Sales" rows={billingSales} emptyText="No billing deductions yet." onDelete={deleteMovement} />
            <StockMovementGroup title="Dispatching" rows={dispatches} emptyText="No dispatches yet." onDelete={deleteMovement} />
          </div>
        ) : <p className="empty-note">No stock movement yet.</p>}
      </Panel>
    </DashboardGrid>
  );
}

function StockMovementGroup({ title, rows, emptyText, onDelete }) {
  return (
    <section className="stock-movement-group">
      <h3>{title}</h3>
      {rows.length ? (
        <div className="data-table stock-movement-table">
          <div className="data-head">
            <span>Date</span><span>Item</span><span>Quantity</span><span>Note / Location</span><span>Action</span>
          </div>
          {rows.map((movement) => (
            <div className="data-row" key={movement.id}>
              <span>{movement.date}</span>
              <span>{movement.item}</span>
              <span>{stockAmount(movement.quantity)} {movement.unit}{movement.kg !== undefined ? ` / ${stockAmount(movement.kg)} kg` : ""}</span>
              <span>{movement.note}</span>
              <span>
                <button type="button" className="icon-action danger" aria-label={`Delete ${movement.item} ${movement.type.toLowerCase()} record`} title="Delete record" onClick={() => onDelete(movement)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v5" />
                    <path d="M14 11v5" />
                  </svg>
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : <p className="empty-note">{emptyText}</p>}
    </section>
  );
}

function EmployeePage({ activePage, store, commit, commitAttendance, session }) {
  const currentEmployee = getEmployeeForSession(store, session);
  if (!currentEmployee) return <EmployeeProfileMissing session={session} />;
  if (activePage === "employees") return <DashboardGrid><EmployeeProfilePanel employee={currentEmployee} /></DashboardGrid>;
  if (activePage === "leave") return <DashboardGrid><LeaveFormPanel store={store} commit={commit} currentEmployee={currentEmployee} /><LeaveTable leaves={store.leaves.filter((item) => item.employeeId === currentEmployee.id)} /></DashboardGrid>;
  if (activePage === "expenses") return <DashboardGrid><ExpenseFormPanel store={store} commit={commit} currentEmployee={currentEmployee} /><ExpenseTable expenses={store.expenses.filter((item) => item.employeeId === currentEmployee.id)} /></DashboardGrid>;
  if (activePage === "attendance") return <DashboardGrid><EmployeeAttendancePanel store={store} commit={commitAttendance} currentEmployee={currentEmployee} /></DashboardGrid>;
  return <EmployeeHome store={store} commit={commit} commitAttendance={commitAttendance} currentEmployee={currentEmployee} />;
}

function EmployeeProfilePanel({ employee }) {
  const fields = [
    ["Employee ID", employee.id],
    ["Name", employee.name],
    ["Email", employee.email],
    ["Dashboard Access", roles[employee.accessRole]?.title || employee.accessRole || "Employee"],
    ["Department", employee.department],
    ["Role", employee.role],
    ["Salary", money(employee.salary)],
    ["Date of Joining", employee.joinedAt],
    ["Birthday", employee.birthday],
    ["Blood Group", employee.bloodGroup],
    ["Mobile", employee.mobile],
    ["Alternative Number", employee.alternativeNumber],
    ["Aadhaar Number", employee.aadhaar],
    ["PAN", employee.pan],
    ["UAN", employee.uan],
    ["Experience", employee.experience],
    ["Qualification", employee.qualification],
    ["College", employee.college],
    ["Address", employee.address],
    ["Status", employee.status]
  ];

  return (
    <Panel title="My Profile" className="full-row-panel employee-profile-panel">
      <div className="profile-detail-grid">
        {fields.map(([label, value]) => (
          <div className="profile-detail" key={label}>
            <span>{label}</span>
            <strong>{value || "--"}</strong>
          </div>
        ))}
        <div className="profile-detail">
          <span>Aadhaar Card</span>
          <strong><EmployeeDocumentLinks document={employee.aadhaarDocument} /></strong>
        </div>
      </div>
    </Panel>
  );
}

function EmployeeProfileMissing({ session }) {
  return (
    <DashboardGrid>
      <Panel title="Employee Profile Required" className="full-row-panel">
        <p className="empty-note">No employee profile is registered for {session.email}. Ask Admin to add this employee in the Employee Directory first.</p>
      </Panel>
    </DashboardGrid>
  );
}

function getEmployeeForSession(store, session) {
  const email = session.email?.toLowerCase();
  const employee = store.employees.find((item) => item.email?.toLowerCase() === email);
  if (employee) return employee;

  const login = (store.logins || []).find((item) => item.email?.toLowerCase() === email);
  if (!login) return null;

  return {
    id: login.employeeId || `LOGIN-${login.email}`,
    name: login.name || session.name,
    email: login.email,
    accessRole: login.accessRole || session.role,
    department: "General",
    role: roles[login.accessRole]?.title || "Employee",
    salary: 0,
    joinedAt: "",
    birthday: "",
    mobile: "",
    alternativeNumber: "",
    aadhaar: "",
    pan: "",
    uan: "",
    experience: "",
    qualification: "",
    college: "",
    address: "",
    status: login.status || "Active"
  };
}

function findEmployeeForAttendance(record, employees = []) {
  const email = String(record.userEmail || "").trim().toLowerCase();
  if (email) {
    const emailMatch = employees.find((employee) => employee.email?.trim().toLowerCase() === email);
    if (emailMatch) return emailMatch;
  }

  const name = String(record.employeeName || "").trim().toLowerCase();
  if (!name) return null;
  return employees.find((employee) => employee.name?.trim().toLowerCase() === name) || null;
}

function normalizeAttendanceEmployee(record, employees = []) {
  const employee = findEmployeeForAttendance(record, employees);
  if (!employee) return { ...record, employeeId: record.employeeId || record.id };
  return {
    ...record,
    employeeId: employee.id,
    employeeName: employee.name || record.employeeName,
    userEmail: employee.email || record.userEmail || ""
  };
}

function AttendancePage({ store, commit, commitAttendance, deleteAttendance, session }) {
  const currentEmployee = getEmployeeForSession(store, session);
  return (
    <DashboardGrid>
      {currentEmployee ? (
        <EmployeeAttendancePanel store={store} commit={commitAttendance || commit} currentEmployee={currentEmployee} />
      ) : (
        <Panel title="My Attendance" className="full-row-panel">
          <p className="empty-note">No employee profile is linked to {session.email}. Add this email in Employee Directory to mark attendance.</p>
        </Panel>
      )}
      <AttendanceTable
        attendance={store.attendance}
        employees={store.employees}
        canEdit={session.role === "admin"}
        onSaveAttendance={commitAttendance || commit}
        onDeleteAttendance={deleteAttendance}
        className="full-row-panel"
      />
    </DashboardGrid>
  );
}

function AdminHome({ store, commit }) {
  const totals = getTotals(buildFinanceRows(store));
  return (
    <DashboardGrid>
      <Panel title="Admin Overview" className="full-row-panel">
        <div className="overview-grid">
          <Metric label="Employees" value={store.employees.length} />
          <Metric label="Credit" value={money(totals.credit)} />
          <Metric label="Debit" value={money(totals.debit)} />
          <Metric label="Total" value={money(totals.credit - totals.debit)} />
          <Metric label="Pending Leaves" value={store.leaves.filter((item) => item.status === "Pending").length} />
          <Metric label="Pending Expenses" value={store.expenses.filter((item) => item.status === "Pending").length} />
        </div>
      </Panel>
      <ApprovalPanel title="Leave Applications" items={store.leaves.filter((item) => item.status === "Pending")} kind="leaves" commit={commit} className="full-row-panel" />
      <ApprovalPanel title="Expense Approvals" items={store.expenses.filter((item) => item.status === "Pending")} kind="expenses" commit={commit} className="full-row-panel" />
      <AttendanceTable attendance={store.attendance.slice(0, 5)} employees={store.employees} title="Recent Attendance" className="full-row-panel" />
    </DashboardGrid>
  );
}

function EmployeeHome({ store, commit, commitAttendance, currentEmployee }) {
  const leaves = store.leaves.filter((item) => item.employeeId === currentEmployee.id);
  const expenses = store.expenses.filter((item) => item.employeeId === currentEmployee.id);
  return (
    <DashboardGrid>
      <Panel title="My Overview">
        <div className="overview-grid">
          <Metric label="Leave Requests" value={leaves.length} />
          <Metric label="Expense Claims" value={expenses.length} />
          <Metric label="Approved Amount" value={money(expenses.filter((item) => item.status === "Approved").reduce((sum, item) => sum + Number(item.amount), 0))} />
        </div>
      </Panel>
      <EmployeeAttendancePanel store={store} commit={commitAttendance || commit} currentEmployee={currentEmployee} />
      <LeaveFormPanel store={store} commit={commit} currentEmployee={currentEmployee} />
      <ExpenseFormPanel store={store} commit={commit} currentEmployee={currentEmployee} />
    </DashboardGrid>
  );
}

function AddLoginPanel({ commit }) {
  const blankLogin = { name: "", email: "", accessRole: "employee" };
  const [login, setLogin] = useState(blankLogin);

  const addLogin = (event) => {
    event.preventDefault();
    if (!login.name.trim() || !login.email.trim()) {
      toast("Enter name and email before adding login.", "error");
      return;
    }
    commit((current) => ({
      ...current,
      logins: [
        {
          id: uid("LOGIN"),
          name: login.name.trim(),
          email: login.email.trim().toLowerCase(),
          accessRole: login.accessRole,
          status: "Active"
        },
        ...(current.logins || [])
      ]
    }));
    toast("Login access added.");
    setLogin(blankLogin);
  };

  return (
    <Panel title="Add Login" className="full-row-panel">
      <form className="form-grid" onSubmit={addLogin}>
        <input placeholder="Name" value={login.name} onChange={(event) => setLogin({ ...login, name: event.target.value })} />
        <input placeholder="Email" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} />
        <select value={login.accessRole} onChange={(event) => setLogin({ ...login, accessRole: event.target.value })}>
          <option value="admin">Admin dashboard</option>
          <option value="hr">HR / Accountant dashboard</option>
          <option value="employee">Employee dashboard</option>
          <option value="localSeller">Local Seller dashboard</option>
        </select>
        <button className="primary-button">Add Login</button>
      </form>
    </Panel>
  );
}

function LoginAccessTable({ logins, commit, className = "" }) {
  const [editingLogin, setEditingLogin] = useState(null);

  const deleteLogin = (loginId) => {
    commit((current) => ({
      ...current,
      logins: (current.logins || []).filter((login) => login.id !== loginId)
    }));
    toast("Login access deleted.");
  };

  const updateLogin = (updatedLogin) => {
    commit((current) => ({
      ...current,
      logins: (current.logins || []).map((login) => (
        login.id === updatedLogin.id ? updatedLogin : login
      ))
    }));
    setEditingLogin(null);
    toast("Login access updated.");
  };

  if (!logins.length) return <Panel title="Login Access" className={className}><p className="empty-note">No login access added yet.</p></Panel>;

  return (
    <Panel title="Login Access" className={className}>
      <div className="data-table login-records">
        <div className="data-head">
          <span>name</span>
          <span>email</span>
          <span>dashboard</span>
          <span>status</span>
          <span>action</span>
        </div>
        {logins.map((login) => (
          <div className="data-row" key={login.id}>
            <span>{login.name}</span>
            <span>{login.email}</span>
            <span>{roles[login.accessRole]?.title || "Employee"}</span>
            <span>{login.status}</span>
            <span className="employee-action-buttons">
              <button className="icon-action" type="button" aria-label={`Edit ${login.email}`} title="Edit login" onClick={() => setEditingLogin(login)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
              </button>
              <button className="icon-action danger" type="button" aria-label={`Delete ${login.email}`} title="Delete login" onClick={() => deleteLogin(login.id)}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16" />
                  <path d="M9 7V5h6v2" />
                  <path d="M6 7l1 14h10l1-14" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            </span>
          </div>
        ))}
      </div>
      {editingLogin ? (
        <LoginEditModal
          login={editingLogin}
          onClose={() => setEditingLogin(null)}
          onSave={updateLogin}
        />
      ) : null}
    </Panel>
  );
}

function LoginEditModal({ login, onClose, onSave }) {
  const [form, setForm] = useState({
    name: login.name || "",
    email: login.email || "",
    accessRole: login.accessRole || "employee",
    status: login.status || "Active"
  });

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitEdit = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast("Enter login name and email.", "error");
      return;
    }

    onSave({
      ...login,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      accessRole: form.accessRole,
      status: form.status || "Active"
    });
  };

  return (
    <div className="receipt-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="receipt-modal login-edit-modal" role="dialog" aria-modal="true" aria-label="Edit login access" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>Edit Login Access</h2>
            <p>{login.email}</p>
          </div>
          <button type="button" className="icon-action" aria-label="Close login edit" title="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </header>
        <form className="form-grid employee-edit-form" onSubmit={submitEdit}>
          <label>Name<input value={form.name} onChange={(event) => updateField("name", event.target.value)} /></label>
          <label>Email<input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} /></label>
          <label>Dashboard Access<select value={form.accessRole} onChange={(event) => updateField("accessRole", event.target.value)}><option value="employee">Employee</option><option value="localSeller">Local Seller</option><option value="hr">HR / Accountant</option><option value="admin">Admin</option></select></label>
          <label>Status<select value={form.status} onChange={(event) => updateField("status", event.target.value)}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label>
          <div className="modal-form-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button">Save Login</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AddEmployeePanel({ commit }) {
  const blankEmployee = {
    name: "",
    email: "",
    accessRole: "employee",
    department: "",
    role: "",
    salary: "",
    joinedAt: "",
    birthday: "",
    bloodGroup: "",
    address: "",
    mobile: "",
    alternativeNumber: "",
    aadhaar: "",
    pan: "",
    uan: "",
    experience: "",
    qualification: "",
    college: "",
    aadhaarDocument: null
  };
  const [employee, setEmployee] = useState(blankEmployee);

  const handleDocumentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const document = await readEmployeeDocument(file);
      setEmployee((current) => ({ ...current, aadhaarDocument: document }));
    } catch (error) {
      toast(error.message, "error");
      event.target.value = "";
    }
  };

  const addEmployee = (event) => {
    event.preventDefault();
    if (!employee.name.trim() || !employee.email.trim()) {
      toast("Enter employee name and email.", "error");
      return;
    }
    const nextEmployee = {
      id: uid("EMP"),
      name: employee.name.trim(),
      email: employee.email.trim().toLowerCase(),
      accessRole: employee.accessRole,
      department: employee.department || "General",
      role: employee.role || "Employee",
      salary: Number(employee.salary || 0),
      joinedAt: employee.joinedAt,
      birthday: employee.birthday,
      bloodGroup: employee.bloodGroup,
      address: employee.address.trim(),
      mobile: employee.mobile.trim(),
      alternativeNumber: employee.alternativeNumber.trim(),
      aadhaar: employee.aadhaar.trim(),
      pan: employee.pan.trim(),
      uan: employee.uan.trim(),
      experience: employee.experience.trim(),
      qualification: employee.qualification.trim(),
      college: employee.college.trim(),
      aadhaarDocument: employee.aadhaarDocument,
      status: "Active"
    };
    commit((current) => ({
      ...current,
      employees: [
        nextEmployee,
        ...(current.employees || [])
      ],
      logins: [
        {
          id: uid("LOGIN"),
          name: nextEmployee.name,
          email: nextEmployee.email,
          accessRole: nextEmployee.accessRole,
          employeeId: nextEmployee.id,
          status: "Active"
        },
        ...(current.logins || []).filter((login) => login.email?.toLowerCase() !== nextEmployee.email)
      ]
    }));
    toast("Employee added to directory.");
    setEmployee(blankEmployee);
  };

  return (
    <Panel title="Add Employee" className="full-row-panel">
      <form className="form-grid employee-form-grid" onSubmit={addEmployee}>
        <input placeholder="Employee name" value={employee.name} onChange={(event) => setEmployee({ ...employee, name: event.target.value })} />
        <input placeholder="Email" value={employee.email} onChange={(event) => setEmployee({ ...employee, email: event.target.value })} />
        <select value={employee.accessRole} onChange={(event) => setEmployee({ ...employee, accessRole: event.target.value })}>
          <option value="admin">Admin dashboard</option>
          <option value="hr">HR / Accountant dashboard</option>
          <option value="employee">Employee dashboard</option>
          <option value="localSeller">Local Seller dashboard</option>
        </select>
        <input placeholder="Department" value={employee.department} onChange={(event) => setEmployee({ ...employee, department: event.target.value })} />
        <input placeholder="Role" value={employee.role} onChange={(event) => setEmployee({ ...employee, role: event.target.value })} />
        <input type="number" placeholder="Salary" value={employee.salary} onChange={(event) => setEmployee({ ...employee, salary: event.target.value })} />
        <label>Date of joining<input type="date" value={dateInputValue(employee.joinedAt)} onChange={(event) => setEmployee({ ...employee, joinedAt: event.target.value })} /></label>
        <label>Birthday<input type="date" value={dateInputValue(employee.birthday)} onChange={(event) => setEmployee({ ...employee, birthday: event.target.value })} /></label>
        <select value={employee.bloodGroup} onChange={(event) => setEmployee({ ...employee, bloodGroup: event.target.value })}>
          <option value="">Blood group</option>
          <option value="A+">A+</option>
          <option value="A-">A-</option>
          <option value="B+">B+</option>
          <option value="B-">B-</option>
          <option value="AB+">AB+</option>
          <option value="AB-">AB-</option>
          <option value="O+">O+</option>
          <option value="O-">O-</option>
        </select>
        <input placeholder="Mobile number" value={employee.mobile} onChange={(event) => setEmployee({ ...employee, mobile: event.target.value })} />
        <input placeholder="Alternative number" value={employee.alternativeNumber} onChange={(event) => setEmployee({ ...employee, alternativeNumber: event.target.value })} />
        <input placeholder="Aadhaar number" value={employee.aadhaar} onChange={(event) => setEmployee({ ...employee, aadhaar: event.target.value })} />
        <input placeholder="PAN optional" value={employee.pan} onChange={(event) => setEmployee({ ...employee, pan: event.target.value })} />
        <input placeholder="UAN optional" value={employee.uan} onChange={(event) => setEmployee({ ...employee, uan: event.target.value })} />
        <input placeholder="Experience" value={employee.experience} onChange={(event) => setEmployee({ ...employee, experience: event.target.value })} />
        <input placeholder="Latest qualification" value={employee.qualification} onChange={(event) => setEmployee({ ...employee, qualification: event.target.value })} />
        <input placeholder="College" value={employee.college} onChange={(event) => setEmployee({ ...employee, college: event.target.value })} />
        <input className="wide-input" placeholder="Address" value={employee.address} onChange={(event) => setEmployee({ ...employee, address: event.target.value })} />
        <label className="receipt-field wide-input">Aadhaar card document<input type="file" accept="image/*,.pdf,application/pdf" onChange={handleDocumentUpload} /><small>{employee.aadhaarDocument ? employee.aadhaarDocument.name : "PDF or image, max 2 MB"}</small></label>
        <button className="primary-button employee-submit-button">Add Employee</button>
      </form>
    </Panel>
  );
}

function LedgerEntryPanel({ commit, className = "" }) {
  const [entry, setEntry] = useState({ type: "Credit", amount: "", account: "", category: "", note: "", date: "" });

  const addLedger = (event) => {
    event.preventDefault();
    if (!entry.amount || !entry.account.trim()) {
      toast("Enter amount and account before saving ledger.", "error");
      return;
    }
    commit((current) => ({
      ...current,
      ledger: [{ id: uid("TXN"), ...entry, amount: Number(entry.amount), createdBy: "HR" }, ...current.ledger]
    }));
    toast("Ledger entry saved.");
    setEntry({ type: "Credit", amount: "", account: "", category: "", note: "", date: "" });
  };

  return (
    <Panel title="Credit / Debit Entry" className={className}>
      <form className="form-grid" onSubmit={addLedger}>
        <select value={entry.type} onChange={(event) => setEntry({ ...entry, type: event.target.value })}><option>Credit</option><option>Debit</option></select>
        <input type="number" placeholder="Amount" value={entry.amount} onChange={(event) => setEntry({ ...entry, amount: event.target.value })} />
        <input placeholder="Account" value={entry.account} onChange={(event) => setEntry({ ...entry, account: event.target.value })} />
        <input placeholder="Category" value={entry.category} onChange={(event) => setEntry({ ...entry, category: event.target.value })} />
        <input type="date" value={dateInputValue(entry.date)} onChange={(event) => setEntry({ ...entry, date: event.target.value })} />
        <input placeholder="Note" value={entry.note} onChange={(event) => setEntry({ ...entry, note: event.target.value })} />
        <button className="primary-button">Save to Ledger</button>
      </form>
    </Panel>
  );
}

function initialFinanceEntry() {
  return {
    employeeId: "company",
    buyerSupplierPincode: "",
    ledgerName: "",
    ledgerAmount: "",
    ledgerAmountDrCr: "Dr",
    itemName: "",
    billedQuantity: "",
    itemRate: "",
    itemRatePer: "",
    itemAmount: "",
    changeMode: "",
    narration: "",
    date: ""
  };
}

function AdminExpenseFormPanel({ store, commit, createdBy = "Admin", title = "Add Expense" }) {
  const [expense, setExpense] = useState(initialFinanceEntry);
  const [receipt, setReceipt] = useState(null);
  const [receiptError, setReceiptError] = useState("");

  const handleReceiptUpload = async (event) => {
    const file = event.target.files?.[0];
    setReceiptError("");
    if (!file) {
      setReceipt(null);
      return;
    }
    const allowed = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!allowed) {
      setReceiptError("Upload an image or PDF receipt.");
      toast("Upload an image or PDF receipt.", "error");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setReceiptError("Receipt must be 2 MB or smaller for web storage.");
      toast("Receipt must be 2 MB or smaller.", "error");
      event.target.value = "";
      return;
    }
    try {
      setReceipt({ name: file.name, type: file.type, size: file.size, dataUrl: await fileToDataUrl(file) });
      toast("Receipt uploaded.");
    } catch {
      setReceiptError("Could not read this receipt. Please try another file.");
      toast("Could not read this receipt.", "error");
    }
  };

  const addExpense = (event) => {
    event.preventDefault();
    const calculatedItemAmount = Number(expense.itemAmount || 0) || (Number(expense.billedQuantity || 0) * Number(expense.itemRate || 0));
    const ledgerAmount = Number(expense.ledgerAmount || 0) || calculatedItemAmount;
    if (!expense.ledgerName.trim() || !ledgerAmount) {
      toast("Enter ledger name and ledger amount before adding.", "error");
      return;
    }
    const selectedEmployee = store.employees.find((employee) => employee.id === expense.employeeId);
    const itemAmount = calculatedItemAmount || ledgerAmount;
    const expenseRecord = {
        id: uid("EXP"),
        employeeId: selectedEmployee?.id || "ADMIN",
        employeeName: selectedEmployee?.name || `${createdBy} / Company`,
        category: expense.itemName || "Finance Entry",
        amount: ledgerAmount,
        date: expense.date,
        notes: expense.narration.trim(),
        receipt,
        status: "Approved",
        submittedAt: today(),
        createdBy,
        buyerSupplierPincode: expense.buyerSupplierPincode.trim(),
        ledgerName: expense.ledgerName.trim(),
        ledgerAmount,
        ledgerAmountDrCr: expense.ledgerAmountDrCr,
        itemName: expense.itemName.trim(),
        billedQuantity: expense.billedQuantity,
        itemRate: expense.itemRate,
        itemRatePer: expense.itemRatePer.trim(),
        itemAmount,
        changeMode: expense.changeMode.trim(),
        narration: expense.narration.trim()
    };
    const ledgerRecord = ledgerEntryFromExpense(expenseRecord, createdBy);
    commit((current) => ({
      ...current,
      expenses: [expenseRecord, ...current.expenses],
      ledger: [ledgerRecord, ...(current.ledger || [])]
    }));
    toast("Debit expense added to finance and ledger.");
    setExpense(initialFinanceEntry());
    setReceipt(null);
    setReceiptError("");
    event.currentTarget.reset();
  };

  return (
    <Panel title={title} className="full-row-panel">
      <form className="form-grid admin-expense-form" onSubmit={addExpense}>
        <select value={expense.employeeId} onChange={(event) => setExpense({ ...expense, employeeId: event.target.value })}>
          <option value="company">Admin / Company Expense</option>
          {store.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
        </select>
        <input placeholder="Buyer/Supplier - Pincode" value={expense.buyerSupplierPincode} onChange={(event) => setExpense({ ...expense, buyerSupplierPincode: event.target.value })} />
        <input placeholder="Ledger Name" value={expense.ledgerName} onChange={(event) => setExpense({ ...expense, ledgerName: event.target.value })} />
        <input type="number" placeholder="Ledger Amount" value={expense.ledgerAmount} onChange={(event) => setExpense({ ...expense, ledgerAmount: event.target.value })} />
        <select value={expense.ledgerAmountDrCr} onChange={(event) => setExpense({ ...expense, ledgerAmountDrCr: event.target.value })}>
          <option>Dr</option>
          <option>Cr</option>
        </select>
        <input placeholder="Item Name" value={expense.itemName} onChange={(event) => setExpense({ ...expense, itemName: event.target.value })} />
        <input type="number" placeholder="Billed Quantity" value={expense.billedQuantity} onChange={(event) => setExpense({ ...expense, billedQuantity: event.target.value })} />
        <input type="number" placeholder="Item Rate" value={expense.itemRate} onChange={(event) => setExpense({ ...expense, itemRate: event.target.value })} />
        <input placeholder="Item Rate per" value={expense.itemRatePer} onChange={(event) => setExpense({ ...expense, itemRatePer: event.target.value })} />
        <input type="number" placeholder="Item Amount" value={expense.itemAmount} onChange={(event) => setExpense({ ...expense, itemAmount: event.target.value })} />
        <input placeholder="Change Mode" value={expense.changeMode} onChange={(event) => setExpense({ ...expense, changeMode: event.target.value })} />
        <input type="date" value={dateInputValue(expense.date)} onChange={(event) => setExpense({ ...expense, date: event.target.value })} />
        <input className="wide-input" placeholder="Narration" value={expense.narration} onChange={(event) => setExpense({ ...expense, narration: event.target.value })} />
        <label className="receipt-field">
          <span>Receipt</span>
          <input type="file" accept="image/*,.pdf,application/pdf" onChange={handleReceiptUpload} />
          <small>{receipt ? receipt.name : "Image or PDF, max 2 MB"}</small>
          {receiptError && <em>{receiptError}</em>}
        </label>
        <button className="primary-button compact-submit-button">Add Expense</button>
      </form>
    </Panel>
  );
}

function EmployeeAttendancePanel({ store, commit, currentEmployee }) {
  const [savingAttendance, setSavingAttendance] = useState(false);
  const employeeAttendance = store.attendance
    .map((record) => normalizeAttendanceEmployee(record, store.employees))
    .filter((item) => item.employeeId === currentEmployee.id);
  const activeAttendance = employeeAttendance.find((item) => item.date === today() && item.status !== "Checked Out" && !item.checkOut);
  const checkInDisabled = Boolean(activeAttendance);
  const checkOutDisabled = !activeAttendance;

  const markAttendance = async (status) => {
    if (checkInDisabled || savingAttendance) return;
    setSavingAttendance(true);
    try {
      const checkInLocation = status === "Checked In" ? await verifyCheckInLocation() : null;
      const record = {
        id: uid("ATT"),
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.name,
        userEmail: currentEmployee.email,
        date: today(),
        status,
        checkIn: new Date().toTimeString().slice(0, 5),
        checkOut: "",
        checkInLocation
      };
      const saved = await commit((current) => {
        const attendance = (current.attendance || []).filter((item) => item.id !== record.id);
        attendance.unshift(record);
        return { ...current, attendance };
      }, record);
      if (saved !== false) toast(status === "Work From Home" ? "Work from home marked." : "Check-in marked.");
    } catch (error) {
      toast(error.message || "Could not verify your check-in location.", "error");
    } finally {
      setSavingAttendance(false);
    }
  };

  const checkoutAttendance = async () => {
    if (checkOutDisabled || savingAttendance) return;
    const now = new Date().toTimeString().slice(0, 5);
    const updatedRecord = {
      ...activeAttendance,
      employeeId: currentEmployee.id,
      employeeName: currentEmployee.name,
      userEmail: currentEmployee.email,
      status: "Checked Out",
      checkOut: now
    };
    setSavingAttendance(true);
    try {
      const saved = await commit((current) => {
        const existingIndex = (current.attendance || []).findIndex((item) => item.id === activeAttendance.id);
        if (existingIndex < 0) return current;
        const attendance = [...current.attendance];
        attendance[existingIndex] = updatedRecord;
        return { ...current, attendance };
      }, updatedRecord);
      if (saved !== false) toast("Check-out marked.");
    } finally {
      setSavingAttendance(false);
    }
  };

  return (
    <Panel title="Today Attendance">
      <div className="attendance-actions">
        <button className="primary-button" onClick={() => markAttendance("Checked In")} disabled={checkInDisabled || savingAttendance}>Check In</button>
        <button className="secondary-button" onClick={() => markAttendance("Work From Home")} disabled={checkInDisabled || savingAttendance}>Work From Home</button>
        <button className="secondary-button checkout-button" onClick={checkoutAttendance} disabled={checkOutDisabled || savingAttendance}>Check Out</button>
      </div>
      <DataTable rows={employeeAttendance} columns={["date", "status", "checkIn", "checkOut"]} className="today-attendance-records" />
    </Panel>
  );
}

function LeaveFormPanel({ commit, currentEmployee }) {
  const [leave, setLeave] = useState({ type: "Casual Leave", duration: "Full Day Leave", from: "", to: "", reason: "" });

  const applyLeave = (event) => {
    event.preventDefault();
    if (!leave.reason.trim()) {
      toast("Enter a leave reason before applying.", "error");
      return;
    }
    commit((current) => ({
      ...current,
      leaves: [{ id: uid("LV"), employeeId: currentEmployee.id, employeeName: currentEmployee.name, ...leave, status: "Pending", appliedAt: today() }, ...current.leaves]
    }));
    toast("Leave application submitted.");
    setLeave({ type: "Casual Leave", duration: "Full Day Leave", from: "", to: "", reason: "" });
  };

  return (
    <Panel title="Apply Leave" className="full-row-panel">
      <form className="form-grid" onSubmit={applyLeave}>
        <select value={leave.type} onChange={(event) => setLeave({ ...leave, type: event.target.value })}><option>Casual Leave</option><option>Sick Leave</option><option>Earned Leave</option></select>
        <select value={leave.duration} onChange={(event) => setLeave({ ...leave, duration: event.target.value })}><option>Full Day Leave</option><option>Half Day Leave</option></select>
        <input type="date" value={dateInputValue(leave.from)} onChange={(event) => setLeave({ ...leave, from: event.target.value })} />
        <input type="date" value={dateInputValue(leave.to)} onChange={(event) => setLeave({ ...leave, to: event.target.value })} />
        <input placeholder="Reason" value={leave.reason} onChange={(event) => setLeave({ ...leave, reason: event.target.value })} />
        <button className="primary-button">Apply Leave</button>
      </form>
    </Panel>
  );
}

function ExpenseFormPanel({ commit, currentEmployee }) {
  const [expense, setExpense] = useState({ category: "Uber", amount: "", date: "", notes: "" });
  const [receipt, setReceipt] = useState(null);
  const [receiptError, setReceiptError] = useState("");

  const handleReceipt = async (event) => {
    const file = event.target.files?.[0];
    setReceipt(null);
    setReceiptError("");
    if (!file) return;
    const allowed = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!allowed) {
      setReceiptError("Upload an image or PDF receipt.");
      toast("Upload an image or PDF receipt.", "error");
      event.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setReceiptError("Receipt must be 2 MB or smaller for web storage.");
      toast("Receipt must be 2 MB or smaller.", "error");
      event.target.value = "";
      return;
    }
    try {
      setReceipt({ name: file.name, type: file.type, size: file.size, dataUrl: await fileToDataUrl(file) });
      toast("Receipt uploaded.");
    } catch {
      setReceiptError("Could not read this receipt. Please try another file.");
      toast("Could not read this receipt.", "error");
    }
  };

  const submitExpense = (event) => {
    event.preventDefault();
    if (!expense.amount || !receipt) {
      if (!receipt) setReceiptError("Add the receipt before submitting the expense.");
      toast(!expense.amount ? "Enter expense amount before submitting." : "Add the receipt before submitting.", "error");
      return;
    }
    commit((current) => ({
      ...current,
      expenses: [{ id: uid("EXP"), employeeId: currentEmployee.id, employeeName: currentEmployee.name, ...expense, amount: Number(expense.amount), receipt, status: "Pending", submittedAt: today() }, ...current.expenses]
    }));
    toast("Expense submitted for approval.");
    setExpense({ category: "Uber", amount: "", date: "", notes: "" });
    setReceipt(null);
    setReceiptError("");
    event.currentTarget.reset();
  };

  return (
    <Panel title="Add Expense" className="full-row-panel">
      <form className="form-grid expense-entry-form" onSubmit={submitExpense}>
        <select value={expense.category} onChange={(event) => setExpense({ ...expense, category: event.target.value })}>
          <option>Uber</option><option>Travel</option><option>Food</option><option>Hotel</option><option>Internet</option><option>Other</option>
        </select>
        <input type="number" placeholder="Amount" value={expense.amount} onChange={(event) => setExpense({ ...expense, amount: event.target.value })} />
        <input type="date" value={dateInputValue(expense.date)} onChange={(event) => setExpense({ ...expense, date: event.target.value })} />
        <input placeholder="Notes" value={expense.notes} onChange={(event) => setExpense({ ...expense, notes: event.target.value })} />
        <label className="receipt-field">
          <span>Receipt</span>
          <input type="file" accept="image/*,.pdf,application/pdf" onChange={handleReceipt} />
          <small>{receipt ? receipt.name : "Image or PDF, max 2 MB"}</small>
          {receiptError && <em>{receiptError}</em>}
        </label>
        <button className="primary-button expense-submit-button">Submit Expense</button>
      </form>
    </Panel>
  );
}

function DashboardGrid({ children }) {
  return <section className="dashboard-grid">{children}</section>;
}

function Panel({ title, children, className = "" }) {
  return (
    <section className={`panel ${className}`.trim()}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

const employeeColumns = ["id", "name", "email", "accessRole", "department", "role", "salary", "joinedAt", "birthday", "bloodGroup", "mobile", "alternativeNumber", "aadhaar", "pan", "uan", "experience", "qualification", "college", "address", "status"];

function EmployeeTable({ employees, commit, canDelete = false, className = "" }) {
  const [editingEmployee, setEditingEmployee] = useState(null);

  const deleteEmployee = (employeeId) => {
    if (!canDelete || !commit) return;
    const employeeToDelete = employees.find((employee) => employee.id === employeeId);
    const employeeEmail = employeeToDelete?.email?.toLowerCase();
    commit((current) => ({
      ...current,
      employees: current.employees.filter((employee) => employee.id !== employeeId),
      leaves: current.leaves.filter((leave) => leave.employeeId !== employeeId),
      expenses: current.expenses.filter((expense) => expense.employeeId !== employeeId),
      attendance: current.attendance.filter((record) => record.employeeId !== employeeId),
      logins: (current.logins || []).filter((login) => login.employeeId !== employeeId && login.email?.toLowerCase() !== employeeEmail)
    }));
    toast("Employee deleted.");
  };

  const updateEmployee = (updatedEmployee) => {
    if (!canDelete || !commit || !editingEmployee) return;
    const previousId = editingEmployee.id;
    const nextId = updatedEmployee.id;
    const previousEmail = editingEmployee.email?.toLowerCase();
    const nextEmail = updatedEmployee.email?.toLowerCase();
    if (employees.some((employee) => employee.id !== previousId && String(employee.id) === String(nextId))) {
      toast("Another employee already uses this ID.", "error");
      return;
    }

    commit((current) => {
      const existingLogin = (current.logins || []).find((login) => (
        login.employeeId === previousId ||
        login.employeeId === nextId ||
        login.email?.toLowerCase() === previousEmail ||
        login.email?.toLowerCase() === nextEmail
      ));

      const syncedLogin = {
        id: existingLogin?.id || uid("LOGIN"),
        name: updatedEmployee.name,
        email: updatedEmployee.email,
        accessRole: updatedEmployee.accessRole,
        employeeId: updatedEmployee.id,
        status: updatedEmployee.status || existingLogin?.status || "Active"
      };

      return {
        ...current,
        employees: (current.employees || []).map((employee) => (
          employee.id === previousId ? updatedEmployee : employee
        )),
        leaves: (current.leaves || []).map((leave) => (
          leave.employeeId === previousId ? { ...leave, employeeId: nextId, employeeName: updatedEmployee.name } : leave
        )),
        expenses: (current.expenses || []).map((expense) => (
          expense.employeeId === previousId ? { ...expense, employeeId: nextId, employeeName: updatedEmployee.name } : expense
        )),
        attendance: (current.attendance || []).map((record) => (
          record.employeeId === previousId ? { ...record, employeeId: nextId, employeeName: updatedEmployee.name } : record
        )),
        logins: [
          syncedLogin,
          ...(current.logins || []).filter((login) => (
            login.id !== existingLogin?.id &&
            login.employeeId !== previousId &&
            login.employeeId !== updatedEmployee.id &&
            login.email?.toLowerCase() !== previousEmail &&
            login.email?.toLowerCase() !== nextEmail
          ))
        ]
      };
    });

    setEditingEmployee(null);
    toast("Employee profile updated.");
  };

  if (!canDelete) {
    return (
      <Panel title="Employee Directory" className={className}>
        <DataTable rows={employees} columns={employeeColumns} className="employee-records" />
      </Panel>
    );
  }

  return (
    <Panel title="Employee Directory" className={className}>
      {employees.length ? (
        <div className="data-table employee-records">
          <div className="data-head">
            <span>id</span>
            <span>name</span>
            <span>email</span>
            <span>login</span>
            <span>department</span>
            <span>role</span>
            <span>salary</span>
            <span>joining</span>
            <span>birthday</span>
            <span>blood group</span>
            <span>mobile</span>
            <span>alt number</span>
            <span>Aadhaar</span>
            <span>PAN</span>
            <span>UAN</span>
            <span>experience</span>
            <span>qualification</span>
            <span>college</span>
            <span>address</span>
            <span>status</span>
            <span>Aadhaar card</span>
            <span>action</span>
          </div>
          {employees.map((employee) => (
            <div className="data-row" key={employee.id}>
              <span>{employee.id}</span>
              <span>{employee.name}</span>
              <span>{employee.email}</span>
              <span>{roles[employee.accessRole]?.title || "Employee"}</span>
              <span>{employee.department}</span>
              <span>{employee.role}</span>
              <span>{money(employee.salary)}</span>
              <span>{employee.joinedAt || "--"}</span>
              <span>{employee.birthday || "--"}</span>
              <span>{employee.bloodGroup || "--"}</span>
              <span>{employee.mobile || "--"}</span>
              <span>{employee.alternativeNumber || "--"}</span>
              <span>{employee.aadhaar || "--"}</span>
              <span>{employee.pan || "--"}</span>
              <span>{employee.uan || "--"}</span>
              <span>{employee.experience || "--"}</span>
              <span>{employee.qualification || "--"}</span>
              <span>{employee.college || "--"}</span>
              <span>{employee.address || "--"}</span>
              <span>{employee.status}</span>
              <span><EmployeeDocumentLinks document={employee.aadhaarDocument} /></span>
              <span className="employee-action-buttons">
                <button className="icon-action" type="button" aria-label={`Edit ${employee.name}`} title="Edit employee" onClick={() => setEditingEmployee(employee)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                <button className="icon-action danger" type="button" aria-label={`Delete ${employee.name}`} title="Delete employee" onClick={() => deleteEmployee(employee.id)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16" />
                    <path d="M9 7V5h6v2" />
                    <path d="M6 7l1 14h10l1-14" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : <p className="empty-note">No employees yet.</p>}
      {editingEmployee ? (
        <EmployeeEditModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSave={updateEmployee}
        />
      ) : null}
    </Panel>
  );
}

function EmployeeEditModal({ employee, onClose, onSave }) {
  const [form, setForm] = useState({
    id: employee.id || "",
    name: employee.name || "",
    email: employee.email || "",
    accessRole: employee.accessRole || "employee",
    department: employee.department || "",
    role: employee.role || "",
    salary: employee.salary ?? "",
    joinedAt: employee.joinedAt || "",
    birthday: employee.birthday || "",
    bloodGroup: employee.bloodGroup || "",
    mobile: employee.mobile || "",
    alternativeNumber: employee.alternativeNumber || "",
    aadhaar: employee.aadhaar || "",
    pan: employee.pan || "",
    uan: employee.uan || "",
    experience: employee.experience || "",
    qualification: employee.qualification || "",
    college: employee.college || "",
    address: employee.address || "",
    aadhaarDocument: employee.aadhaarDocument || null,
    status: employee.status || "Active"
  });

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleDocumentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const document = await readEmployeeDocument(file);
      updateField("aadhaarDocument", document);
    } catch (error) {
      toast(error.message, "error");
      event.target.value = "";
    }
  };

  const submitEdit = (event) => {
    event.preventDefault();
    if (!String(form.id).trim() || !form.name.trim() || !form.email.trim()) {
      toast("Enter employee ID, name, and email.", "error");
      return;
    }

    onSave({
      ...employee,
      id: String(form.id).trim(),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      accessRole: form.accessRole,
      department: form.department.trim() || "General",
      role: form.role.trim() || "Employee",
      salary: Number(form.salary || 0),
      joinedAt: form.joinedAt.trim(),
      birthday: form.birthday.trim(),
      bloodGroup: form.bloodGroup,
      mobile: form.mobile.trim(),
      alternativeNumber: form.alternativeNumber.trim(),
      aadhaar: form.aadhaar.trim(),
      pan: form.pan.trim(),
      uan: form.uan.trim(),
      experience: form.experience.trim(),
      qualification: form.qualification.trim(),
      college: form.college.trim(),
      address: form.address.trim(),
      aadhaarDocument: form.aadhaarDocument,
      status: form.status || "Active"
    });
  };

  return (
    <div className="receipt-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="receipt-modal employee-edit-modal" role="dialog" aria-modal="true" aria-label="Edit employee profile" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>Edit Employee Profile</h2>
            <p>{employee.email}</p>
          </div>
          <button type="button" className="icon-action" aria-label="Close employee editor" title="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </header>
        <form className="form-grid employee-form-grid employee-edit-form" onSubmit={submitEdit}>
          <label>Employee ID<input value={form.id} onChange={(event) => updateField("id", event.target.value)} /></label>
          <label>Name<input value={form.name} onChange={(event) => updateField("name", event.target.value)} /></label>
          <label>Email<input type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} /></label>
          <label>Dashboard Access<select value={form.accessRole} onChange={(event) => updateField("accessRole", event.target.value)}><option value="employee">Employee</option><option value="localSeller">Local Seller</option><option value="hr">HR / Accountant</option><option value="admin">Admin</option></select></label>
          <label>Department<input value={form.department} onChange={(event) => updateField("department", event.target.value)} /></label>
          <label>Role<input value={form.role} onChange={(event) => updateField("role", event.target.value)} /></label>
          <label>Salary<input type="number" min="0" value={form.salary} onChange={(event) => updateField("salary", event.target.value)} /></label>
          <label>Date of Joining<input type="date" value={dateInputValue(form.joinedAt)} onChange={(event) => updateField("joinedAt", event.target.value)} /></label>
          <label>Birthday<input type="date" value={dateInputValue(form.birthday)} onChange={(event) => updateField("birthday", event.target.value)} /></label>
          <label>Blood Group<select value={form.bloodGroup} onChange={(event) => updateField("bloodGroup", event.target.value)}><option value="">Select blood group</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="AB+">AB+</option><option value="AB-">AB-</option><option value="O+">O+</option><option value="O-">O-</option></select></label>
          <label>Mobile<input value={form.mobile} onChange={(event) => updateField("mobile", event.target.value)} /></label>
          <label>Alternative Number<input value={form.alternativeNumber} onChange={(event) => updateField("alternativeNumber", event.target.value)} /></label>
          <label>Aadhaar Number<input value={form.aadhaar} onChange={(event) => updateField("aadhaar", event.target.value)} /></label>
          <label>PAN<input value={form.pan} onChange={(event) => updateField("pan", event.target.value)} /></label>
          <label>UAN<input value={form.uan} onChange={(event) => updateField("uan", event.target.value)} /></label>
          <label>Experience<input value={form.experience} onChange={(event) => updateField("experience", event.target.value)} /></label>
          <label>Qualification<input value={form.qualification} onChange={(event) => updateField("qualification", event.target.value)} /></label>
          <label>College<input value={form.college} onChange={(event) => updateField("college", event.target.value)} /></label>
          <label>Status<select value={form.status} onChange={(event) => updateField("status", event.target.value)}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label>
          <label className="wide-input">Address<textarea value={form.address} onChange={(event) => updateField("address", event.target.value)} /></label>
          <label className="receipt-field wide-input">Aadhaar card document<input type="file" accept="image/*,.pdf,application/pdf" onChange={handleDocumentUpload} /><small>{form.aadhaarDocument ? form.aadhaarDocument.name : "PDF or image, max 2 MB"}</small></label>
          <div className="modal-form-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button">Save Profile</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function LedgerTable({ store, className = "" }) {
  const debitLedger = (store.ledger || []).filter((item) => String(item.type || "Debit").toLowerCase() === "debit");
  return (
    <Panel title="Debit Ledger Records" className={className}>
      <DataTable rows={debitLedger} columns={financeRegisterColumns} />
    </Panel>
  );
}

function LeaveTable({ leaves, title = "Leave Records" }) {
  return (
    <Panel title={title}>
      <DataTable rows={leaves} columns={["id", "employeeName", "type", "duration", "from", "to", "reason", "status"]} />
    </Panel>
  );
}

function ExpenseTable({ expenses, title = "Expense Records", className = "" }) {
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const filteredExpenses = expenses.filter((expense) => (
    isSameRecordMonth(expense.date || expense.submittedAt, selectedMonth) &&
    isSameRecordDate(expense.date || expense.submittedAt, selectedDate)
  ));

  if (!expenses.length) {
    return (
      <Panel title={title} className={className}>
        <p className="empty-note">No records yet.</p>
      </Panel>
    );
  }

  return (
    <Panel title={title} className={className}>
      <div className="table-filter-bar">
        <label>Month<input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label>
        <label>Date<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        <button type="button" className="secondary-button" onClick={() => { setSelectedMonth(""); setSelectedDate(""); }}>Clear</button>
      </div>
      {filteredExpenses.length ? (
        <div className="data-table expense-records">
          <div className="data-head">
            <span>id</span>
            <span>employee</span>
            <span>category</span>
            <span>date</span>
            <span>amount</span>
            <span>notes</span>
            <span>receipt</span>
            <span>status</span>
          </div>
          {filteredExpenses.map((expense) => (
            <div className="data-row" key={expense.id}>
              <span>{expense.id}</span>
              <span>{expense.employeeName}</span>
              <span>{expense.category}</span>
              <span>{expense.date || expense.submittedAt || "--"}</span>
              <span>{money(expense.amount)}</span>
              <span>{expense.notes || "--"}</span>
              <span>{expense.receipt ? <button type="button" className="table-action" onClick={() => setReceiptPreview(expense.receipt)}>View Receipt</button> : "--"}</span>
              <span><Status status={expense.status} /></span>
            </div>
          ))}
        </div>
      ) : <p className="empty-note">No records match the selected date filters.</p>}
      {receiptPreview && (
        <ReceiptPreviewModal receipt={receiptPreview} onClose={() => setReceiptPreview(null)} />
      )}
    </Panel>
  );
}

function ReceiptPreviewModal({ receipt, onClose }) {
  const isPdf = receipt.type === "application/pdf" || receipt.name?.toLowerCase().endsWith(".pdf");

  return (
    <div className="receipt-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="receipt-modal" role="dialog" aria-modal="true" aria-label="Receipt preview" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>Receipt Preview</h2>
            <p>{receipt.name || "Uploaded receipt"}</p>
          </div>
          <button type="button" className="icon-action" aria-label="Close receipt preview" title="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="receipt-preview-frame">
          {!receipt.dataUrl ? (
            <p className="empty-note">Receipt data is unavailable for this record.</p>
          ) : isPdf ? (
            <iframe title={receipt.name || "Receipt PDF"} src={receipt.dataUrl} />
          ) : (
            <img src={receipt.dataUrl} alt={receipt.name || "Receipt"} />
          )}
        </div>
        {receipt.dataUrl && (
          <a className="secondary-button receipt-download-link" href={receipt.dataUrl} download={receipt.name || "receipt"}>
            Download Receipt
          </a>
        )}
      </section>
    </div>
  );
}

function AttendanceTable({ attendance, employees = [], title = "Attendance Records", className = "", canEdit = false, onSaveAttendance, onDeleteAttendance }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [editingAttendance, setEditingAttendance] = useState(null);
  const normalizedAttendance = attendance.map((record) => normalizeAttendanceEmployee(record, employees));
  const employeeNames = [...new Set([
    ...employees.map((employee) => employee.name).filter(Boolean),
    ...normalizedAttendance.map((record) => record.employeeName).filter(Boolean)
  ])].sort((a, b) => a.localeCompare(b));
  const filteredAttendance = normalizedAttendance.filter((record) => (
    (!fromDate && !toDate ? true : isWithinDateRange(record.date, fromDate, toDate))
    && (!employeeName || record.employeeName === employeeName)
  ));
  const attendanceRows = filteredAttendance;
  const weeklyRows = buildAttendanceReportRows(attendanceRows, "weekly");
  const monthlyRows = buildAttendanceReportRows(attendanceRows, "monthly");

  const saveAttendanceEdit = async (updatedRecord) => {
    if (!onSaveAttendance) return;
    const normalizedRecord = normalizeAttendanceEmployee(updatedRecord, employees);
    const saved = await onSaveAttendance((current) => ({
      ...current,
      attendance: (current.attendance || []).map((record) => (
        record.id === normalizedRecord.id ? normalizedRecord : record
      ))
    }), normalizedRecord);
    if (saved !== false) {
      setEditingAttendance(null);
      toast("Attendance updated.");
    }
  };

  const deleteAttendanceRecord = async (record) => {
    if (!onDeleteAttendance || !record?.id) return;
    const confirmed = window.confirm(`Delete attendance record for ${record.employeeName || "this employee"} on ${record.date || "this date"}?`);
    if (!confirmed) return;
    await onDeleteAttendance(record.id);
  };

  return (
    <Panel title={title} className={className}>
      <div className="table-filter-bar">
        <label>Name<select value={employeeName} onChange={(event) => setEmployeeName(event.target.value)}>
          <option value="">All employees</option>
          {employeeNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <label>From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <button type="button" className="secondary-button" onClick={() => { setEmployeeName(""); setFromDate(""); setToDate(""); }}>Clear</button>
      </div>
      <div className="attendance-report-grid">
        <div className="attendance-report-card">
          <h3>Weekly Report</h3>
          <DataTable rows={weeklyRows} columns={["employeeName", "period", "records", "checkedIn", "checkedOut", "workFromHome"]} />
        </div>
        <div className="attendance-report-card">
          <h3>Monthly Report</h3>
          <DataTable rows={monthlyRows} columns={["employeeName", "period", "records", "checkedIn", "checkedOut", "workFromHome"]} />
        </div>
      </div>
      {canEdit ? (
        <div className="data-table attendance-records editable-attendance-records">
          <div className="data-head">
            <span>EmployeeId</span>
            <span>EmployeeName</span>
            <span>Date</span>
            <span>Status</span>
            <span>CheckIn</span>
            <span>CheckOut</span>
            <span>Action</span>
          </div>
          {attendanceRows.length ? attendanceRows.map((record, index) => (
            <div className="data-row" key={record.id || index}>
              <span>{record.employeeId || "--"}</span>
              <span>{record.employeeName || "--"}</span>
              <span>{record.date || "--"}</span>
              <span>{record.status || "--"}</span>
              <span>{record.checkIn || "--"}</span>
              <span>{record.checkOut || "--"}</span>
              <span className="employee-action-buttons">
                <button className="icon-action" type="button" aria-label={`Edit attendance for ${record.employeeName}`} title="Edit attendance" onClick={() => setEditingAttendance(record)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                <button className="icon-action danger" type="button" aria-label={`Delete attendance for ${record.employeeName}`} title="Delete attendance" onClick={() => deleteAttendanceRecord(record)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v5" />
                    <path d="M14 11v5" />
                  </svg>
                </button>
              </span>
            </div>
          )) : <p className="empty-note">No records yet.</p>}
        </div>
      ) : (
        <DataTable rows={attendanceRows} columns={["employeeId", "employeeName", "date", "status", "checkIn", "checkOut"]} className="attendance-records" />
      )}
      {editingAttendance ? (
        <AttendanceEditModal
          record={editingAttendance}
          employees={employees}
          onClose={() => setEditingAttendance(null)}
          onSave={saveAttendanceEdit}
        />
      ) : null}
    </Panel>
  );
}

function AttendanceEditModal({ record, employees, onClose, onSave }) {
  const [form, setForm] = useState({
    employeeId: record.employeeId || "",
    employeeName: record.employeeName || "",
    userEmail: record.userEmail || "",
    date: record.date || "",
    status: record.status || "Checked In",
    checkIn: record.checkIn || "",
    checkOut: record.checkOut || ""
  });

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectEmployee = (employeeId) => {
    const employee = employees.find((item) => item.id === employeeId);
    setForm((current) => ({
      ...current,
      employeeId,
      employeeName: employee?.name || current.employeeName,
      userEmail: employee?.email || current.userEmail
    }));
  };

  const submitEdit = (event) => {
    event.preventDefault();
    if (!String(form.employeeId).trim() || !form.employeeName.trim() || !form.date) {
      toast("Employee, name, and date are required.", "error");
      return;
    }

    onSave({
      ...record,
      employeeId: String(form.employeeId).trim(),
      employeeName: form.employeeName.trim(),
      userEmail: form.userEmail || record.userEmail || "",
      date: form.date,
      status: form.status,
      checkIn: form.checkIn.trim(),
      checkOut: form.checkOut.trim()
    });
  };

  return (
    <div className="receipt-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="receipt-modal login-edit-modal" role="dialog" aria-modal="true" aria-label="Edit attendance" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>Edit Attendance</h2>
            <p>{record.employeeName}</p>
          </div>
          <button type="button" className="icon-action" aria-label="Close attendance editor" title="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </header>
        <form className="form-grid employee-edit-form" onSubmit={submitEdit}>
          <label>Employee<select value={form.employeeId} onChange={(event) => selectEmployee(event.target.value)}>
            <option value={form.employeeId}>{form.employeeName || form.employeeId}</option>
            {employees
              .filter((employee) => employee.id !== form.employeeId)
              .map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
          </select></label>
          <label>Employee Name<input value={form.employeeName} onChange={(event) => updateField("employeeName", event.target.value)} /></label>
          <label>Date<input type="date" value={dateInputValue(form.date)} onChange={(event) => updateField("date", event.target.value)} /></label>
          <label>Status<select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
            <option value="Checked In">Checked In</option>
            <option value="Checked Out">Checked Out</option>
            <option value="Work From Home">Work From Home</option>
          </select></label>
          <label>Check In<input type="time" value={form.checkIn} onChange={(event) => updateField("checkIn", event.target.value)} /></label>
          <label>Check Out<input type="time" value={form.checkOut} onChange={(event) => updateField("checkOut", event.target.value)} /></label>
          <div className="modal-form-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button">Save Attendance</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function getWeekReportPeriod(date) {
  const start = new Date(date);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${dateInputValue(start)} to ${dateInputValue(end)}`;
}

function buildAttendanceReportRows(records, periodType) {
  const groups = new Map();

  for (const record of records) {
    const date = parseRecordDate(record.date);
    if (!date) continue;
    const period = periodType === "weekly"
      ? getWeekReportPeriod(date)
      : dateInputValue(date).slice(0, 7);
    const key = `${record.employeeName || "Unknown"}|${period}`;
    const current = groups.get(key) || {
      id: key,
      employeeName: record.employeeName || "Unknown",
      period,
      records: 0,
      checkedIn: 0,
      checkedOut: 0,
      workFromHome: 0
    };
    const status = String(record.status || "").toLowerCase();
    current.records += 1;
    if (status.includes("work from home")) current.workFromHome += 1;
    else if (status.includes("checked out")) current.checkedOut += 1;
    else current.checkedIn += 1;
    groups.set(key, current);
  }

  return [...groups.values()].sort((first, second) => (
    second.period.localeCompare(first.period) || first.employeeName.localeCompare(second.employeeName)
  ));
}

function getTotals(rows) {
  return rows.reduce((summary, item) => {
    if (item.source === "Expense" && item.status !== "Approved") return summary;
    summary[item.type.toLowerCase()] += Number(item.amount);
    return summary;
  }, { credit: 0, debit: 0 });
}

function FinancePanel({ store, commit, canManage = false, canExport = false, className = "" }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editingFinance, setEditingFinance] = useState(null);
  const financeRows = buildFinanceRows(store);
  const totals = getTotals(financeRows);
  const approvedExpenses = (store.expenses || []).filter((item) => item.status === "Approved").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingExpenses = (store.expenses || []).filter((item) => item.status === "Pending").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const adminHrExpenses = (store.expenses || []).filter((item) => item.status === "Approved" && item.createdBy !== "Employee").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const filteredFinanceRows = financeRows.filter((row) => (
    !fromDate && !toDate ? true : isWithinDateRange(row.date, fromDate, toDate)
  ));

  const downloadPeriodReport = (period) => {
    const periodFinanceRows = financeRows.filter((row) => isWithinPeriod(row.date, period));
    downloadFinanceRegisterExcel(`aimies-${period}-finance-register.xls`, periodFinanceRows);
  };

  const downloadRangeReport = () => {
    if (!fromDate && !toDate) {
      toast("Select From or To date before downloading selected days.", "error");
      return;
    }
    const rangeLabel = `${fromDate || "start"}-to-${toDate || "today"}`;
    downloadFinanceRegisterExcel(`aimies-finance-register-${rangeLabel}.xls`, filteredFinanceRows);
  };

  const deleteFinanceRecord = (row) => {
    const confirmed = window.confirm(`Delete finance record for ${row.ledgerName || row.itemName || row.date || "this entry"}?`);
    if (!confirmed) return;
    commit((current) => ({
      ...current,
      ledger: (current.ledger || []).filter((item) => item.id !== row.id),
      expenses: (current.expenses || []).filter((expense) => (
        row.sourceExpenseId ? expense.id !== row.sourceExpenseId : row.source === "Expense" ? expense.id !== row.id : true
      ))
    }));
    toast("Finance record deleted.");
  };

  const saveFinanceRecord = (updatedRow) => {
    const amount = Number(updatedRow.ledgerAmount || updatedRow.itemAmount || 0);
    commit((current) => ({
      ...current,
      ledger: (current.ledger || []).map((item) => (
        item.id === updatedRow.id ? {
          ...item,
          date: updatedRow.date,
          account: updatedRow.ledgerName,
          category: updatedRow.itemName,
          amount,
          note: updatedRow.narration,
          buyerSupplierPincode: updatedRow.buyerSupplierPincode,
          ledgerName: updatedRow.ledgerName,
          ledgerAmount: amount,
          ledgerAmountDrCr: updatedRow.ledgerAmountDrCr,
          itemName: updatedRow.itemName,
          billedQuantity: updatedRow.billedQuantity,
          itemRate: updatedRow.itemRate,
          itemRatePer: updatedRow.itemRatePer,
          itemAmount: Number(updatedRow.itemAmount || amount),
          changeMode: updatedRow.changeMode,
          narration: updatedRow.narration
        } : item
      )),
      expenses: (current.expenses || []).map((expense) => (
        expense.id === updatedRow.sourceExpenseId || (updatedRow.source === "Expense" && expense.id === updatedRow.id) ? {
          ...expense,
          date: updatedRow.date,
          category: updatedRow.itemName || expense.category,
          amount,
          notes: updatedRow.narration,
          buyerSupplierPincode: updatedRow.buyerSupplierPincode,
          ledgerName: updatedRow.ledgerName,
          ledgerAmount: amount,
          ledgerAmountDrCr: updatedRow.ledgerAmountDrCr,
          itemName: updatedRow.itemName,
          billedQuantity: updatedRow.billedQuantity,
          itemRate: updatedRow.itemRate,
          itemRatePer: updatedRow.itemRatePer,
          itemAmount: Number(updatedRow.itemAmount || amount),
          changeMode: updatedRow.changeMode,
          narration: updatedRow.narration
        } : expense
      ))
    }));
    setEditingFinance(null);
    toast("Finance record updated.");
  };

  return (
    <Panel title="Debit Finance Register" className={className}>
      <div className="finance-summary">
        <Metric label="Debit" value={money(totals.debit)} />
        <Metric label="Approved Expenses" value={money(approvedExpenses)} />
        <Metric label="Pending Expenses" value={money(pendingExpenses)} />
        <Metric label="Admin / HR Expenses" value={money(adminHrExpenses)} />
        <Metric label="Finance Rows" value={financeRows.length} />
      </div>
      <div className="finance-export-actions">
        <button className="secondary-button" onClick={() => downloadPeriodReport("weekly")}>Weekly Excel</button>
        <button className="secondary-button" onClick={() => downloadPeriodReport("monthly")}>Monthly Excel</button>
        <button className="secondary-button" onClick={() => downloadPeriodReport("yearly")}>Yearly Excel</button>
      </div>
      <div className="table-filter-bar finance-date-filter">
        <label>From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <button type="button" className="secondary-button" onClick={() => { setFromDate(""); setToDate(""); }}>Clear</button>
        <button type="button" className="secondary-button" onClick={downloadRangeReport}>Download Selected Days</button>
      </div>
      {canManage ? (
        <FinanceRegisterTable rows={filteredFinanceRows} onEdit={setEditingFinance} onDelete={deleteFinanceRecord} />
      ) : (
        <DataTable rows={filteredFinanceRows} columns={financeExportColumns} />
      )}
      {editingFinance ? (
        <FinanceEditModal record={editingFinance} onClose={() => setEditingFinance(null)} onSave={saveFinanceRecord} />
      ) : null}
    </Panel>
  );
}

function FinanceRegisterTable({ rows, onEdit, onDelete }) {
  const columns = [...financeExportColumns, { key: "action", label: "Action" }];
  if (!rows.length) return <p className="empty-note">No records yet.</p>;

  return (
    <div className="data-table finance-records">
      <div className="data-head" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(130px, 1fr))` }}>
        {columns.map((column) => <span key={columnKey(column)}>{columnLabel(column)}</span>)}
      </div>
      {rows.map((row, index) => (
        <div className="data-row" key={row.id || index} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(130px, 1fr))` }}>
          {financeExportColumns.map((column) => {
            const key = columnKey(column);
            const value = row[key];
            return <span key={key}>{isCurrencyColumn(column) ? (value === "" || value === null || value === undefined ? "--" : money(value)) : value || "--"}</span>;
          })}
          <span className="employee-action-buttons">
            <button className="icon-action" type="button" aria-label="Edit finance record" title="Edit finance record" onClick={() => onEdit(row)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
            <button className="icon-action danger" type="button" aria-label="Delete finance record" title="Delete finance record" onClick={() => onDelete(row)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v5" />
                <path d="M14 11v5" />
              </svg>
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

function FinanceEditModal({ record, onClose, onSave }) {
  const [form, setForm] = useState({
    ...record,
    date: record.date || "",
    buyerSupplierPincode: record.buyerSupplierPincode || "",
    ledgerName: record.ledgerName || "",
    ledgerAmount: record.ledgerAmount || "",
    ledgerAmountDrCr: record.ledgerAmountDrCr || "Dr",
    itemName: record.itemName || "",
    billedQuantity: record.billedQuantity || "",
    itemRate: record.itemRate || "",
    itemRatePer: record.itemRatePer || "",
    itemAmount: record.itemAmount || "",
    changeMode: record.changeMode || "",
    narration: record.narration || ""
  });

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitEdit = (event) => {
    event.preventDefault();
    if (!String(form.ledgerName || "").trim() || !Number(form.ledgerAmount || form.itemAmount || 0)) {
      toast("Enter ledger name and ledger amount before saving.", "error");
      return;
    }
    onSave({
      ...form,
      buyerSupplierPincode: String(form.buyerSupplierPincode || "").trim(),
      ledgerName: String(form.ledgerName || "").trim(),
      ledgerAmount: Number(form.ledgerAmount || form.itemAmount || 0),
      ledgerAmountDrCr: form.ledgerAmountDrCr || "Dr",
      itemName: String(form.itemName || "").trim(),
      billedQuantity: form.billedQuantity,
      itemRate: form.itemRate,
      itemRatePer: String(form.itemRatePer || "").trim(),
      itemAmount: Number(form.itemAmount || form.ledgerAmount || 0),
      changeMode: String(form.changeMode || "").trim(),
      narration: String(form.narration || "").trim()
    });
  };

  return (
    <div className="receipt-modal-backdrop" role="presentation" onClick={onClose}>
      <section className="receipt-modal login-edit-modal" role="dialog" aria-modal="true" aria-label="Edit finance record" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>Edit Finance Record</h2>
            <p>{record.ledgerName || record.itemName || record.date}</p>
          </div>
          <button type="button" className="icon-action" aria-label="Close finance editor" title="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </header>
        <form className="form-grid employee-edit-form" onSubmit={submitEdit}>
          <label>Date<input type="date" value={dateInputValue(form.date)} onChange={(event) => updateField("date", event.target.value)} /></label>
          <label>Buyer/Supplier - Pincode<input value={form.buyerSupplierPincode} onChange={(event) => updateField("buyerSupplierPincode", event.target.value)} /></label>
          <label>Ledger Name<input value={form.ledgerName} onChange={(event) => updateField("ledgerName", event.target.value)} /></label>
          <label>Ledger Amount<input type="number" value={form.ledgerAmount} onChange={(event) => updateField("ledgerAmount", event.target.value)} /></label>
          <label>Ledger Amount Dr/Cr<select value={form.ledgerAmountDrCr} onChange={(event) => updateField("ledgerAmountDrCr", event.target.value)}><option>Dr</option><option>Cr</option></select></label>
          <label>Item Name<input value={form.itemName} onChange={(event) => updateField("itemName", event.target.value)} /></label>
          <label>Billed Quantity<input type="number" value={form.billedQuantity} onChange={(event) => updateField("billedQuantity", event.target.value)} /></label>
          <label>Item Rate<input type="number" value={form.itemRate} onChange={(event) => updateField("itemRate", event.target.value)} /></label>
          <label>Item Rate per<input value={form.itemRatePer} onChange={(event) => updateField("itemRatePer", event.target.value)} /></label>
          <label>Item Amount<input type="number" value={form.itemAmount} onChange={(event) => updateField("itemAmount", event.target.value)} /></label>
          <label>Change Mode<input value={form.changeMode} onChange={(event) => updateField("changeMode", event.target.value)} /></label>
          <label className="wide-input">Narration<input value={form.narration} onChange={(event) => updateField("narration", event.target.value)} /></label>
          <div className="modal-form-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button">Save Finance Record</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ApprovalPanel({ title, items, kind, commit, className = "" }) {
  const updateStatus = (id, status) => {
    commit((current) => {
      const targetItem = current[kind].find((item) => item.id === id);
      const nextItems = current[kind].map((item) => item.id === id ? { ...item, status } : item);
      if (kind !== "expenses" || status !== "Approved" || !targetItem) {
        return { ...current, [kind]: nextItems };
      }

      const alreadyInLedger = (current.ledger || []).some((ledgerItem) => ledgerItem.sourceExpenseId === targetItem.id);
      if (alreadyInLedger) {
        return { ...current, [kind]: nextItems };
      }

      const approvedExpense = { ...targetItem, status };
      return {
        ...current,
        [kind]: nextItems,
        ledger: [ledgerEntryFromExpense(approvedExpense, "Approval"), ...(current.ledger || [])]
      };
    });
    toast(`${kind === "leaves" ? "Leave" : "Expense"} ${status.toLowerCase()}.`);
  };

  return (
    <Panel title={title} className={className}>
      <div className="approval-list">
        {items.length ? items.map((item) => (
          <article className="approval-row" key={item.id}>
            <div>
              <strong>{item.employeeName}</strong>
              <span>{item.type || item.category} {item.duration ? `- ${item.duration}` : ""} {item.amount ? `- ${money(item.amount)}` : ""}</span>
              <small>{item.reason || item.notes || `${item.from || item.date} to ${item.to || item.date}`}</small>
            </div>
            <Status status={item.status} />
            <button onClick={() => updateStatus(item.id, "Approved")} disabled={item.status === "Approved"}>Approve</button>
            <button onClick={() => updateStatus(item.id, "Rejected")} disabled={item.status === "Rejected"}>Reject</button>
          </article>
        )) : <p className="empty-note">No records yet.</p>}
      </div>
    </Panel>
  );
}

function Status({ status }) {
  return <span className={`status ${String(status).toLowerCase()}`}>{status}</span>;
}

function DataTable({ rows, columns, className = "" }) {
  if (!rows.length) return <p className="empty-note">No records yet.</p>;
  const resolvedColumns = columns.map((column) => (
    typeof column === "string" ? { key: column, label: column } : column
  ));
  return (
    <div className={`data-table ${className}`.trim()}>
      <div className="data-head" style={{ gridTemplateColumns: `repeat(${resolvedColumns.length}, minmax(130px, 1fr))` }}>
        {resolvedColumns.map((column) => <span key={columnKey(column)}>{columnLabel(column)}</span>)}
      </div>
      {rows.map((row, index) => (
        <div className="data-row" key={row.id || index} style={{ gridTemplateColumns: `repeat(${resolvedColumns.length}, minmax(130px, 1fr))` }}>
          {resolvedColumns.map((column) => {
            const key = columnKey(column);
            const value = row[key];
            return <span key={key}>{isCurrencyColumn(column) ? (value === "" || value === null || value === undefined ? "--" : money(value)) : value || "--"}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

export default App;
