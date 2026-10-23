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
import type { StatusBadgeProps, StatusVariant } from '@/components/status-badge'

import type { UsageLog } from '../data/schema'
import { getLogTypeConfig } from './utils'

/**
 * Generic status mapping utility
 * Creates a function to map status values to labels and variants
 */
export function createStatusMapper<T extends string>(mapping: {
  [key in T]?: { label: string; variant: StatusBadgeProps['variant'] }
}) {
  return {
    getLabel: (status: string, defaultLabel = 'Unknown'): string => {
      return mapping[status as T]?.label ?? defaultLabel
    },
    getVariant: (
      status: string,
      defaultVariant: StatusBadgeProps['variant'] = 'neutral'
    ): StatusBadgeProps['variant'] => {
      return mapping[status as T]?.variant ?? defaultVariant
    },
  }
}

export interface LogStatusPresentation {
  label: string
  variant: StatusVariant
}

/**
 * Finished rows describe the log type; in-flight rows describe how far the
 * request has progressed, because their type is always "consume" until the
 * final row is written.
 */
export function resolveLogStatusBadge(
  log: Pick<UsageLog, 'pending' | 'pending_stage' | 'type'>,
  translate: (key: string) => string
): LogStatusPresentation {
  if (log.pending) {
    if (log.pending_stage === 'streaming') {
      return { label: translate('Receiving'), variant: 'info' }
    }
    return { label: translate('Waiting'), variant: 'neutral' }
  }
  const config = getLogTypeConfig(log.type)
  return {
    label: translate(config.label),
    variant: config.color as StatusVariant,
  }
}
