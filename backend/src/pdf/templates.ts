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

interface OrgNodes207 {
  incidentCommander: string;
  deputyIC: string;
  safetyOfficer: string;
  liaisonOfficer: string;
  publicInfoOfficer: string;
  operationsChief: string;
  stagingAreaManager: string;
  branchIDirector: string;
  branchIIDirector: string;
  airOpsDirector: string;
  planningChief: string;
  resourcesUnitLeader: string;
  situationUnitLeader: string;
  docUnitLeader: string;
  demobUnitLeader: string;
  logisticsChief: string;
  supportBranchDir: string;
  supplyUnitLeader: string;
  facilitiesUnitLeader: string;
  groundSptUnitLeader: string;
  serviceBranchDir: string;
  commsUnitLeader: string;
  medicalUnitLeader: string;
  foodUnitLeader: string;
  financeChief: string;
  timeUnitLeader: string;
  procurementUnitLeader: string;
  compClaimsUnitLeader: string;
  costUnitLeader: string;
}

/** Maps ICS-203 flat form data to the node structure used by the ICS-207 visual chart */
export function map203DataTo207Nodes(data: Record<string, unknown>): OrgNodes207 {
  const cmd = data as any;
  const ops = (cmd.operationsSection ?? {}) as any;
  const plan = (cmd.planningSection ?? {}) as any;
  const log = (cmd.logisticsSection ?? {}) as any;
  const fin = (cmd.financeSection ?? {}) as any;
  return {
    incidentCommander:    safeStr(cmd.incidentCommanderName),
    deputyIC:             safeStr(cmd.deputyICName),
    safetyOfficer:        safeStr(cmd.safetyOfficerName),
    liaisonOfficer:       safeStr(cmd.liaisonOfficerName),
    publicInfoOfficer:    safeStr(cmd.publicInfoOfficerName),
    operationsChief:      safeStr(ops.chief),
    stagingAreaManager:   safeStr(ops.stagingAreaManager ?? ''),
    branchIDirector:      safeStr(ops.branchIDirector),
    branchIIDirector:     safeStr(ops.branchIIDirector),
    airOpsDirector:       safeStr(ops.airOpsDirector),
    planningChief:        safeStr(plan.chief),
    resourcesUnitLeader:  safeStr(plan.resourcesUnitLeader),
    situationUnitLeader:  safeStr(plan.situationUnitLeader),
    docUnitLeader:        safeStr(plan.docUnitLeader),
    demobUnitLeader:      safeStr(plan.demobUnitLeader ?? ''),
    logisticsChief:       safeStr(log.chief),
    supportBranchDir:     safeStr(log.supportBranchDir ?? ''),
    supplyUnitLeader:     safeStr(log.supplyUnitLeader),
    facilitiesUnitLeader: safeStr(log.facilitiesUnitLeader),
    groundSptUnitLeader:  safeStr(log.groundSupportUnitLeader),
    serviceBranchDir:     safeStr(log.serviceBranchDir ?? ''),
    commsUnitLeader:      safeStr(log.commsUnitLeader ?? ''),
    medicalUnitLeader:    safeStr(log.medicalUnitLeader ?? ''),
    foodUnitLeader:       safeStr(log.foodUnitLeader ?? ''),
    financeChief:         safeStr(fin.chief),
    timeUnitLeader:       safeStr(fin.timeUnitLeader),
    procurementUnitLeader: safeStr(fin.procurementUnitLeader),
    compClaimsUnitLeader:  safeStr(fin.compClaimsUnitLeader ?? ''),
    costUnitLeader:        safeStr(fin.costUnitLeader),
  };
}

export function renderForm207(data: Record<string, unknown>, incidentName: string): string {
  const n = map203DataTo207Nodes(data);
  const iName = safeStr((data as any).incidentName ?? incidentName);
  const opStart = safeStr((data as any).opPeriodStart);
  const opEnd   = safeStr((data as any).opPeriodEnd);

  function fmtDate(dt: string): string {
    if (!dt) return '';
    try { return new Date(dt).toLocaleDateString('en-US'); } catch { return dt; }
  }
  function fmtTime(dt: string): string {
    if (!dt) return '';
    try { return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }); } catch { return dt; }
  }

  function box(title: string, name: string, extraStyle = ''): string {
    const nameHtml = name ? `<div class="box-name">${name}</div>` : '';
    return `<div class="org-box" style="${extraStyle}">${title}${nameHtml}</div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>ICS-207 Incident Organization Chart</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: Letter landscape; margin: 0.35in 0.4in; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; }
    .outer { border: 2px solid #000; }
    .title-row { text-align: center; font-size: 12pt; font-weight: bold; padding: 5px 0 3px; border-bottom: 2px solid #000; }
    .hdr { display: flex; border-bottom: 2px solid #000; min-height: 38px; }
    .hdr-incident { width: 30%; border-right: 2px solid #000; padding: 4px 8px; font-size: 8.5pt; }
    .hdr-period { flex: 1; padding: 4px 8px; font-size: 8.5pt; }
    .hdr-period-line { margin-bottom: 2px; }
    .chart-area { padding: 6px 8px 4px; }
    .chart-label { font-weight: bold; font-size: 8.5pt; margin-bottom: 5px; }
    .org-box { border: 1.5px solid #000; padding: 3px 4px; text-align: center; font-size: 7.5pt; font-weight: bold;
               line-height: 1.2; background: #fff; display: inline-block; min-height: 30px; }
    .box-name { font-size: 7pt; font-weight: normal; color: #333; margin-top: 2px; }
    .vl { width: 1.5px; background: #000; margin: 0 auto; }
    .hl { height: 1.5px; background: #000; }
    .footer-row { display: flex; border-top: 2px solid #000; }
    .fc { padding: 3px 6px; font-size: 7.5pt; border-right: 1.5px solid #000; white-space: nowrap; }
    .fc:last-child { border-right: none; flex: 1; }
    /* layout table */
    .lt { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .lt td { padding: 0; vertical-align: top; }
    .center { text-align: center; }
    .col-flex { display: flex; flex-direction: column; align-items: center; }
  </style>
</head>
<body>
<div class="outer">
  <div class="title-row">INCIDENT ORGANIZATION CHART (ICS 207)</div>
  <div class="hdr">
    <div class="hdr-incident">
      <strong>1. Incident Name:</strong><br/>
      <span style="font-size:9pt;">${iName}</span>
    </div>
    <div class="hdr-period">
      <div class="hdr-period-line"><strong>2. Operational Period:</strong>&nbsp;&nbsp;Date From: ${fmtDate(opStart)}&nbsp;&nbsp;&nbsp;&nbsp;Date To: ${fmtDate(opEnd)}</div>
      <div class="hdr-period-line" style="padding-left:120px;">Time From: ${fmtTime(opStart)}&nbsp;&nbsp;&nbsp;&nbsp;Time To: ${fmtTime(opEnd)}</div>
    </div>
  </div>

  <div class="chart-area">
    <div class="chart-label">3. Organization Chart</div>
    <table class="lt" style="margin-bottom:2px;">
      <colgroup>
        <col style="width:13%"/>
        <col style="width:7%"/>
        <col style="width:7%"/>
        <col style="width:7%"/>
        <col style="width:4%"/>
        <col style="width:15%"/>
        <col style="width:5%"/>
        <col style="width:14%"/>
        <col style="width:14%"/>
        <col style="width:14%"/>
      </colgroup>

      <!-- ROW 1: IC + Command Staff -->
      <tr>
        <td></td>
        <td colspan="3" class="center">
          <div class="col-flex">
            ${box('Incident Commander(s)' + (n.deputyIC ? '<br/><span style="font-size:6.5pt;font-weight:normal;">Deputy: ' + n.deputyIC + '</span>' : ''), n.incidentCommander, 'width:130px;min-height:46px;font-size:8pt;')}
            <div class="vl" style="height:10px;"></div>
          </div>
        </td>
        <td></td>
        <td colspan="2" style="padding-left:6px;">
          <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px;">
            ${box('Liaison Officer', n.liaisonOfficer, 'width:126px;')}
            ${box('Safety Officer', n.safetyOfficer, 'width:126px;')}
            ${box('Public Information Officer', n.publicInfoOfficer, 'width:126px;')}
          </div>
        </td>
        <td colspan="3"></td>
      </tr>

      <!-- ROW 2: horizontal line spanning sections from IC -->
      <tr style="height:14px;">
        <td colspan="1" style="padding:0;"></td>
        <td colspan="3" style="padding:0;vertical-align:bottom;">
          <div class="hl" style="margin:0;"></div>
        </td>
        <td colspan="6" style="padding:0;"></td>
      </tr>

      <!-- ROW 3: Section chiefs row + staging area under ops -->
      <tr>
        <td class="center">
          <div class="col-flex">
            <div class="vl" style="height:10px;"></div>
            ${box('Operations Section Chief', n.operationsChief, 'width:118px;')}
            <div class="vl" style="height:10px;"></div>
          </div>
        </td>
        <td colspan="2" class="center" style="padding-top:10px;">
          ${box('Staging Area Manager', n.stagingAreaManager, 'width:100px;font-size:7pt;')}
        </td>
        <td></td>
        <td></td>
        <td class="center">
          <div class="col-flex">
            <div class="vl" style="height:10px;"></div>
            ${box('Planning Section Chief', n.planningChief, 'width:118px;')}
            <div class="vl" style="height:10px;"></div>
          </div>
        </td>
        <td></td>
        <td class="center">
          <div class="col-flex">
            <div class="vl" style="height:10px;"></div>
            ${box('Logistics Section Chief', n.logisticsChief, 'width:118px;')}
            <div class="vl" style="height:10px;"></div>
          </div>
        </td>
        <td></td>
        <td class="center">
          <div class="col-flex">
            <div class="vl" style="height:10px;"></div>
            ${box('Finance/Admin Section Chief', n.financeChief, 'width:118px;')}
            <div class="vl" style="height:10px;"></div>
          </div>
        </td>
      </tr>

      <!-- ROW 4: Ops branch horizontal connector + sub-unit row 1 -->
      <tr>
        <td colspan="4" style="padding:0;vertical-align:top;">
          <div style="height:1.5px;background:#000;margin-left:8%;margin-right:0;"></div>
        </td>
        <td></td>
        <td class="center">${box('Resources Unit Ldr.', n.resourcesUnitLeader, 'width:112px;font-size:7pt;')}</td>
        <td></td>
        <td class="center">${box('Support Branch Dir.', n.supportBranchDir, 'width:112px;font-size:7pt;')}</td>
        <td></td>
        <td class="center">${box('Time Unit Ldr.', n.timeUnitLeader, 'width:112px;font-size:7pt;')}</td>
      </tr>

      <!-- ROW 5: Ops branches + sub-unit row 2 -->
      <tr>
        <td class="center" style="padding-top:2px;">
          <div class="col-flex">
            <div class="vl" style="height:8px;"></div>
            ${box('Branch I Dir.', n.branchIDirector, 'width:102px;font-size:7pt;')}
          </div>
        </td>
        <td class="center" style="padding-top:2px;">
          <div class="col-flex">
            <div class="vl" style="height:8px;"></div>
            ${box('Branch II Dir.', n.branchIIDirector, 'width:80px;font-size:7pt;')}
          </div>
        </td>
        <td class="center" style="padding-top:2px;">
          <div class="col-flex">
            <div class="vl" style="height:8px;"></div>
            ${box('Air Ops Dir.', n.airOpsDirector, 'width:80px;font-size:7pt;')}
          </div>
        </td>
        <td></td>
        <td></td>
        <td class="center" style="padding-top:4px;">${box('Situation Unit Ldr.', n.situationUnitLeader, 'width:112px;font-size:7pt;')}</td>
        <td></td>
        <td class="center" style="padding-top:4px;">${box('Supply Unit Ldr.', n.supplyUnitLeader, 'width:112px;font-size:7pt;')}</td>
        <td></td>
        <td class="center" style="padding-top:4px;">${box('Procurement Unit Ldr.', n.procurementUnitLeader, 'width:112px;font-size:7pt;')}</td>
      </tr>

      <!-- ROW 6: sub-unit row 3 -->
      <tr>
        <td colspan="5"></td>
        <td class="center" style="padding-top:4px;">${box('Documentation Unit Ldr.', n.docUnitLeader, 'width:112px;font-size:7pt;')}</td>
        <td></td>
        <td class="center" style="padding-top:4px;">${box('Facilities Unit Ldr.', n.facilitiesUnitLeader, 'width:112px;font-size:7pt;')}</td>
        <td></td>
        <td class="center" style="padding-top:4px;">${box('Comp./Claims Unit Ldr.', n.compClaimsUnitLeader, 'width:112px;font-size:7pt;')}</td>
      </tr>

      <!-- ROW 7: sub-unit row 4 -->
      <tr>
        <td colspan="5"></td>
        <td class="center" style="padding-top:4px;">${box('Demobilization Unit Ldr.', n.demobUnitLeader, 'width:112px;font-size:7pt;')}</td>
        <td></td>
        <td class="center" style="padding-top:4px;">${box('Ground Spt. Unit Ldr.', n.groundSptUnitLeader, 'width:112px;font-size:7pt;')}</td>
        <td></td>
        <td class="center" style="padding-top:4px;">${box('Cost Unit Ldr.', n.costUnitLeader, 'width:112px;font-size:7pt;')}</td>
      </tr>

      <!-- ROW 8: Service Branch -->
      <tr>
        <td colspan="5"></td>
        <td></td>
        <td></td>
        <td class="center" style="padding-top:4px;">${box('Service Branch Dir.', n.serviceBranchDir, 'width:112px;font-size:7pt;')}</td>
        <td colspan="2"></td>
      </tr>

      <!-- ROW 9: Comms -->
      <tr>
        <td colspan="5"></td>
        <td></td>
        <td></td>
        <td class="center" style="padding-top:4px;">${box('Comms Unit Ldr.', n.commsUnitLeader, 'width:112px;font-size:7pt;')}</td>
        <td colspan="2"></td>
      </tr>

      <!-- ROW 10: Medical -->
      <tr>
        <td colspan="5"></td>
        <td></td>
        <td></td>
        <td class="center" style="padding-top:4px;">${box('Medical Unit Ldr.', n.medicalUnitLeader, 'width:112px;font-size:7pt;')}</td>
        <td colspan="2"></td>
      </tr>

      <!-- ROW 11: Food -->
      <tr>
        <td colspan="5"></td>
        <td></td>
        <td></td>
        <td class="center" style="padding-top:4px;">${box('Food Unit Ldr.', n.foodUnitLeader, 'width:112px;font-size:7pt;')}</td>
        <td colspan="2"></td>
      </tr>

      <tr><td colspan="10" style="height:6px;"></td></tr>
    </table>
  </div>

  <div class="footer-row">
    <div class="fc"><strong>ICS 207</strong></div>
    <div class="fc">IAP Page ___</div>
    <div class="fc"><strong>4. Prepared by:</strong> &nbsp;Name: ______________________</div>
    <div class="fc">Position/Title: ______________________</div>
    <div class="fc">Signature: ______________________</div>
    <div class="fc">Date/Time: ______________________</div>
  </div>
</div>
</body>
</html>`;
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
