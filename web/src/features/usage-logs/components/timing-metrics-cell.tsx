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
import { CircleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  dotColorMap,
  textColorMap,
  type StatusVariant,
} from '@/components/status-badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatUseTime } from '@/lib/format'
import { cn } from '@/lib/utils'

import { getFirstResponseTimeColor, getResponseTimeColor } from '../lib/format'
import type { LogOtherData } from '../types'

/**
 * Softened fills for the full-height timing bar. The bar sits directly beside
 * dense numeric text, so the saturated `dotColorMap` tones (tuned for small
 * dots and badges) read as too high-contrast at that size; a translucent fill
 * keeps the status legible while matching the page's muted palette.
 */
const barColorMap: Record<StatusVariant, string> = {
  ...dotColorMap,
  success: 'bg-success/90',
  warning: 'bg-warning/80',
  danger: 'bg-destructive/80',
  neutral: 'bg-neutral/80',
}

const LIVE_FRACTION_DIGITS = 2

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * A duration that advances on every animation frame while a request is in
 * flight, so it keeps moving between one-second list polls instead of
 * stepping once per refresh.
 *
 * `seconds` is the latest server snapshot, which carries millisecond precision
 * for in-flight rows. The clock re-anchors on every snapshot and never moves
 * backwards: a snapshot that arrives a little late (or coarser than the local
 * estimate) must not make the number stutter.
 */
function LiveSeconds(props: {
  seconds: number
  live: boolean
  className?: string
}) {
  const animate = props.live && !prefersReducedMotion()
  const [display, setDisplay] = useState(props.seconds)
  const shownRef = useRef(props.seconds)
  const anchorRef = useRef<{ seconds: number; at: number } | null>(null)

  useEffect(() => {
    anchorRef.current = { seconds: props.seconds, at: performance.now() }
    if (!animate) {
      shownRef.current = props.seconds
    }
  }, [props.seconds, animate])

  useEffect(() => {
    if (!animate) return
    let frame = 0
    const tick = () => {
      const anchor = anchorRef.current
      if (anchor) {
        const next = Math.max(
          shownRef.current,
          anchor.seconds + (performance.now() - anchor.at) / 1000
        )
        shownRef.current = next
        setDisplay(next)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animate])

  return (
    <span className={cn('tabular-nums', props.className)}>
      {formatUseTime(
        animate ? display : props.seconds,
        animate ? LIVE_FRACTION_DIGITS : undefined
      )}
    </span>
  )
}

interface TimingMetricsCellProps {
  useTimeSec: number
  completionTokens: number
  frtMs?: number
  isStream: boolean
  /** The request is still in flight, so the duration keeps growing. */
  pending?: boolean
  /**
   * Milliseconds elapsed when the in-flight snapshot was produced. It is the
   * anchor for the live duration clock; without it the clock falls back to the
   * whole-second duration.
   */
  pendingElapsedMs?: number | null
  className?: string
  /**
   * `bar` (default) draws a full-height color segment beside the labels,
   * matching the dense desktop table. `dot` swaps that segment for small
   * status dots inline with each label, matching the lighter-weight status
   * indicator used elsewhere on the mobile card.
   */
  indicator?: 'bar' | 'dot'
  compact?: boolean
}

export function TimingMetricsCell(props: TimingMetricsCellProps) {
  const { t } = useTranslation()
  const indicator = props.indicator ?? 'bar'
  const showFirstToken = props.isStream
  const firstTokenSeconds =
    props.frtMs != null && props.frtMs > 0 ? props.frtMs / 1000 : null
  const pending = props.pending ?? false
  const pendingElapsedSeconds =
    pending && props.pendingElapsedMs != null && props.pendingElapsedMs >= 0
      ? props.pendingElapsedMs / 1000
      : null
  let firstTokenVariant: StatusVariant = 'neutral'
  if (firstTokenSeconds != null) {
    // Once the first byte has arrived the first-token latency is fixed and can
    // be colored by its own threshold, even while the response is streaming.
    firstTokenVariant = getFirstResponseTimeColor(firstTokenSeconds)
  } else if (pending) {
    firstTokenVariant = 'info'
  }
  let totalTimeVariant: StatusVariant = 'info'
  if (!pending) {
    totalTimeVariant = getResponseTimeColor(
      props.useTimeSec,
      props.completionTokens
    )
  }

  const labels = (
    <div
      className={cn(
        'flex min-h-8 min-w-0 flex-col justify-center gap-0.5 text-xs leading-tight',
        props.compact &&
          'min-h-0 flex-row flex-wrap items-center gap-x-2.5 gap-y-1'
      )}
    >
      {showFirstToken && (
        <div className='flex items-baseline gap-1.5'>
          {indicator === 'dot' && (
            <span
              aria-hidden
              className={cn(
                'size-1.5 shrink-0 rounded-full',
                dotColorMap[firstTokenVariant]
              )}
            />
          )}
          <span className='text-muted-foreground shrink-0'>
            {t('First token')}
          </span>
          {firstTokenSeconds == null ? (
            <span
              className={cn('tabular-nums', textColorMap[firstTokenVariant])}
            >
              {t('N/A')}
            </span>
          ) : (
            <span
              className={cn('tabular-nums', textColorMap[firstTokenVariant])}
            >
              {formatUseTime(firstTokenSeconds)}
            </span>
          )}
        </div>
      )}
      <div className='flex items-baseline gap-1.5'>
        {indicator === 'dot' && (
          <span
            aria-hidden
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              dotColorMap[totalTimeVariant]
            )}
          />
        )}
        <span className='text-muted-foreground shrink-0'>{t('Duration')}</span>
        <LiveSeconds
          seconds={pendingElapsedSeconds ?? props.useTimeSec}
          live={pending}
          className={textColorMap[totalTimeVariant]}
        />
      </div>
    </div>
  )

  if (indicator === 'dot') {
    return (
      <div className={cn('flex items-stretch', props.className)}>{labels}</div>
    )
  }

  return (
    <div className={cn('flex items-stretch gap-2', props.className)}>
      <span
        aria-hidden
        className={cn(
          'flex w-1 shrink-0 flex-col overflow-hidden rounded-full',
          !showFirstToken && barColorMap[totalTimeVariant]
        )}
      >
        {showFirstToken && (
          <>
            <span className={cn('flex-1', barColorMap[firstTokenVariant])} />
            <span className={cn('flex-1', barColorMap[totalTimeVariant])} />
          </>
        )}
      </span>
      {labels}
    </div>
  )
}

interface StreamTpsCellProps {
  isStream: boolean
  compact?: boolean
  /** Task logs are asynchronous jobs; stream vs non-stream does not apply. */
  isTask?: boolean
  /** The task request returned its result inline, so it is a synchronous call. */
  isSyncTask?: boolean
  tokensPerSecond?: number | null
  streamStatus?: LogOtherData['stream_status']
  className?: string
}

export function StreamTpsCell(props: StreamTpsCellProps) {
  const { t } = useTranslation()
  const showStreamError =
    props.isStream && props.streamStatus && props.streamStatus.status !== 'ok'
  const tpsLabel =
    props.tokensPerSecond != null
      ? `${Math.round(props.tokensPerSecond)} t/s`
      : '—'
  let streamLabel = props.isStream ? t('Stream') : t('Non-stream')
  if (props.isTask) {
    streamLabel = props.isSyncTask ? t('Sync') : t('Async')
  }

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-start justify-center gap-0.5 text-xs leading-tight',
        props.compact && 'flex-row flex-wrap items-center gap-1.5',
        props.className
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1 font-medium',
          props.isStream ? 'text-info' : 'text-muted-foreground'
        )}
      >
        {streamLabel}
        {showStreamError && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={<CircleAlert className='text-destructive size-3' />}
              />
              <TooltipContent>
                <div className='space-y-0.5 text-xs'>
                  <p>
                    {t('Stream Status')}: {t('Error')}
                  </p>
                  <p>{props.streamStatus?.end_reason || 'unknown'}</p>
                  {(props.streamStatus?.error_count ?? 0) > 0 && (
                    <p>
                      {t('Soft Errors')}: {props.streamStatus?.error_count}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
      {(!props.compact ||
        (props.isStream && props.tokensPerSecond != null)) && (
        <span className='text-muted-foreground/60 px-0.5 tabular-nums'>
          {tpsLabel}
        </span>
      )}
    </div>
  )
}
