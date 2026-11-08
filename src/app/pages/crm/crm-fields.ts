export type CrmRow = Record<string, string | number | null>;
export type CrmField = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  max?: number;
  options?: string[];
  lookup?: string;
  prefix?: string;
  initial?: string | number;
};
export type CrmSection = 'leads' | 'opportunities' | 'activities';
export const CRM_PREFIX = { leads: 'Cle', opportunities: 'Cop', activities: 'Cat' };
const name = (key: string): CrmField => ({ key, label: 'name', required: true, max: 160 });
const status = (key: string): CrmField => ({
  key,
  label: 'status',
  type: 'status',
  required: true,
  initial: 1,
});
export const CRM_FIELDS: Record<CrmSection, CrmField[]> = {
  leads: [
    name('CleName'),
    { key: 'CleEmail', label: 'email', type: 'email', max: 320 },
    { key: 'ClePhone', label: 'phone', max: 32 },
    { key: 'CleDocument', label: 'document', max: 32 },
    {
      key: 'CleState',
      label: 'state',
      options: ['new', 'contacting', 'qualified', 'disqualified'],
      initial: 'new',
      required: true,
    },
    { key: 'CleNeed', label: 'need', type: 'textarea', max: 4000 },
    { key: 'CleNextContactAt', label: 'nextContact', type: 'datetime-local' },
    { key: 'CleCloseReason', label: 'closeReason', type: 'textarea', max: 1000 },
    status('CleStatus'),
  ],
  opportunities: [
    name('CopName'),
    {
      key: 'CrmAccountCacUUID',
      label: 'account',
      lookup: 'accounts',
      prefix: 'Cac',
      required: true,
    },
    { key: 'CrmStageCstUUID', label: 'stage', lookup: 'stages', prefix: 'Cst', required: true },
    { key: 'CrmProductCprUUID', label: 'product', lookup: 'products', prefix: 'Cpr' },
    { key: 'CrmLossReasonClrUUID', label: 'lossReason', lookup: 'loss-reasons', prefix: 'Clr' },
    { key: 'CopNeed', label: 'need', type: 'textarea', max: 4000 },
    { key: 'CopNextContactAt', label: 'nextContact', type: 'datetime-local' },
    { key: 'CopExpectedClose', label: 'expectedClose', type: 'date' },
    { key: 'CopAmountOnce', label: 'amountOnce', type: 'number', required: true, initial: 0 },
    {
      key: 'CopAmountRecurring',
      label: 'amountRecurring',
      type: 'number',
      required: true,
      initial: 0,
    },
    { key: 'CopCurrency', label: 'currency', max: 3 },
    {
      key: 'CopPeriod',
      label: 'period',
      options: ['monthly', 'yearly'],
      initial: 'monthly',
      required: true,
    },
    { key: 'CopEvidence', label: 'evidence', type: 'textarea', max: 2000 },
    status('CopStatus'),
  ],
  activities: [
    name('CatName'),
    { key: 'CrmLeadCleUUID', label: 'lead', lookup: 'leads', prefix: 'Cle' },
    { key: 'CrmOpportunityCopUUID', label: 'opportunity', lookup: 'opportunities', prefix: 'Cop' },
    {
      key: 'CatKind',
      label: 'kind',
      options: ['task', 'call', 'meeting', 'email'],
      initial: 'task',
      required: true,
    },
    { key: 'CatDueAt', label: 'dueAt', type: 'datetime-local', required: true },
    {
      key: 'CatState',
      label: 'state',
      options: ['planned', 'done', 'cancelled'],
      initial: 'planned',
      required: true,
    },
    { key: 'CatNotes', label: 'notes', type: 'textarea', max: 4000 },
    status('CatStatus'),
  ],
};
export const CONVERSION_FIELDS: CrmField[] = [
  { key: 'stageUUID', label: 'stage', lookup: 'stages', prefix: 'Cst', required: true },
  { key: 'currency', label: 'currency', max: 3 },
];
const preserved: Record<CrmSection, string[]> = {
  leads: ['RegIndustryRinUUID', 'CrmSourceCsoUUID', 'CrmProductCprUUID'],
  opportunities: ['CrmContactCcoUUID', 'CrmSourceCsoUUID'],
  activities: [],
};
export function crmFormValues(fields: CrmField[], row: CrmRow | null): CrmRow {
  return Object.fromEntries(
    fields.map((field) => {
      let value = row?.[field.key] ?? field.initial ?? '';
      if (field.type === 'datetime-local' && value) {
        const instant = new Date(String(value));
        value = Number.isFinite(instant.getTime())
          ? new Date(instant.getTime() - instant.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16)
          : '';
      }
      return [field.key, value];
    }),
  );
}
export function crmFormPayload(
  section: CrmSection,
  values: CrmRow,
  original: CrmRow | null,
  conversion: boolean,
): CrmRow {
  const fields = conversion ? CONVERSION_FIELDS : CRM_FIELDS[section];
  const result: CrmRow = {};
  for (const field of fields) {
    const value = values[field.key];
    result[field.key] =
      value === '' || value == null
        ? null
        : field.type === 'number' || field.type === 'status'
          ? Number(value)
          : field.type === 'datetime-local'
            ? new Date(String(value)).toISOString()
            : value;
  }
  if (conversion) result['revision'] = original?.['CleRevision'] ?? null;
  else {
    for (const key of preserved[section]) result[key] = original?.[key] ?? null;
    if (original)
      result[CRM_PREFIX[section] + 'Revision'] = original[CRM_PREFIX[section] + 'Revision'];
  }
  return result;
}
