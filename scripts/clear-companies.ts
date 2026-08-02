import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("Missing TURSO credentials");

  const client = createClient({ url, authToken });
  const companies = await client.execute("SELECT id, name, code FROM companies");
  console.log("Companies before:", companies.rows);

  for (const row of companies.rows) {
    const id = Number(row.id);
    await client.execute({ sql: "UPDATE project_users SET company_id = NULL WHERE company_id = ?", args: [id] });
    await client.execute({ sql: "DELETE FROM company_projects WHERE company_id = ?", args: [id] });
    await client.execute({ sql: "DELETE FROM companies WHERE id = ?", args: [id] });
    console.log("Deleted company", row.name, row.code);
  }

  const after = await client.execute("SELECT id, name, code FROM companies");
  console.log("Companies after:", after.rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
