import dotenv from "dotenv";
import mongoose from "mongoose";
import dns from "node:dns";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env"), override: true });
dns.setDefaultResultOrder("ipv4first");

const mongoConnectionString = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING || "";
const mongoDirectConnectionString = process.env.MONGODB_DIRECT_URI || "";
const mongoSeedlistHosts = (process.env.MONGODB_SEEDLIST_HOSTS || "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);
const mongoReplicaSet = process.env.MONGODB_REPLICA_SET || "";
const databaseName = process.env.MONGODB_DATABASE_NAME || "aimies_people";
const portalCollectionName = process.env.MONGODB_PORTAL_COLLECTION || "portalState";
const connectionTimeoutMs = Number(process.env.MONGODB_CONNECTION_TIMEOUT_MS || 5000);
const retryIntervalMs = Number(process.env.MONGODB_RETRY_INTERVAL_MS || 5 * 60 * 1000);
const mongoRequired = String(process.env.MONGODB_REQUIRED || "").trim().toLowerCase() === "true";
const dnsServers = (process.env.MONGODB_DNS_SERVERS || "")
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);

if (dnsServers.length) {
  dns.setServers(dnsServers);
}

let connectionPromise;
let modelsPromise;
let connectionStatus = "disconnected";
let unavailableUntil = 0;

function hasMongoConnection() {
  return [mongoConnectionString, mongoDirectConnectionString, getSeedlistConnectionString()].some((uri) => uri && !uri.includes("<db_password>"));
}

function getSeedlistConnectionString() {
  if (!mongoSeedlistHosts.length || !mongoReplicaSet || !mongoConnectionString.startsWith("mongodb+srv://")) return "";

  const match = mongoConnectionString.match(/^mongodb\+srv:\/\/([^@]+)@[^/?]+([^?]*)?(\?(.*))?$/);
  if (!match) return "";

  const [, auth, pathValue = "", , rawQuery = ""] = match;
  const params = new URLSearchParams(rawQuery);
  params.set("authSource", params.get("authSource") || "admin");
  params.set("replicaSet", mongoReplicaSet);
  params.set("tls", "true");

  const hosts = mongoSeedlistHosts.map((host) => host.includes(":") ? host : `${host}:27017`).join(",");
  return `mongodb://${auth}@${hosts}${pathValue || "/"}?${params.toString()}`;
}

function getConnectionTargets() {
  return [
    { label: "seedlist", uri: getSeedlistConnectionString() },
    { label: "primary", uri: mongoConnectionString },
    { label: "direct", uri: mongoDirectConnectionString }
  ].filter((target, index, targets) => (
    target.uri
    && !target.uri.includes("<db_password>")
    && targets.findIndex((item) => item.uri === target.uri) === index
  ));
}

export function isMongoConfigured() {
  return hasMongoConnection();
}

export function isMongoRequired() {
  return mongoRequired;
}

export function getMongoConnectionStatus() {
  if (!hasMongoConnection()) return "unconfigured";
  if (connectionStatus === "connected") return "connected";
  if (connectionStatus === "connecting") return "connecting";
  if (Date.now() < unavailableUntil) return mongoRequired ? "unavailable" : "fallback";
  return "disconnected";
}

function createModels(connection) {
  const portalStateSchema = new mongoose.Schema({
    _id: String,
    dataJson: String,
    savedAt: Date
  }, { collection: portalCollectionName, versionKey: false, strict: false });

  const portalUserSchema = new mongoose.Schema({
    email: { type: String, index: true, unique: true },
    name: String,
    role: String,
    status: String,
    passwordHash: String,
    mustChangePassword: Boolean,
    passwordChangedAt: Date,
    updatedAt: Date
  }, { collection: "portalUsers", versionKey: false, strict: false });

  const timeLogSchema = new mongoose.Schema({
    id: { type: Number, index: true },
    project: String,
    job: String,
    notes: String,
    billable: Boolean,
    hours: Number,
    submitted: Boolean,
    createdAt: Date
  }, { collection: "timeLogs", versionKey: false, strict: false });

  const taskSchema = new mongoose.Schema({
    id: { type: Number, index: true },
    title: String,
    description: String,
    status: String,
    createdAt: Date
  }, { collection: "tasks", versionKey: false, strict: false });

  const candidateSchema = new mongoose.Schema({
    id: { type: Number, index: true },
    firstName: String,
    lastName: String,
    email: String,
    officialEmail: String,
    status: String,
    department: String,
    sourceOfHire: String,
    pan: String,
    uan: String,
    phone: String,
    joiningDate: String,
    createdAt: Date
  }, { collection: "Candidates", versionKey: false, strict: false });

  const attendanceSchema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.Mixed, index: true },
    employeeId: mongoose.Schema.Types.Mixed,
    userEmail: { type: String, index: true },
    userName: String,
    date: { type: String, index: true },
    checkInAt: Date,
    checkOutAt: Date,
    workedSeconds: Number,
    status: String
  }, { collection: "Attendance", versionKey: false, strict: false });

  return {
    PortalState: connection.model("PortalState", portalStateSchema),
    PortalUser: connection.model("PortalUser", portalUserSchema),
    TimeLog: connection.model("TimeLog", timeLogSchema),
    Task: connection.model("Task", taskSchema),
    Candidate: connection.model("Candidate", candidateSchema),
    Attendance: connection.model("Attendance", attendanceSchema)
  };
}

function timeoutAfter(ms, label) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`MongoDB ${label} connection timed out after ${ms}ms.`)), ms);
  });
}

function mongoRequiredError(message) {
  const error = new Error(message);
  error.status = 503;
  return error;
}

export async function getModels() {
  if (!hasMongoConnection()) {
    if (mongoRequired) throw mongoRequiredError("MongoDB is required but no connection string is configured.");
    return null;
  }
  if (Date.now() < unavailableUntil) {
    if (mongoRequired) throw mongoRequiredError("MongoDB is required but currently unavailable.");
    return null;
  }

  modelsPromise ??= (async () => {
    let lastError;
    for (const target of getConnectionTargets()) {
      let connection;
      try {
        console.log(`MongoDB connection started (${target.label})`);
        connectionStatus = "connecting";
        connection = mongoose.createConnection(target.uri, {
          dbName: databaseName,
          serverSelectionTimeoutMS: connectionTimeoutMs,
          connectTimeoutMS: connectionTimeoutMs,
          socketTimeoutMS: connectionTimeoutMs,
          family: 4
        });
        connectionPromise = connection.asPromise();
        connectionPromise.catch(() => {});

        await Promise.race([connectionPromise, timeoutAfter(connectionTimeoutMs, target.label)]);

        console.log(`MongoDB Connected (${target.label})`);
        console.log("Host:", connection.host);
        console.log("Database:", connection.name);

        connectionStatus = "connected";
        return createModels(connection);
      } catch (error) {
        lastError = error;
        connection?.close().catch(() => {});
        connectionPromise = null;
        connectionStatus = "disconnected";
        console.error(`MongoDB ${target.label} connection failed:`, error.message);
      }
    }

    modelsPromise = null;
    connectionStatus = mongoRequired ? "unavailable" : "fallback";
    unavailableUntil = Date.now() + retryIntervalMs;
    if (mongoRequired) {
      throw mongoRequiredError(lastError?.message || "MongoDB connection failed.");
    }
    console.error(`MongoDB unavailable. Using JSON fallback storage until ${new Date(unavailableUntil).toISOString()}.`, lastError?.message || "MongoDB connection failed.");
    return null;
  })();

  return modelsPromise;
}

export async function getModelsOrNull() {
  try {
    return await getModels();
  } catch {
    return null;
  }
}
