import { CRM_FIELDS, crmFormPayload, crmFormValues } from './crm-fields';

describe('CRM portal form boundaries', () => {
  it('sends only editable values, keeps observed revision and preserves unedited relationships', () => {
    const original = {
      CleUUID: 'record',
      CleRevision: 7,
      CleName: 'Name',
      CrmSourceCsoUUID: 'source',
      UserUsrUUID: 'tenant',
      AssignedUserUsrUUID: 'operator',
    };
    const values = crmFormValues(CRM_FIELDS.leads, original);
    const payload = crmFormPayload('leads', values, original, false);
    expect(payload['CleRevision']).toBe(7);
    expect(payload['CrmSourceCsoUUID']).toBe('source');
    expect(payload['UserUsrUUID']).toBeUndefined();
    expect(payload['AssignedUserUsrUUID']).toBeUndefined();
    expect(payload['CleUUID']).toBeUndefined();
  });
  it('serializes local dates to explicit UTC and keeps zero amounts', () => {
    const payload = crmFormPayload(
      'opportunities',
      { CopNextContactAt: '2030-02-03T12:30', CopAmountOnce: 0, CopAmountRecurring: '12.50' },
      null,
      false,
    );
    expect(payload['CopNextContactAt']).toBe(new Date('2030-02-03T12:30').toISOString());
    expect(payload['CopAmountOnce']).toBe(0);
    expect(payload['CopAmountRecurring']).toBe(12.5);
    expect(payload['CopRevision']).toBeUndefined();
  });
  it('conversion retains the observed lead revision and never sends actor or account ownership', () => {
    expect(
      crmFormPayload('leads', { stageUUID: 'stage', currency: '' }, { CleRevision: 3 }, true),
    ).toEqual({ stageUUID: 'stage', currency: null, revision: 3 });
  });
});
