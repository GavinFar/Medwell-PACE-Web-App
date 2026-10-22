// Temp Data I'll remove when real data is available its just to demo the volunterr dashboard

export const EVENTS = [
  { id: "health-fair", title: "Community wellness fair", host: "Arlington Community Partners", date: "Oct 24", isoDate: "2026-10-24", time: "9:00 AM – 12:00 PM", place: "Arlington Community Center", category: "Community health", description: "Welcome neighbors, help with event setup, and guide visitors to community resources. No clinical experience needed." },
  { id: "nutrition", title: "Good food, stronger communities", host: "Neighborhood Nutrition Collective", date: "Oct 28", isoDate: "2026-10-28", time: "10:00 AM – 1:00 PM", place: "Eastside Learning Center", category: "Health education", description: "Help prepare workshop materials and welcome families to a community nutrition session." },
  { id: "pantry", title: "A helping hand at the pantry", host: "Community Care Pantry", date: "Oct 31", isoDate: "2026-10-31", time: "8:30 AM – 11:30 AM", place: "Southside Community Pantry", category: "Community care", description: "Sort pantry donations and pack grocery boxes alongside a small team of neighborhood volunteers." },
];

export const HISTORY = [
  { title: "Neighborhood wellness day", host: "Arlington Community Partners", date: "Oct 17, 2026", points: 80 },
  { title: "Community pantry morning", host: "Community Care Pantry", date: "Oct 10, 2026", points: 80 },
  { title: "Family resource fair", host: "Arlington Community Partners", date: "Oct 3, 2026", points: 80 },
  { title: "Back-to-school supply drive", host: "Neighborhood Learning Collective", date: "Sep 26, 2026", points: 80 },
];

/** @param {typeof HISTORY} history */
export function summarize(history) {
  return {
    attended: history.length,
    points: history.reduce((total, entry) => total + entry.points, 0),
    achievements: [1, 3, 5].filter((target) => history.length >= target).length,
  };
}

/** @param {string[]} ids @param {string} eventId */
export function toggleRegistration(ids, eventId) {
  if (!EVENTS.some((event) => event.id === eventId)) return ids;
  return ids.includes(eventId) ? ids.filter((id) => id !== eventId) : [...ids, eventId];
}
