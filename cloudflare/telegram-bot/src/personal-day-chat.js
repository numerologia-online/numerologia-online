import g01 from '../../../data/day/general/general-day-01.json';
import p01 from '../../../data/day/practical/practical-day-01.json';
import g02 from '../../../data/day/general/general-day-02.json';
import p02 from '../../../data/day/practical/practical-day-02.json';
import g03 from '../../../data/day/general/general-day-03.json';
import p03 from '../../../data/day/practical/practical-day-03.json';
import g04 from '../../../data/day/general/general-day-04.json';
import p04 from '../../../data/day/practical/practical-day-04.json';
import g05 from '../../../data/day/general/general-day-05.json';
import p05 from '../../../data/day/practical/practical-day-05.json';
import g06 from '../../../data/day/general/general-day-06.json';
import p06 from '../../../data/day/practical/practical-day-06.json';
import g07 from '../../../data/day/general/general-day-07.json';
import p07 from '../../../data/day/practical/practical-day-07.json';
import g08 from '../../../data/day/general/general-day-08.json';
import p08 from '../../../data/day/practical/practical-day-08.json';
import g09 from '../../../data/day/general/general-day-09.json';
import p09 from '../../../data/day/practical/practical-day-09.json';
import g10 from '../../../data/day/general/general-day-10.json';
import p10 from '../../../data/day/practical/practical-day-10.json';
import g11 from '../../../data/day/general/general-day-11.json';
import p11 from '../../../data/day/practical/practical-day-11.json';
import g12 from '../../../data/day/general/general-day-12.json';
import p12 from '../../../data/day/practical/practical-day-12.json';
import g13 from '../../../data/day/general/general-day-13.json';
import p13 from '../../../data/day/practical/practical-day-13.json';
import g14 from '../../../data/day/general/general-day-14.json';
import p14 from '../../../data/day/practical/practical-day-14.json';
import g15 from '../../../data/day/general/general-day-15.json';
import p15 from '../../../data/day/practical/practical-day-15.json';
import g16 from '../../../data/day/general/general-day-16.json';
import p16 from '../../../data/day/practical/practical-day-16.json';
import g17 from '../../../data/day/general/general-day-17.json';
import p17 from '../../../data/day/practical/practical-day-17.json';
import g18 from '../../../data/day/general/general-day-18.json';
import p18 from '../../../data/day/practical/practical-day-18.json';
import g19 from '../../../data/day/general/general-day-19.json';
import p19 from '../../../data/day/practical/practical-day-19.json';
import g20 from '../../../data/day/general/general-day-20.json';
import p20 from '../../../data/day/practical/practical-day-20.json';
import g21 from '../../../data/day/general/general-day-21.json';
import p21 from '../../../data/day/practical/practical-day-21.json';
import g22 from '../../../data/day/general/general-day-22.json';
import p22 from '../../../data/day/practical/practical-day-22.json';

const GENERAL_BANKS = [null, g01, g02, g03, g04, g05, g06, g07, g08, g09, g10, g11, g12, g13, g14, g15, g16, g17, g18, g19, g20, g21, g22];
const PRACTICAL_BANKS = [null, p01, p02, p03, p04, p05, p06, p07, p08, p09, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21, p22];

/**
 * Telegram presentation of the exact personal-day calculation from
 * ../../../personal-day-feature.js. Source banks are bundled into the Worker:
 * no public endpoints are used to reveal future paid materials.
 * Free testing is controlled separately by the Telegram webhook route.
 */
const MONTH_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];
const MONTH_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const sumYearDigits = (year) => String(year).split('').reduce((sum, digit) => sum + Number(digit), 0);
const reduce9 = (value) => {
  let n = Math.abs(Math.trunc(Number(value) || 0));
  while (n > 9) n = String(n).split('').reduce((sum, digit) => sum + Number(digit), 0);
  return n || 9;
};
const reduce22 = (value) => {
  let n = Math.abs(Math.trunc(Number(value) || 0));
  while (n > 22) n -= 22;
  return n || 22;
};
const reduce31 = (value) => {
  let n = Math.abs(Math.trunc(Number(value) || 0));
  while (n > 31) n -= 31;
  return n || 31;
};
const lifePathNumber = ({ day, month, year }) => {
  let n = sumYearDigits(day) + sumYearDigits(month) + sumYearDigits(year);
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    n = String(n).split('').reduce((sum, digit) => sum + Number(digit), 0);
  }
  return n;
};
const personalDay = ({ day, month, year }, date) => {
  const today = date.getUTCDate();
  const currentMonth = date.getUTCMonth() + 1;
  const currentYear = date.getUTCFullYear();
  const personalYear = reduce9(day + month + sumYearDigits(currentYear));
  const personalMonth = reduce9(personalYear + currentMonth);
  const personalDayNumber = reduce9(personalMonth + today);
  const universalDay = reduce9(today + currentMonth + sumYearDigits(currentYear));
  const lifePath = lifePathNumber({ day, month, year });
  const energy = reduce22(personalDayNumber + personalMonth + universalDay + day + currentMonth);
  const personalNumber = reduce31(lifePath + day + today + sumYearDigits(year));
  return { energy, personalNumber };
};
function dateParts(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, date };
}
export function todayInMoscow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const get = (key) => parts.find(x => x.type === key)?.value;
  return get('year') + '-' + get('month') + '-' + get('day');
}
export function russianDate(iso) {
  const date = dateParts(iso);
  if (!date) return null;
  return date.day + ' ' + MONTH_GENITIVE[date.month - 1] + ' ' + date.year;
}
export function personalDayMessage(birthISO, targetISO) {
  const birth = dateParts(birthISO);
  const target = dateParts(targetISO);
  if (!birth || !target || target.date < birth.date) return null;
  const { energy, personalNumber } = personalDay(birth, target.date);
  const key = String(personalNumber);
  const entry = GENERAL_BANKS[energy]?.entries?.[key]
    ?? GENERAL_BANKS[energy]?.entries?.[energy + '-' + key];
  const advice = PRACTICAL_BANKS[energy]?.entries?.[key]
    ?? PRACTICAL_BANKS[energy]?.entries?.[energy + '-' + key] ?? {};
  if (!entry?.text) return null;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const list = (items) => Array.isArray(items) ? items.map(x => '• ' + esc(x)).join('\n') : '';
  let result = '<b>☀️ Твой личный расчёт дня</b>\n'
    + russianDate(targetISO) + '\n\n' + esc(entry.text);
  if (advice.todayNeed?.length) result += '\n\n<b>✅ Сегодня нужно</b>\n' + list(advice.todayNeed);
  if (advice.todayAvoid?.length) result += '\n\n<b>⛔ Сегодня нельзя</b>\n' + list(advice.todayAvoid);
  return result.length <= 4000 ? result : null;
}
export function calendarView(monthISO, currentISO = todayInMoscow()) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthISO);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const prev = new Date(Date.UTC(year, month - 2, 1));
  const next = new Date(Date.UTC(year, month, 1));
  const pad = n => String(n).padStart(2, '0');
  const prevMonth = prev.getUTCFullYear() + '-' + pad(prev.getUTCMonth() + 1);
  const nextMonth = next.getUTCFullYear() + '-' + pad(next.getUTCMonth() + 1);
  const firstWeekday = (start.getUTCDay() + 6) % 7;
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const keyboard = [[
    { text: '‹', callback_data: 'pd_month:' + prevMonth },
    { text: MONTH_NOMINATIVE[month - 1] + ' ' + year, callback_data: 'pd_ignore' },
    { text: '›', callback_data: 'pd_month:' + nextMonth },
  ]];
  keyboard.push(WEEKDAYS.map(text => ({ text, callback_data: 'pd_ignore' })));
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  for (let i = 0; i < cells.length; i += 7) {
    keyboard.push(cells.slice(i, i + 7).map(day => {
      if (day === null) return { text: '·', callback_data: 'pd_ignore' };
      const iso = year + '-' + pad(month) + '-' + pad(day);
      return { text: iso === currentISO ? '☀' + day : String(day), callback_data: 'pd_date:' + iso };
    }));
  }
  return {
    text: '📅 <b>Твой календарь</b>\nВыбери любую дату - расчёт придёт прямо сюда 🤍',
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  };
}
export function validDayCallback(value) {
  return value === 'pd_open' || value === 'pd_ignore'
    || (value.startsWith('pd_month:') && calendarView(value.slice(9)) !== null)
    || (value.startsWith('pd_date:') && dateParts(value.slice(8)) !== null);
}
