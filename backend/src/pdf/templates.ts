/**
 * HTML template generators for each HICS/ICS form.
 * Puppeteer renders these to PDF; each returns a full HTML document string.
 */

function pageWrapper(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; padding: 20px; }
    h1 { font-size: 14pt; text-align: center; margin-bottom: 4px; }
    h2 { font-size: 11pt; margin: 12px 0 4px; border-bottom: 1px solid #000; }
    .form-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .form-number { font-size: 9pt; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #666; padding: 4px 6px; vertical-align: top; }
    th { background: #e8e8e8; font-weight: bold; }
    .field { margin: 6px 0; }
    .field-label { font-weight: bold; font-size: 9pt; }
    .field-value { min-height: 20px; border-bottom: 1px solid #999; padding: 2px 4px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .page-break { page-break-after: always; }
    .signature-box { border: 1px solid #000; height: 60px; margin-top: 4px; }
    .signature-img { max-height: 58px; max-width: 100%; }
    footer { margin-top: 20px; font-size: 8pt; color: #666; text-align: center; }
  </style>
</head>
<body>
${body}
<footer>Essential HICS — Generated ${new Date().toLocaleString()} — CONTROLLED DOCUMENT</footer>
</body>
</html>`;
}

function field(label: string, value: unknown, multiline = false): string {
  const v = value !== null && value !== undefined ? String(value) : '';
  return `<div class="field">
    <div class="field-label">${label}</div>
    <div class="field-value" style="${multiline ? 'min-height:40px' : ''}">${v}</div>
  </div>`;
}

function safeStr(v: unknown): string {
  return v !== null && v !== undefined ? String(v) : '';
}

// ── ICS-201: Incident Briefing ───────────────────────────────────────────────

export function renderForm201(data: Record<string, unknown>, incidentName: string): string {
  const body = `
    <div class="form-header">
      <span class="form-number">ICS-201</span>
      <h1>Incident Briefing</h1>
      <span></span>
    </div>
    <div class="grid-2">
      ${field('Incident Name', data['incidentName'] ?? incidentName)}
      ${field('Date/Time Prepared', data['dateTimePrepared'])}
    </div>
    ${field('Current Situation', data['currentSituation'], true)}
    ${field('Initial Response Objectives', data['initialObjectives'], true)}
    ${field('Current Organization', data['currentOrganization'], true)}
    ${field('Resources Summary', data['resourcesSummary'], true)}
    <div class="grid-2">
      ${field('Prepared By', data['preparedBy'])}
      ${field('Position/Title', data['preparedByTitle'])}
    </div>`;
  return pageWrapper('ICS-201 Incident Briefing', body);
}

// ── ICS-202: Incident Objectives ────────────────────────────────────────────

export function renderForm202(data: Record<string, unknown>, incidentName: string): string {
  const body = `
    <div class="form-header">
      <span class="form-number">ICS-202</span>
      <h1>Incident Objectives</h1>
      <span></span>
    </div>
    <div class="grid-2">
      ${field('Incident Name', data['incidentName'] ?? incidentName)}
      ${field('Operational Period', safeStr(data['opPeriodStart']) + ' – ' + safeStr(data['opPeriodEnd']))}
    </div>
    ${field('Incident Objectives', data['incidentObjectives'], true)}
    ${field('Weather Forecast', data['weatherForecast'], true)}
    ${field('General Safety Message', data['generalSafety'], true)}
    ${field('Site Access / Egress', data['siteAccessEgress'], true)}
    <div class="grid-2">
      ${field('Approved By (IC/UC)', data['approvedBy'])}
      ${field('Date/Time', data['approvedAt'])}
    </div>`;
  return pageWrapper('ICS-202 Incident Objectives', body);
}

// ── ICS-203: Organization Assignment List ───────────────────────────────────

export function renderForm203(data: Record<string, unknown>, incidentName: string): string {
  const sections = [
    ['Command Staff', ['Incident Commander', 'Deputy IC', 'Safety Officer', 'Liaison Officer', 'Public Information Officer']],
    ['Operations Section', ['Chief', 'Deputy', 'Branch I Director', 'Branch II Director', 'Air Operations Branch Director']],
    ['Planning Section', ['Chief', 'Deputy', 'Resources Unit Leader', 'Situation Unit Leader', 'Documentation Unit Leader']],
    ['Logistics Section', ['Chief', 'Deputy', 'Supply Unit Leader', 'Facilities Unit Leader', 'Ground Support Unit Leader']],
    ['Finance/Administration', ['Chief', 'Deputy', 'Time Unit Leader', 'Cost Unit Leader', 'Procurement Unit Leader']],
  ] as const;

  const rows = sections.map(([section, roles]) => `
    <h2>${section}</h2>
    <table>
      <tr><th>Position</th><th>Name</th><th>Agency/Dept.</th></tr>
      ${roles.map(r => `<tr><td>${r}</td><td></td><td></td></tr>`).join('')}
    </table>`).join('');

  const body = `
    <div class="form-header">
      <span class="form-number">ICS-203</span>
      <h1>Organization Assignment List</h1>
      <span></span>
    </div>
    <div class="grid-2">
      ${field('Incident Name', data['incidentName'] ?? incidentName)}
      ${field('Operational Period', safeStr(data['opPeriodStart']) + ' – ' + safeStr(data['opPeriodEnd']))}
    </div>
    <div class="grid-2">
      ${field('Incident Commander', data['incidentCommanderName'])}
      ${field('Date/Time Prepared', data['dateTimePrepared'])}
    </div>
    ${rows}`;
  return pageWrapper('ICS-203 Organization Assignment List', body);
}

// ── ICS-204: Assignment List ─────────────────────────────────────────────────

export function renderForm204(rows: Record<string, unknown>[], incidentName: string): string {
  const tableRows = rows.map(r => `
    <tr>
      <td>${safeStr(r['branchName'])}</td>
      <td>${safeStr(r['divisionGroupName'])}</td>
      <td>${safeStr((r['formData'] as any)?.['supervisorName'])}</td>
      <td>${safeStr((r['formData'] as any)?.['resources'])}</td>
      <td>${safeStr((r['formData'] as any)?.['workAssignments'])}</td>
    </tr>`).join('');

  const body = `
    <div class="form-header">
      <span class="form-number">ICS-204</span>
      <h1>Assignment List</h1>
      <span></span>
    </div>
    ${field('Incident Name', incidentName)}
    <table>
      <tr>
        <th>Branch</th>
        <th>Division/Group</th>
        <th>Supervisor</th>
        <th>Resources</th>
        <th>Work Assignments</th>
      </tr>
      ${tableRows || '<tr><td colspan="5">No assignments recorded.</td></tr>'}
    </table>`;
  return pageWrapper('ICS-204 Assignment List', body);
}

// ── ICS-207: Incident Organization Chart ────────────────────────────────────

export function renderForm207(data: Record<string, unknown>, incidentName: string): string {
  const body = `
    <div class="form-header">
      <span class="form-number">ICS-207</span>
      <h1>Incident Organization Chart</h1>
      <span></span>
    </div>
    ${field('Incident Name', data['incidentName'] ?? incidentName)}
    ${field('Operational Period', safeStr(data['opPeriodStart']) + ' – ' + safeStr(data['opPeriodEnd']))}
    <p style="margin-top:16px;color:#666;font-style:italic;">
      [Live org chart rendered from org board data. See digital version for interactive view.]
    </p>
    <table>
      <tr><th>Position</th><th>Assigned Person</th></tr>
      ${Array.isArray(data['nodes'])
        ? (data['nodes'] as any[]).map(n =>
            `<tr><td>${safeStr(n.role)}</td><td>${safeStr(n.name)}</td></tr>`).join('')
        : '<tr><td colspan="2">No assignments.</td></tr>'}
    </table>`;
  return pageWrapper('ICS-207 Incident Organization Chart', body);
}

// ── ICS-213: General Message ─────────────────────────────────────────────────

export function renderForm213(data: Record<string, unknown>): string {
  const body = `
    <div class="form-header">
      <span class="form-number">ICS-213</span>
      <h1>General Message</h1>
      <span></span>
    </div>
    <div class="grid-3">
      ${field('To', data['to'])}
      ${field('From', data['from'])}
      ${field('Subject', data['subject'])}
    </div>
    <div class="grid-2">
      ${field('Date', data['date'])}
      ${field('Time', data['time'])}
    </div>
    ${field('Message', data['message'], true)}
    <div class="grid-2">
      ${field('Reply', data['reply'], true)}
      <div></div>
    </div>
    <div class="grid-2">
      ${field('Approved By', data['approvedBy'])}
      ${field('Position/Title', data['approvedByTitle'])}
    </div>`;
  return pageWrapper('ICS-213 General Message', body);
}

// ── ICS-215: Operational Planning Worksheet ──────────────────────────────────

export function renderForm215(data: Record<string, unknown>, incidentName: string): string {
  const body = `
    <div class="form-header">
      <span class="form-number">ICS-215</span>
      <h1>Operational Planning Worksheet</h1>
      <span></span>
    </div>
    ${field('Incident Name', data['incidentName'] ?? incidentName)}
    ${field('Hazard / Risk', data['hazardRisk'], true)}
    ${field('Countermeasures', data['countermeasures'], true)}
    ${field('Site Safety Plan Required?', data['siteSafetyPlanRequired'])}
    ${field('Prepared By', data['preparedBy'])}`;
  return pageWrapper('ICS-215 Operational Planning Worksheet', body);
}

// ── ICS-215A: Incident Action Plan Safety Analysis ───────────────────────────

export function renderForm215a(data: Record<string, unknown>, incidentName: string): string {
  const body = `
    <div class="form-header">
      <span class="form-number">ICS-215A</span>
      <h1>IAP Safety Analysis</h1>
      <span></span>
    </div>
    ${field('Incident Name', data['incidentName'] ?? incidentName)}
    ${field('Hazardous Conditions', data['hazardousConditions'], true)}
    ${field('Mitigations', data['mitigations'], true)}
    ${field('Completion Status', data['completionStatus'])}
    <div class="grid-2">
      ${field('Safety Officer', data['safetyOfficer'])}
      ${field('Date/Time', data['dateTime'])}
    </div>`;
  return pageWrapper('ICS-215A IAP Safety Analysis', body);
}

// ── HICS-251: Facility System Status Report ──────────────────────────────────

export function renderFormHics251(data: Record<string, unknown>, incidentName: string): string {
  const systems = Array.isArray(data['systems']) ? data['systems'] as any[] : [];
  const rows = systems.map(s =>
    `<tr><td>${safeStr(s.name)}</td><td>${safeStr(s.status)}</td><td>${safeStr(s.notes)}</td></tr>`
  ).join('');

  const body = `
    <div class="form-header">
      <span class="form-number">HICS-251</span>
      <h1>Facility System Status Report</h1>
      <span></span>
    </div>
    ${field('Incident Name', incidentName)}
    ${field('Operational Period Status', data['operationalPeriodStatus'])}
    <table>
      <tr><th>System</th><th>Status</th><th>Notes</th></tr>
      ${rows || '<tr><td colspan="3">No systems recorded.</td></tr>'}
    </table>
    <div class="grid-2">
      ${field('Reported By', data['reportedBy'])}
      ${field('Date/Time', data['reportedAt'])}
    </div>`;
  return pageWrapper('HICS-251 Facility System Status Report', body);
}

// ── HICS-252: Operational Period Action Plan Signature ───────────────────────

export function renderFormHics252(
  data: Record<string, unknown>,
  incidentName: string,
  signatureDataUrl?: string,
): string {
  const sigBlock = signatureDataUrl
    ? `<img class="signature-img" src="${signatureDataUrl}" alt="IC Signature"/>`
    : '<div style="height:54px;"></div>';

  const body = `
    <div class="form-header">
      <span class="form-number">HICS-252</span>
      <h1>Operational Period Action Plan Signature</h1>
      <span></span>
    </div>
    ${field('Incident Name', incidentName)}
    ${field('Operational Period', safeStr(data['opPeriodStart']) + ' – ' + safeStr(data['opPeriodEnd']))}
    <p style="margin:12px 0;">
      By signing below, the Incident Commander approves the Incident Action Plan for this
      operational period and acknowledges responsibility for its contents.
    </p>
    <table>
      <tr><th>Name / Title</th><th>Signature</th><th>Date/Time</th></tr>
      <tr>
        <td>${safeStr(data['incidentCommanderName'])}<br/><span style="font-size:8pt">Incident Commander</span></td>
        <td><div class="signature-box">${sigBlock}</div></td>
        <td>${safeStr(data['signedAt'])}</td>
      </tr>
    </table>`;
  return pageWrapper('HICS-252 Operational Period Action Plan Signature', body);
}
