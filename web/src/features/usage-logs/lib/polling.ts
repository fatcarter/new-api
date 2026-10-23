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
/**
 * Polling cadence for the usage-log list.
 *
 * The backend merges in-flight requests into the first page, so the same
 * request both refreshes rendered rows and discovers new in-flight ones.
 * Two cadences keep that cheap:
 *
 * - hot: a rendered in-flight row keeps refreshing until it reaches a terminal
 *   state, even when auto refresh is off. Polling only new rows while the
 *   visible ones are frozen would leave them growing forever.
 * - idle: with auto refresh on and nothing in flight, poll slowly. A new
 *   request appears within a few seconds, while an idle page stops hammering
 *   the log database.
 *
 * `refetchIntervalInBackground: false` supplies the last rule: react-query
 * suspends both cadences while the tab is hidden. Re-armed after every result,
 * the interval never overlaps an in-flight request.
 */
export const PENDING_LOGS_POLL_INTERVAL_MS = 1000

export const IDLE_LOGS_POLL_INTERVAL_MS = 5000

export interface LogsPollingInput {
  /** At least one rendered row is still in flight. */
  hasPendingLogs: boolean
  /** The page-level auto refresh toggle is on. */
  autoRefresh: boolean
}

/** A log list carries in-flight rows only for the common consume/error logs. */
export function hasPendingLogs(items: readonly unknown[]): boolean {
  return items.some(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'pending' in item &&
      item.pending === true
  )
}

export function resolveLogsRefetchInterval(
  input: LogsPollingInput
): number | false {
  if (input.hasPendingLogs) return PENDING_LOGS_POLL_INTERVAL_MS
  if (input.autoRefresh) return IDLE_LOGS_POLL_INTERVAL_MS
  return false
}
