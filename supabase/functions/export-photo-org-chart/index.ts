import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// HICS roles shown on the photo org chart (command + section chiefs only)
const CHART_ROLES = [
  { role: "INCIDENT_COMMANDER", label: "Incident Commander", tier: 0 },
  { role: "DEPUTY_INCIDENT_COMMANDER", label: "Deputy Incident Commander", tier: 1 },
  { role: "SAFETY_OFFICER", label: "Safety Officer", tier: 1 },
  { role: "LIAISON_OFFICER", label: "Liaison Officer", tier: 1 },
  { role: "PUBLIC_INFORMATION_OFFICER", label: "Public Information Officer", tier: 1 },
  { role: "OPERATIONS_SECTION_CHIEF", label: "Operations Section Chief", tier: 2 },
  { role: "PLANNING_SECTION_CHIEF", label: "Planning Section Chief", tier: 2 },
  { role: "LOGISTICS_SECTION_CHIEF", label: "Logistics Section Chief", tier: 2 },
  { role: "FINANCE_ADMIN_SECTION_CHIEF", label: "Finance/Admin Section Chief", tier: 2 },
];

const SILHOUETTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="44" height="44"><rect width="80" height="80" fill="#e2e8f0" rx="4"/><circle cx="40" cy="28" r="16" fill="#94a3b8"/><ellipse cx="40" cy="68" rx="26" ry="18" fill="#94a3b8"/></svg>`;
const SILHOUETTE_DATA_URI = `data:image/svg+xml;base64,${btoa(SILHOUETTE_SVG)}`;

interface OrgNode {
  role: string;
  label: string;
  tier: number;
  name: string;
  title: string;
  photoDataUri: string;
}

async function fetchImageAsDataUri(url: string): Promise<string> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return SILHOUETTE_DATA_URI;
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const ct = resp.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${base64}`;
  } catch {
    return SILHOUETTE_DATA_URI;
  }
}

function nodeCard(node: OrgNode): string {
  return `
    <div class="node-card">
      <img src="${node.photoDataUri}" alt="${node.name || node.label}" class="node-photo" />
      <div class="node-text">
        <div class="node-name">${node.name || "&mdash;"}</div>
        <div class="node-role">${node.label}</div>
        ${node.title ? `<div class="node-title">${node.title}</div>` : ""}
      </div>
    </div>`;
}

function buildHtml(
  incidentName: string,
  periodLabel: string,
  facilityName: string,
  nodes: OrgNode[],
): string {
  const ic = nodes.find(n => n.tier === 0);
  const tier1 = nodes.filter(n => n.tier === 1);
  const tier2 = nodes.filter(n => n.tier === 2);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    background: #fff;
    padding: 24px 32px;
    font-size: 11px;
    color: #1e293b;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    border-bottom: 2px solid #1e40af;
    padding-bottom: 10px;
  }
  .header-title { font-size: 18px; font-weight: 700; color: #1e293b; }
  .header-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
  .header-right { text-align: right; font-size: 10px; color: #64748b; }
  .chart-wrap { display: flex; flex-direction: column; align-items: center; gap: 0; }
  .tier-row { display: flex; justify-content: center; align-items: flex-start; gap: 12px; margin-top: 4px; }
  .connector-down { width: 2px; height: 16px; background: #94a3b8; margin: 0 auto; }
  .connector-h-line { height: 2px; background: #94a3b8; flex: 1; margin-top: 30px; min-width: 8px; max-width: 20px; }
  .node-card {
    display: flex;
    align-items: center;
    background: #1d4ed8;
    border-radius: 4px;
    overflow: hidden;
    width: 190px;
    min-height: 52px;
  }
  .node-photo {
    width: 44px;
    height: 52px;
    object-fit: cover;
    flex-shrink: 0;
    background: #dbeafe;
  }
  .node-text {
    padding: 4px 8px;
    flex: 1;
    min-width: 0;
  }
  .node-name {
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .node-role {
    font-size: 9px;
    color: #bfdbfe;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }
  .node-title {
    font-size: 8px;
    color: #93c5fd;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }
  .section-wrap {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 4px;
    width: 100%;
  }
  .v-connector { display: flex; flex-direction: column; align-items: center; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="header-title">HICS Organizational Chart</div>
      <div class="header-sub">${facilityName} &mdash; ${incidentName}</div>
    </div>
    <div class="header-right">
      Operational Period<br/>${periodLabel}
    </div>
  </div>

  <div class="chart-wrap">
    ${ic ? `
    <!-- Tier 0: Incident Commander -->
    <div class="tier-row">
      ${nodeCard(ic)}
    </div>
    <div class="connector-down"></div>
    ` : ""}

    ${tier1.length > 0 ? `
    <!-- Tier 1: Command Staff -->
    <div class="tier-row">
      ${tier1.map(n => `
        <div class="v-connector">
          ${nodeCard(n)}
        </div>
      `).join('<div class="connector-h-line" style="display:none"></div>')}
    </div>
    <div class="connector-down"></div>
    ` : ""}

    ${tier2.length > 0 ? `
    <!-- Tier 2: Section Chiefs -->
    <div class="section-wrap">
      ${tier2.map(n => `
        <div class="v-connector">
          ${nodeCard(n)}
        </div>
      `).join("")}
    </div>
    ` : ""}
  </div>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Expect path: /export-photo-org-chart/{iapId}
    const pathParts = url.pathname.split("/").filter(Boolean);
    const iapId = pathParts[pathParts.length - 1];

    if (!iapId || iapId === "export-photo-org-chart") {
      return new Response(JSON.stringify({ error: "iapId is required in the path" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch IAP → operational period → incident
    const { data: iapRow, error: iapErr } = await supabase
      .from("iaps")
      .select("operational_period_id")
      .eq("id", iapId)
      .maybeSingle();
    if (iapErr || !iapRow) {
      return new Response(JSON.stringify({ error: "IAP not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const periodId = (iapRow as any).operational_period_id as string;

    const { data: periodRow } = await supabase
      .from("operational_periods")
      .select("*, incidents(id, name, incident_number, facility_id)")
      .eq("id", periodId)
      .maybeSingle();

    if (!periodRow) {
      return new Response(JSON.stringify({ error: "Period not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const incident = (periodRow as any).incidents as Record<string, unknown>;
    const incidentName = (incident.name ?? incident.incident_number ?? "Incident") as string;
    const facilityId = incident.facility_id as string;

    // Fetch facility name
    const { data: facilityRow } = await supabase
      .from("facilities")
      .select("name")
      .eq("id", facilityId)
      .maybeSingle();
    const facilityName = ((facilityRow as any)?.name ?? "Facility") as string;

    // Format period label
    const startTime = periodRow.start_time as string | null;
    const endTime = periodRow.end_time as string | null;
    const periodLabel = startTime
      ? `${new Date(startTime).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}${endTime ? " – " + new Date(endTime).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : ""}`
      : `Period ${periodRow.period_number}`;

    // Fetch active position assignments for this incident
    const { data: assignments } = await supabase
      .from("incident_position_assignments")
      .select("hics_role, assigned_user_id")
      .eq("incident_id", incident.id as string)
      .eq("is_active", true);

    const assignmentMap: Record<string, string> = {};
    for (const a of (assignments ?? [])) {
      assignmentMap[(a as any).hics_role] = (a as any).assigned_user_id;
    }

    // Fetch user details + personnel photos for assigned users
    const userIds = Object.values(assignmentMap).filter(Boolean);
    let userMap: Record<string, { firstName: string; lastName: string; title: string; photoUrl: string }> = {};

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("app_users")
        .select("id, first_name, last_name, job_title")
        .in("id", userIds);

      for (const u of (users ?? [])) {
        const uid = (u as any).id as string;
        // Look for a matching personnel record for the photo
        const { data: personRows } = await supabase
          .from("facility_personnel")
          .select("photo_url")
          .eq("facility_id", facilityId)
          .ilike("first_name", (u as any).first_name)
          .ilike("last_name", (u as any).last_name)
          .eq("is_deleted", false)
          .limit(1);

        const photoUrl = (personRows?.[0] as any)?.photo_url ?? null;
        userMap[uid] = {
          firstName: (u as any).first_name ?? "",
          lastName: (u as any).last_name ?? "",
          title: (u as any).job_title ?? "",
          photoUrl: photoUrl ?? "",
        };
      }
    }

    // Build nodes with photos
    const nodes: OrgNode[] = [];
    for (const chartRole of CHART_ROLES) {
      const userId = assignmentMap[chartRole.role];
      const userData = userId ? userMap[userId] : null;

      let photoDataUri = SILHOUETTE_DATA_URI;
      if (userData?.photoUrl) {
        photoDataUri = await fetchImageAsDataUri(userData.photoUrl);
      }

      nodes.push({
        role: chartRole.role,
        label: chartRole.label,
        tier: chartRole.tier,
        name: userData ? `${userData.firstName} ${userData.lastName}`.trim() : "",
        title: userData?.title ?? "",
        photoDataUri,
      });
    }

    const html = buildHtml(incidentName, periodLabel, facilityName, nodes);

    // Use Deno built-in HTML to PDF via browser automation isn't available in edge runtime.
    // Return the HTML directly with a special content-type so the client can use browser print.
    // The frontend will open this in a print window.
    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err: unknown) {
    console.error("export-photo-org-chart error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
