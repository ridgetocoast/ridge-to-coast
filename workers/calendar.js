// workers/calendar.js — /v1/calendar?zone=&month=
import core from '../app/lib/geo-data-core.js';

const MONTH_ABBREV = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH_NAME = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export async function handleCalendar(request) {
  try {
    const params = new URL(request.url).searchParams;
    const zone = params.get('zone');
    const monthRaw = params.get('month');
    const month = parseInt(monthRaw, 10);

    if (!zone) {
      return Response.json({ error: 'zone is required' }, { status: 400 });
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return Response.json({ error: 'month must be an integer 1–12' }, { status: 400 });
    }
    const zoneCalendar = core.PLANTING_CALENDAR[zone];
    if (!zoneCalendar) {
      return Response.json({ error: 'Unknown hardiness zone' }, { status: 404 });
    }

    const entry = zoneCalendar[MONTH_ABBREV[month - 1]] || {};
    return Response.json({
      zone,
      month,
      monthName: MONTH_NAME[month - 1],
      startIndoors: entry.startIndoors || [],
      directSow:   entry.directSow   || [],
      transplant:  entry.transplant  || [],
    });
  } catch (err) {
    console.error('handleCalendar error', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
