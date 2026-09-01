export const DEFAULT_RATES = {
    dayNow: 25,
    dayFuture: 30,
    nightNow: 30,
    nightFuture: 25
};

export function parseTimeToMinutes(value) {
    const raw = String(value || '').trim().toLowerCase()
        .replace('h', ':')
        .replace('hs', ':')
        .replace(/\s/g, '');

    if (!raw) return null;

    const match = raw.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    if (hours > 24 || minutes > 59) return null;
    if (hours === 24 && minutes !== 0) return null;
    return (hours % 24) * 60 + minutes;
}

export function formatClock(value) {
    const minutes = typeof value === 'number' ? value : parseTimeToMinutes(value);
    if (minutes == null) return String(value || '').trim();
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function formatDuration(totalMinutes) {
    const safe = Math.max(0, Math.round(Number(totalMinutes) || 0));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    if (h && m) return `${h}h${String(m).padStart(2, '0')}m`;
    if (h) return `${h}h`;
    return `${m}m`;
}

export function formatMoney(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function isNightAt(minuteOfDay, nightStart, nightEnd) {
    if (nightStart === nightEnd) return false;
    if (nightStart < nightEnd) return minuteOfDay >= nightStart && minuteOfDay < nightEnd;
    return minuteOfDay >= nightStart || minuteOfDay < nightEnd;
}

function nextBoundary(from, nightStart, nightEnd) {
    const day = Math.floor(from / 1440);
    const candidates = [nightStart, nightEnd]
        .flatMap(boundary => [day * 1440 + boundary, (day + 1) * 1440 + boundary])
        .filter(value => value > from);
    return Math.min(...candidates);
}

export function splitPeriod(startValue, endValue, nightStartValue, nightEndValue, force = '') {
    const start = parseTimeToMinutes(startValue);
    const endBase = parseTimeToMinutes(endValue);
    const nightStart = parseTimeToMinutes(nightStartValue) ?? 18 * 60;
    const nightEnd = parseTimeToMinutes(nightEndValue) ?? 6 * 60;

    if (start == null || endBase == null) {
        return { dayMinutes: 0, nightMinutes: 0, totalMinutes: 0 };
    }

    let end = endBase;
    if (end <= start) end += 1440;

    if (force === 'day') {
        return { dayMinutes: end - start, nightMinutes: 0, totalMinutes: end - start };
    }
    if (force === 'night') {
        return { dayMinutes: 0, nightMinutes: end - start, totalMinutes: end - start };
    }

    let cursor = start;
    let dayMinutes = 0;
    let nightMinutes = 0;

    while (cursor < end) {
        const sliceEnd = Math.min(end, nextBoundary(cursor, nightStart, nightEnd));
        const slice = sliceEnd - cursor;
        const minuteOfDay = ((cursor % 1440) + 1440) % 1440;
        if (isNightAt(minuteOfDay, nightStart, nightEnd)) nightMinutes += slice;
        else dayMinutes += slice;
        cursor = sliceEnd;
    }

    return { dayMinutes, nightMinutes, totalMinutes: end - start };
}

export function moneyFromMinutes(minutes, hourlyRate) {
    return Math.round((minutes / 60) * Number(hourlyRate || 0) * 100) / 100;
}

export function summarizeDay(day, project) {
    const rates = { ...DEFAULT_RATES, ...(project.rates || {}) };
    const periods = Array.isArray(day.periods) ? day.periods : [];

    const split = periods.reduce((acc, period) => {
        const part = splitPeriod(
            period.start,
            period.end,
            project.nightStart || '18:00',
            project.nightEnd || '06:00',
            period.force || ''
        );
        acc.dayMinutes += part.dayMinutes;
        acc.nightMinutes += part.nightMinutes;
        acc.totalMinutes += part.totalMinutes;
        return acc;
    }, { dayMinutes: 0, nightMinutes: 0, totalMinutes: 0 });

    const now = moneyFromMinutes(split.dayMinutes, rates.dayNow)
        + moneyFromMinutes(split.nightMinutes, rates.nightNow);
    const future = moneyFromMinutes(split.dayMinutes, rates.dayFuture)
        + moneyFromMinutes(split.nightMinutes, rates.nightFuture);

    return {
        ...split,
        now: Math.round(now * 100) / 100,
        future: Math.round(future * 100) / 100,
        total: Math.round((now + future) * 100) / 100
    };
}

export function summarizeProject(project) {
    const days = (project.days || []).map(day => ({
        day,
        stats: summarizeDay(day, project)
    }));

    const totals = days.reduce((acc, item) => {
        acc.dayMinutes += item.stats.dayMinutes;
        acc.nightMinutes += item.stats.nightMinutes;
        acc.totalMinutes += item.stats.totalMinutes;
        acc.now += item.stats.now;
        acc.future += item.stats.future;
        acc.total += item.stats.total;
        return acc;
    }, { dayMinutes: 0, nightMinutes: 0, totalMinutes: 0, now: 0, future: 0, total: 0 });

    return {
        days,
        totals: {
            ...totals,
            now: Math.round(totals.now * 100) / 100,
            future: Math.round(totals.future * 100) / 100,
            total: Math.round(totals.total * 100) / 100
        }
    };
}

function todayIso() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
}

export function dayHeading(dateValue) {
    if (!dateValue) return 'Dia';
    const [year, month, day] = String(dateValue).split('-');
    if (!day) return `Dia ${dateValue}`;
    const suffix = dateValue === todayIso() ? ' (hoje)' : '';
    return `Dia ${Number(day)}${suffix}`;
}

function hoursLine(stats) {
    const parts = [];
    if (stats.dayMinutes) parts.push(`${formatDuration(stats.dayMinutes)} diurna`);
    if (stats.nightMinutes) parts.push(`${formatDuration(stats.nightMinutes)} noturna`);
    if (!parts.length) return '0m';
    return parts.join(' e ');
}

function periodLine(day) {
    const periods = (day.periods || []).filter(period => period.start && period.end);
    if (!periods.length) return '';
    const label = periods.length > 1 ? 'Períodos de programação' : 'Período';
    const text = periods
        .map(period => `${formatClock(period.start)} → ${formatClock(period.end)}`)
        .join(' / ');
    return `${label}: ${text}`;
}

export function buildMessage(project) {
    const rates = { ...DEFAULT_RATES, ...(project.rates || {}) };
    const { days, totals } = summarizeProject(project);
    const dayRate = Number(rates.dayNow) + Number(rates.dayFuture);
    const nightRate = Number(rates.nightNow) + Number(rates.nightFuture);

    const lines = [
        '*Preço por hora:*',
        `Diurna: ${formatMoney(rates.dayNow)} agora + ${formatMoney(rates.dayFuture)} pago futuramente = ${formatMoney(dayRate)}/h`,
        `Noturna: ${formatMoney(rates.nightNow)} agora + ${formatMoney(rates.nightFuture)} pago futuramente = ${formatMoney(nightRate)}/h`
    ];

    for (const item of days) {
        const heading = dayHeading(item.day.date);
        lines.push('', `*${heading}:*`);
        if (item.day.content) lines.push(`Conteúdo: ${item.day.content}`);
        const periods = periodLine(item.day);
        if (periods) lines.push(periods);
        lines.push(`Total horas: ${hoursLine(item.stats)}`);
        lines.push(`*Total por agora: ${formatMoney(item.stats.now)}*`);
        if (item.stats.future) lines.push(`Total futuramente: ${formatMoney(item.stats.future)}`);
        lines.push(`Total do dia: ${formatMoney(item.stats.total)}`);
    }

    lines.push('', '*Total*');
    if (project.summary) {
        lines.push(`*O que foi feito:* ${project.summary}`);
        lines.push('');
    }
    lines.push(`Total de horas: ${formatDuration(totals.totalMinutes)}`);
    lines.push(`*Total por agora: ${formatMoney(totals.now)}*`);
    if (totals.future) lines.push(`Total futuramente: ${formatMoney(totals.future)}`);
    lines.push(`Total geral: ${formatMoney(totals.total)}`);

    return lines.join('\n');
}