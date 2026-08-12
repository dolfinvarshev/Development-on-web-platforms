import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let memServer = null;

export async function connectMongo() {
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    // $0 local development: run a real MongoDB via mongodb-memory-server, but with a
    // persistent dbPath so CMS edits, incidents and alert history survive restarts
    // (a fresh temp dir would silently reset the admin's work on every `npm run dev`).
    const dbPath =
      process.env.MONGO_DATA_DIR || path.join(__dirname, '..', '..', 'data', 'mongo');
    fs.mkdirSync(dbPath, { recursive: true });
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memServer = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: 'wiredTiger' },
    });
    uri = memServer.getUri('definet');
    console.log(`[mongo] MONGODB_URI not set — local MongoDB with persistent data at ${dbPath}`);
  }
  await mongoose.connect(uri);
  console.log('[mongo] connected');
}

export async function disconnectMongo() {
  await mongoose.disconnect();
  if (memServer) await memServer.stop();
}

const { Schema, model } = mongoose;

const CandidateSchema = new Schema(
  {
    deviceId: Number,
    label: String,
    phone: String,
    lat: Number,
    lng: Number,
    locationSource: String,
    battery: Number,
    kind: String,
    hasLora: Boolean,
    hasMagnus: Boolean,
    lastSeen: Date,
    distanceM: Number,
    inRadius: Boolean,
    rank: Number,
    alerts: {
      push: Boolean,
      sms: Boolean,
      loraDownlink: Boolean,
    },
  },
  { _id: false }
);

const IncidentSchema = new Schema(
  {
    location: { lat: Number, lng: Number },
    radiusM: Number,
    status: {
      type: String,
      enum: ['active', 'responding', 'resolved', 'cancelled'],
      default: 'active',
    },
    source: {
      type: String,
      enum: ['simulator', 'app', 'call_center'],
      default: 'simulator',
    },
    candidates: [CandidateSchema],
    meshNodes: [
      { deviceId: Number, label: String, lat: Number, lng: Number, lastSeen: Date, _id: false },
    ],
    responder: {
      deviceId: Number,
      label: String,
      phone: String,
      acceptedAt: Date,
    },
    breadcrumbs: [
      { lat: Number, lng: Number, at: Date, distanceRemainingM: Number, _id: false },
    ],
    arrivedAt: Date,
    resolvedAt: Date,
  },
  { timestamps: true }
);

const ContentPageSchema = new Schema(
  {
    key: { type: String, unique: true, required: true },
    title: String,
    intro: String,
    sections: [{ heading: String, body: String, _id: false }],
    links: [{ label: String, url: String, description: String, _id: false }],
    updatedBy: String,
  },
  { timestamps: true }
);

const AlertLogSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['maintenance_battery', 'incident_push', 'incident_sms', 'incident_lora_downlink'],
      required: true,
    },
    deviceId: Number,
    deviceLabel: String,
    incidentId: { type: Schema.Types.ObjectId, ref: 'Incident' },
    message: String,
  },
  { timestamps: true }
);

const TelemetryLogSchema = new Schema(
  {
    deviceId: Number,
    channel: { type: String, enum: ['lora', 'magnus', 'phone'] },
    battery: Number,
    lat: Number,
    lng: Number,
  },
  { timestamps: true }
);

const SimConfigSchema = new Schema(
  {
    key: { type: String, unique: true, default: 'sim' },
    radiusM: { type: Number, default: 1500 },
    scatterFactor: { type: Number, default: 2.5 },
    freshTelemetryMinutes: { type: Number, default: 10 },
    defaultCenter: {
      lat: { type: Number, default: 32.0809 },
      lng: { type: Number, default: 34.7806 },
    },
  },
  { timestamps: true }
);

export const Incident = model('Incident', IncidentSchema);
export const ContentPage = model('ContentPage', ContentPageSchema);
export const AlertLog = model('AlertLog', AlertLogSchema);
export const TelemetryLog = model('TelemetryLog', TelemetryLogSchema);
export const SimConfig = model('SimConfig', SimConfigSchema);

export async function getSimConfig() {
  let cfg = await SimConfig.findOne({ key: 'sim' });
  if (!cfg) cfg = await SimConfig.create({ key: 'sim' });
  return cfg;
}
