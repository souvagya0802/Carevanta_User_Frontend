import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StepBar } from './primitives';

const steps = ['Place', 'Time', 'Patient', 'Confirm'];

describe('StepBar', () => {
  it('ticks finished steps, highlights the current one and leaves the rest upcoming', () => {
    render(<StepBar steps={steps} current={2} />);
    expect(screen.getByLabelText('Place: done')).toBeTruthy();
    expect(screen.getByLabelText('Time: done')).toBeTruthy();
    expect(screen.getByLabelText('Patient: current').getAttribute('aria-current')).toBe('step');
    expect(screen.getByLabelText('Confirm: upcoming').textContent).toBe('4');
    // Done steps show a tick, not their number.
    expect(screen.getByLabelText('Place: done').textContent).toBe('');
  });

  it('keeps the last step pending while a request awaits the provider, and turns it green only once confirmed', () => {
    const { rerender } = render(<StepBar steps={steps} current={3} />);
    expect(screen.getByLabelText('Confirm: current')).toBeTruthy();
    rerender(<StepBar steps={steps} current={steps.length} />);
    expect(screen.getByLabelText('Confirm: done')).toBeTruthy();
    expect(screen.queryByRole('listitem', { current: 'step' })).toBeNull();
  });
});
