/**
 * IAP completeness scoring engine.
 *
 * Weights must sum to 100. ICS-202 must reach 100% before the IAP can be
 * submitted for review. The minimum overall score to submit is 60%.
 */

export const FORM_WEIGHTS: Record<string, number> = {
  '201': 5,
  '202': 30,
  '203': 20,
  '204': 15,
  '207': 10,
  '213': 0,  // informational — not counted in completeness
  '215': 8,
  '215a': 7,
  'hics251': 3,
  'hics252': 2,
};

export const MIN_SUBMIT_SCORE = 60;
export const ICS202_REQUIRED_SCORE = 100;

type FormPresence = {
  form201?: object | null;
  form202?: object | null;
  form203?: object | null;
  form204?: object[];
  form207?: object | null;
  form215?: object | null;
  form215a?: object | null;
  formHics251?: object | null;
  formHics252?: object | null;
};

function scoreForm201(f: any): number {
  if (!f) return 0;
  const required = ['incidentName', 'preparedBy', 'dateTimePrepared', 'currentSituation'];
  const filled = required.filter((k) => f[k] && String(f[k]).trim() !== '').length;
  return Math.round((filled / required.length) * 100);
}

function scoreForm202(f: any): number {
  if (!f) return 0;
  const required = ['incidentObjectives', 'weatherForecast', 'generalSafety', 'siteAccessEgress'];
  const filled = required.filter((k) => f[k] && String(f[k]).trim() !== '').length;
  return Math.round((filled / required.length) * 100);
}

function scoreForm203(f: any): number {
  if (!f) return 0;
  // Org assignment section
  const hasIc = !!(f.incidentCommanderName);
  const hasSections = ['operationsSection', 'planningSection', 'logisticsSection', 'financeSection']
    .some((s) => f[s] && Object.keys(f[s]).length > 0);
  return hasIc && hasSections ? 100 : hasIc ? 50 : 0;
}

function scoreForm204(rows: any[]): number {
  if (!rows?.length) return 0;
  // Need at least one 204 with branch + division filled
  const complete = rows.filter((r) => r.branchName && r.divisionGroupName);
  return Math.min(100, Math.round((complete.length / Math.max(rows.length, 1)) * 100));
}

function scoreForm207(f: any): number {
  if (!f) return 0;
  // Org chart drawn / node count > 0
  return f.nodes && Array.isArray(f.nodes) && f.nodes.length > 0 ? 100 : 0;
}

function scoreForm215(f: any): number {
  if (!f) return 0;
  const required = ['incidentName', 'siteSafetyPlanRequired', 'hazardRisk'];
  const filled = required.filter((k) => f[k] !== undefined && f[k] !== null && String(f[k]).trim() !== '').length;
  return Math.round((filled / required.length) * 100);
}

function scoreForm215a(f: any): number {
  if (!f) return 0;
  return f.completionStatus === 'COMPLETE' ? 100 : f.incidentName ? 50 : 0;
}

function scoreFormHics251(f: any): number {
  if (!f) return 0;
  return f.operationalPeriodStatus ? 100 : 0;
}

function scoreFormHics252(f: any): number {
  if (!f) return 0;
  return f.iapSignatureCaptured ? 100 : 0;
}

export interface CompletenessResult {
  overall: number;  // 0–100
  perForm: Record<string, number>;
  canSubmit: boolean;
  ics202Complete: boolean;
}

export function calculateCompleteness(forms: FormPresence): CompletenessResult {
  const perForm: Record<string, number> = {
    '201': scoreForm201(forms.form201),
    '202': scoreForm202(forms.form202),
    '203': scoreForm203(forms.form203),
    '204': scoreForm204(forms.form204 ?? []),
    '207': scoreForm207(forms.form207),
    '215': scoreForm215(forms.form215),
    '215a': scoreForm215a(forms.form215a),
    'hics251': scoreFormHics251(forms.formHics251),
    'hics252': scoreFormHics252(forms.formHics252),
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(FORM_WEIGHTS)) {
    if (weight === 0) continue;
    weightedSum += (perForm[key] ?? 0) * weight;
    totalWeight += weight;
  }

  const overall = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  const ics202Complete = perForm['202'] === 100;
  const canSubmit = overall >= MIN_SUBMIT_SCORE && ics202Complete;

  return { overall, perForm, canSubmit, ics202Complete };
}
