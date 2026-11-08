import { describe, expect, it } from 'vitest';
import { levelOf, parseSse, toAlert } from './live-alerts';

describe('live alerts: server-sent events parser', () => {
  it('reads complete events and keeps the unfinished tail for the next chunk', () => {
    const { events, rest } = parseSse('event: notification\ndata: {"id":"a"}\n\n: heartbeat\n\nevent: read\ndata: {"ids":["a"]}\n\nevent: notif');
    expect(events).toEqual([{ event: 'notification', data: '{"id":"a"}' }, { event: 'read', data: '{"ids":["a"]}' }]);
    expect(rest).toBe('event: notif');
  });

  it('handles Windows line endings, multi-line data and a missing event name', () => {
    const { events } = parseSse('data: line one\r\ndata: line two\r\n\r\n');
    expect(events).toEqual([{ event: 'message', data: 'line one\nline two' }]);
  });

  it('ignores comments and blocks without data', () => {
    expect(parseSse(': ping\n\nevent: x\n\n').events).toEqual([]);
  });
});

describe('live alerts: levels', () => {
  it('uses the level the server sends', () => {
    expect(levelOf({ level: 'critical', templateKey: 'anything', title: '' })).toBe('critical');
    expect(levelOf({ level: 'light', templateKey: 'appointment.confirmed', title: '' })).toBe('light');
  });

  it('falls back by notification type for older notifications', () => {
    expect(levelOf({ templateKey: 'portal.dispatch_offer', title: 'Emergency request' })).toBe('critical');
    expect(levelOf({ templateKey: 'appointment.confirmed', title: 'Appointment confirmed' })).toBe('important');
    expect(levelOf({ templateKey: 'appointment.checked_in', title: 'You are checked in' })).toBe('light');
    expect(levelOf({ templateKey: 'something.new', title: 'x' })).toBe('light');
  });

  it('never pops up for a walk-in the desk recorded itself', () => {
    expect(levelOf({ templateKey: 'portal.appointment_booked', title: 'Walk-in recorded' })).toBe('light');
    expect(levelOf({ templateKey: 'portal.appointment_booked', title: 'New appointment request' })).toBe('important');
  });

  it('turns an API row into an alert with safe defaults', () => {
    const a = toAlert({ id: 'n1', templateKey: 'patient.report_published', title: null, body: null, link: '/orders/lab/1', createdAt: '2026-11-08T10:00:00.000Z' });
    expect(a).toMatchObject({ id: 'n1', level: 'important', title: 'Notification', body: '', link: '/orders/lab/1', meta: null });
  });
});
