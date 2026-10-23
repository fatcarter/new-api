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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { usePricingData } from '../use-pricing-data'

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: null }),
}))

afterEach(() => vi.restoreAllMocks())

it('attaches the performance summary returned with the pricing catalog', async () => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: [
        {
          id: 1,
          model_name: 'measured-model',
          quota_type: 0,
          model_ratio: 1,
          completion_ratio: 1,
          enable_groups: ['default'],
        },
        {
          id: 2,
          model_name: 'unmeasured-model',
          quota_type: 0,
          model_ratio: 1,
          completion_ratio: 1,
          enable_groups: ['default'],
        },
      ],
      vendors: [],
      group_ratio: {},
      usable_group: {},
      supported_endpoint: {},
      auto_groups: [],
      perf_metrics: {
        'measured-model': {
          model_name: 'measured-model',
          avg_latency_ms: 900,
          avg_tps: 12.5,
          success_rate: 99.5,
          recent_success_series: [{ ts: 3600, success_rate: 100 }],
        },
      },
    },
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = (props: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  )

  const { result } = renderHook(() => usePricingData(), { wrapper })

  await waitFor(() => expect(result.current.models).toHaveLength(2))
  expect(result.current.models[0].perf).toEqual({
    model_name: 'measured-model',
    avg_latency_ms: 900,
    avg_tps: 12.5,
    success_rate: 99.5,
    recent_success_series: [{ ts: 3600, success_rate: 100 }],
  })
  expect(result.current.models[1].perf).toBeUndefined()
})
