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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  DEFAULT_PRICING_PAGE_SIZE,
  DEFAULT_TOKEN_UNIT,
  PRICING_PAGE_SIZE_OPTIONS,
} from '../constants'
import type { PricingModel, TokenUnit } from '../types'
import { ModelCard } from './model-card'

const PAGE_SIZE_ITEMS = PRICING_PAGE_SIZE_OPTIONS.map((size) => ({
  value: `${size}`,
  label: size,
}))

export interface ModelCardGridProps {
  models: PricingModel[]
  onModelClick: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
}

export const ModelCardGrid = memo(function ModelCardGrid(
  props: ModelCardGridProps
) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PRICING_PAGE_SIZE)
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const totalPages = Math.max(1, Math.ceil(props.models.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  const pagedModels = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return props.models.slice(start, start + pageSize)
  }, [currentPage, pageSize, props.models])

  if (props.models.length === 0) {
    return null
  }

  return (
    <div className='flex flex-col gap-4 sm:gap-5'>
      <div className='grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {pagedModels.map((model) => (
          <ModelCard
            key={model.id ?? model.model_name}
            model={model}
            tokenUnit={tokenUnit}
            priceRate={props.priceRate}
            usdExchangeRate={props.usdExchangeRate}
            showRechargePrice={props.showRechargePrice}
            selectedGroup={props.selectedGroup}
            perf={model.perf}
            onClick={props.onModelClick}
          />
        ))}
      </div>

      <div className='text-muted-foreground flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm sm:flex-row'>
        <p className='text-muted-foreground'>
          {t('Page {{current}} of {{total}}', {
            current: currentPage,
            total: totalPages,
          })}
        </p>
        <div className='flex flex-wrap items-center justify-center gap-3'>
          <div className='flex items-center gap-1.5'>
            <span className='text-muted-foreground/80 text-sm font-medium whitespace-nowrap'>
              {t('Rows per page')}
            </span>
            <Select
              items={PAGE_SIZE_ITEMS}
              value={`${pageSize}`}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setPage(1)
              }}
            >
              <SelectTrigger className='text-foreground h-8 w-[64px] font-medium tabular-nums sm:w-[70px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent side='top' alignItemWithTrigger={false}>
                <SelectGroup>
                  {PRICING_PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
              className='gap-1.5'
            >
              <ChevronLeft className='size-4' />
              {t('Previous page')}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={currentPage >= totalPages}
              className='gap-1.5'
            >
              {t('Next page')}
              <ChevronRight className='size-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
})
