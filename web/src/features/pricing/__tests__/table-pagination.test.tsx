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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { PricingTable } from '../components/pricing-table'
import type { PricingModel } from '../types'

function pricingModel(index: number): PricingModel {
  return {
    id: index,
    model_name: `model-${index}`,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
  }
}

describe('pricing table pagination', () => {
  it('offers the pricing page size options instead of the generic defaults', async () => {
    const user = userEvent.setup()
    render(<PricingTable models={[pricingModel(1)]} />)
    await user.click(screen.getByRole('combobox'))
    for (const size of ['10', '20', '50', '100', '1000']) {
      expect(await screen.findByRole('option', { name: size })).toBeVisible()
    }
    expect(screen.queryByRole('option', { name: '30' })).toBeNull()
  })

  it('applies the selected page size to the model list', async () => {
    const user = userEvent.setup()
    const models = Array.from({ length: 21 }, (_, index) =>
      pricingModel(index + 1)
    )
    render(<PricingTable models={models} />)
    expect(screen.getByText('model-20')).toBeVisible()
    expect(screen.queryByText('model-21')).toBeNull()
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: '10' }))
    expect(screen.getByText('model-10')).toBeVisible()
    expect(screen.queryByText('model-11')).toBeNull()
  })
})
