/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TimingMetricsCell } from '../timing-metrics-cell'

/**
 * The shared test setup prefers reduced motion, which renders the server
 * snapshot without a clock. These cases exercise the live clock, so they
 * opt out and drive animation frames by hand.
 */
function allowMotion() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })
}

let now = 0
let frames: FrameRequestCallback[] = []

function advanceFramesBy(ms: number) {
  now += ms
  act(() => {
    const pending = frames
    frames = []
    for (const frame of pending) frame(now)
  })
}

beforeEach(() => {
  allowMotion()
  now = 1000
  frames = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback)
    return frames.length
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  vi.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TimingMetricsCell in-flight clock', () => {
  it('advances the duration between polls', () => {
    render(
      <TimingMetricsCell
        useTimeSec={12}
        completionTokens={0}
        isStream={false}
        pending
        pendingElapsedMs={12000}
      />
    )
    expect(screen.getByText('12.00s')).toBeVisible()

    advanceFramesBy(250)
    expect(screen.getByText('12.25s')).toBeVisible()

    advanceFramesBy(250)
    expect(screen.getByText('12.50s')).toBeVisible()
  })

  it('keeps the clock monotonically increasing when a late snapshot lags behind', () => {
    const { rerender } = render(
      <TimingMetricsCell
        useTimeSec={12}
        completionTokens={0}
        isStream={false}
        pending
        pendingElapsedMs={12000}
      />
    )
    advanceFramesBy(800)
    expect(screen.getByText('12.80s')).toBeVisible()

    rerender(
      <TimingMetricsCell
        useTimeSec={12}
        completionTokens={0}
        isStream={false}
        pending
        pendingElapsedMs={12750}
      />
    )
    expect(screen.getByText('12.80s')).toBeVisible()
  })

  it('freezes the first-token latency once the upstream has answered', () => {
    render(
      <TimingMetricsCell
        useTimeSec={12}
        completionTokens={0}
        frtMs={3000}
        isStream
        pending
        pendingElapsedMs={12000}
      />
    )
    expect(screen.getByText('3.0s')).toBeVisible()

    advanceFramesBy(500)
    expect(screen.getByText('3.0s')).toBeVisible()
    expect(screen.getByText('12.50s')).toBeVisible()
  })

  it('shows the final duration once the request is no longer in flight', () => {
    const { rerender } = render(
      <TimingMetricsCell
        useTimeSec={12}
        completionTokens={0}
        isStream={false}
        pending
        pendingElapsedMs={12000}
      />
    )
    advanceFramesBy(300)

    rerender(
      <TimingMetricsCell
        useTimeSec={12.4}
        completionTokens={500}
        isStream={false}
      />
    )
    expect(screen.getByText('12.4s')).toBeVisible()
  })
})
