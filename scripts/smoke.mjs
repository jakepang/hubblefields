const BASE = process.env.BASE_URL || "http://localhost:3000";

async function req(path, { method = "GET", body, cookie } = {}) {
  const headers = {};
  if (body) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let setCookie = [];
  if (typeof response.headers.getSetCookie === "function") {
    setCookie = response.headers.getSetCookie();
  } else {
    const single = response.headers.get("set-cookie");
    if (single) setCookie = [single];
  }

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, setCookie, text };
}

function pickSession(setCookie) {
  for (const line of setCookie) {
    const match = /(?:^|,\s*)t5_session=([^;]+)/.exec(line);
    if (match) return `t5_session=${match[1]}`;
  }
  return "";
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loginAs(email, password, newPassword) {
  const first = await req("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (first.json?.mustChangePassword) {
    assert(newPassword, `${email} requires newPassword for first login`);
    const changed = await req("/api/auth/login", {
      method: "POST",
      body: { email, password, newPassword },
    });
    assert(changed.status === 200, `Password change failed for ${email}: ${JSON.stringify(changed.json)}`);
    const cookie = pickSession(changed.setCookie);
    assert(cookie, `Missing session cookie after password change for ${email}`);
    return { cookie, role: changed.json.role, password: newPassword };
  }
  assert(first.status === 200, `Login failed for ${email}: ${JSON.stringify(first.json)}`);
  const cookie = pickSession(first.setCookie);
  assert(cookie, `Missing session cookie for ${email}`);
  return { cookie, role: first.json.role, password };
}

const evidence = {
  photoDataUrl: `data:image/jpeg;base64,${Buffer.alloc(900, 65).toString("base64")}`,
  latitude: 1.322299,
  longitude: 103.990621,
  accuracyM: 12,
};

async function main() {
  const stamp = Date.now();
  const supervisorEmail = `supervisor+${stamp}@t5.local`;
  const tempPassword = "TempPass99!";
  const seedPassword = process.env.ADMIN_SEED_PASSWORD || "Admin12345!";
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminPass99!";

  console.log("Smoke against", BASE);

  let admin;
  try {
    admin = await loginAs("admin@t5.local", adminPassword);
  } catch {
    admin = await loginAs("admin@t5.local", seedPassword, adminPassword);
  }
  assert(admin.role === "Project Admin", "Expected Project Admin role");

  const me = await req("/api/me", { cookie: admin.cookie });
  assert(me.status === 200 && me.json.user.role === "Project Admin", "Admin /api/me failed");

  const invite = await req("/api/project-users", {
    method: "POST",
    cookie: admin.cookie,
    body: {
      name: "Smoke Supervisor",
      email: supervisorEmail,
      role: "Supervisor",
      temporaryPassword: tempPassword,
    },
  });
  assert(invite.status === 201, `Invite failed: ${JSON.stringify(invite.json)}`);

  const missingEvidence = await req("/api/attendance", {
    method: "POST",
    cookie: admin.cookie,
    body: { workerId: "059B", action: "IN", remarks: "no evidence" },
  });
  assert(missingEvidence.status === 400, "Attendance without photo/GPS should be rejected");

  const checkIn = await req("/api/attendance", {
    method: "POST",
    cookie: admin.cookie,
    body: { workerId: "059B", action: "IN", remarks: "smoke", ...evidence },
  });
  if (checkIn.status === 409) {
    const checkOut = await req("/api/attendance", {
      method: "POST",
      cookie: admin.cookie,
      body: { workerId: "059B", action: "OUT", remarks: "smoke reset", ...evidence },
    });
    assert(checkOut.status === 201, `Check-out reset failed: ${JSON.stringify(checkOut.json)}`);
    const again = await req("/api/attendance", {
      method: "POST",
      cookie: admin.cookie,
      body: { workerId: "059B", action: "IN", remarks: "smoke", ...evidence },
    });
    assert(again.status === 201, `Check-in retry failed: ${JSON.stringify(again.json)}`);
    assert(again.json.record?.hasPhoto === true, "Check-in should store photo flag");
    assert(again.json.record?.locationVerified === true, "On-site GPS should verify");
  } else {
    assert(checkIn.status === 201, `Check-in failed: ${JSON.stringify(checkIn.json)}`);
    assert(checkIn.json.record?.hasPhoto === true, "Check-in should store photo flag");
    assert(checkIn.json.record?.locationVerified === true, "On-site GPS should verify");
  }

  const duplicate = await req("/api/attendance", {
    method: "POST",
    cookie: admin.cookie,
    body: { workerId: "059B", action: "IN", remarks: "should fail", ...evidence },
  });
  assert(duplicate.status === 409, "Duplicate check-in should be rejected");

  const localDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const today = localDate(new Date());
  const yesterday = localDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const history = await req(`/api/attendance?from=${today}&to=${today}`, { cookie: admin.cookie });
  assert(history.status === 200 && Array.isArray(history.json.onsiteNow), "Today history should include onsiteNow");
  assert(Array.isArray(history.json.shifts), "Today history should include shifts");

  const csv = await req(`/api/attendance/export?from=${yesterday}&to=${today}`, { cookie: admin.cookie });
  assert(
    csv.status === 200 && csv.text.includes("Check In") && csv.text.includes("Shifts"),
    `CSV export failed status=${csv.status} body=${String(csv.text).slice(0, 200)}`,
  );

  const supervisor = await loginAs(supervisorEmail, tempPassword, "SuperLive99!");

  const forbidden = await req("/api/project-users", { cookie: supervisor.cookie });
  assert(forbidden.status === 403, "Supervisor should not access project-users");

  const supervisorHistory = await req(`/api/attendance?from=${yesterday}&to=${today}`, {
    cookie: supervisor.cookie,
  });
  assert(supervisorHistory.status === 200, "Supervisor should browse recent history");

  const workers = await req("/api/workers", { cookie: supervisor.cookie });
  assert(workers.status === 200 && workers.json.workers.length >= 16, "Workers list failed");

  const signin = await fetch(`${BASE}/signin`);
  assert(signin.status === 200, "Signin page failed");
  const home = await fetch(`${BASE}/`, { redirect: "manual" });
  assert([200, 307, 302].includes(home.status), `Home page failed status=${home.status}`);

  console.log("Smoke OK");
}

main().catch((error) => {
  console.error("Smoke FAILED:", error.message);
  process.exit(1);
});
