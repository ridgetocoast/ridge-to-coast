// P3 #20 — /v1/calendar?zone=&month=
// Returns monthly planting tasks for a hardiness zone
// TODO: bundle PLANTING_CALENDAR from app/lib/geo-data.js at build time

export async function handleCalendar(request) {
  const params = new URL(request.url).searchParams;
  const zone = params.get('zone');
  const month = parseInt(params.get('month'), 10);

  if (!zone) {
    return Response.json({ error: 'zone is required' }, { status: 400 });
  }
  if (isNaN(month) || month < 1 || month > 12) {
    return Response.json({ error: 'month must be 1–12' }, { status: 400 });
  }

  // Hello world — replace with PLANTING_CALENDAR lookup (P3 #20)
  return Response.json({
    zone,
    month,
    monthName: new Date(2000, month - 1).toLocaleString('en-US', { month: 'long' }),
    startIndoors: ['Basil', 'Sweet potatoes'],
    directSow: ['Beans', 'Cucumber', 'Squash'],
    transplant: ['Tomatoes', 'Peppers', 'Eggplant'],
    harvest: ['Lettuce', 'Peas', 'Spinach'],
    notes: 'Last frost typically mid-March. Safe to plant warm-season crops.',
    _note: 'hello world — static response, real lookup coming in P3 #20',
  });
}
