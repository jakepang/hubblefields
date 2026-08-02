import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projectUsers = sqliteTable("project_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectCode: text("project_code").notNull().default("T5-SUBSTRUCTURE"),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  status: text("status").notNull().default("Pending"),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  credentialExpiresAt: integer("credential_expires_at", { mode: "timestamp_ms" }),
  activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
  platformAdmin: integer("platform_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("Active"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const companyProjects = sqliteTable("company_projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id")
    .notNull()
    .references(() => companies.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  status: text("status").notNull().default("Active"),
  address: text("address"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const projectSessions = sqliteTable("project_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => projectUsers.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const workers = sqliteTable("workers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectCode: text("project_code").notNull().default("T5-SUBSTRUCTURE"),
  workerId: text("worker_id").notNull().unique(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  trade: text("trade").notNull(),
  status: text("status").notNull().default("Active"),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => projectUsers.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const attendanceRecords = sqliteTable("attendance_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectCode: text("project_code").notNull().default("T5-SUBSTRUCTURE"),
  workerId: text("worker_id").notNull(),
  workerName: text("worker_name").notNull(),
  company: text("company").notNull(),
  trade: text("trade").notNull(),
  action: text("action").notNull(),
  remarks: text("remarks"),
  photoData: text("photo_data"),
  photoUrl: text("photo_url"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  accuracyM: real("accuracy_m"),
  locationVerified: integer("location_verified", { mode: "boolean" }),
  locationLabel: text("location_label"),
  distanceM: real("distance_m"),
  recordedByUserId: integer("recorded_by_user_id")
    .notNull()
    .references(() => projectUsers.id),
  recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
});
