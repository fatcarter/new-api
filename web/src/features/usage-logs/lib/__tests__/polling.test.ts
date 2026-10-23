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
import { describe, expect, it } from 'vitest'

import {
  hasPendingLogs,
  IDLE_LOGS_POLL_INTERVAL_MS,
  PENDING_LOGS_POLL_INTERVAL_MS,
  resolveLogsRefetchInterval,
} from '../polling'

describe('hasPendingLogs', () => {
  it('detects in-flight rows in a mixed log page', () => {
    expect(
      hasPendingLogs([
        { id: 1 },
        { id: 2, pending: true },
        { id: 3, pending: false },
      ])
    ).toBe(true)
  })

  it('ignores pages without in-flight rows', () => {
    expect(hasPendingLogs([{ id: 1 }, { id: 2, pending: false }])).toBe(false)
    expect(hasPendingLogs([])).toBe(false)
  })
})

describe('resolveLogsRefetchInterval', () => {
  it('polls quickly while an in-flight row is rendered even with auto refresh off', () => {
    expect(
      resolveLogsRefetchInterval({ hasPendingLogs: true, autoRefresh: false })
    ).toBe(PENDING_LOGS_POLL_INTERVAL_MS)
  })

  it('polls slowly for new in-flight rows when auto refresh is on and nothing is in flight', () => {
    expect(
      resolveLogsRefetchInterval({ hasPendingLogs: false, autoRefresh: true })
    ).toBe(IDLE_LOGS_POLL_INTERVAL_MS)
  })

  it('stops polling when auto refresh is off and nothing is in flight', () => {
    expect(
      resolveLogsRefetchInterval({ hasPendingLogs: false, autoRefresh: false })
    ).toBe(false)
  })
})
