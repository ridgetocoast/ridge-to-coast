// P3 #20 — /v1/calendar?zone=&month=
// Returns monthly planting tasks for a hardiness zone
// TODO: bundle PLANTING_CALENDAR from app/lib/geo-data.js at build time

export async function handleCalendar(params) {
  const zone = params.get('zone');
  const month = parseInt(params.get('month'), 10);

  if (!zone) {
    return Response.json({ error: 'zone is required' }, { status: 400 });
  }
  if (isNaN(month) || month < 1 || month > 12) {
    return Response.json({ error: 'month must be 1–12' }, { status: 400 });
  }

  // Stub — replace with PLANTING_CALENDAR lookup
  return Response.json({
    zone,
    month,
    monthName: new Date(2000, month - 1).toLocaleString('en-US', { month: 'long' }),
    startIndoors: [],
    directSow: [],
    transplant: [],
    harvest: [],
    notes: null,
    _status: 'not implemented — see P3 issue #20',
  }, { status: 501 });
}
