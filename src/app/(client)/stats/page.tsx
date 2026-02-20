'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  ResponsiveContainer,
  PieChart,
  Pie,
} from 'recharts'
import { useStatsOverview } from '@/lib/hooks/stats'
import { BANNER_SUBJECT_TYPES } from '@/lib/constants/banner-subject-types'
import type { StatsParams } from '@/lib/api/stats'
import { SkeletonSummaryCard, SkeletonChartSection } from '../_components/skeleton'

const CHART_COLORS = ['#4f8ef7', '#f76d4f', '#4fc47a', '#f7c44f', '#a04ff7', '#4ff7e8']

function SummaryCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border border-[var(--line-base)] p-5">
      <p className="m-0 text-[12px] text-(--text-muted)">{label}</p>
      <p className="m-0 mt-1 text-2xl font-semibold tabular-nums">
        {value == null ? '—' : value.toLocaleString()}
      </p>
    </div>
  )
}

function ChartSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--line-base)] p-5">
      <h3 className="m-0 mb-4 text-[14px] font-semibold">{title}</h3>
      {children}
    </section>
  )
}

// recharts Tooltip의 formatter/labelFormatter는 value가 undefined일 수 있으므로 타입을 맞춤
const fmtCount = (value: number | undefined) => [(value ?? 0).toLocaleString(), '현수막 수'] as [string, string]
const fmtLabel = (label: unknown) => String(label)

function StatsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [fromInput, setFromInput] = useState(searchParams.get('from') ?? '')
  const [toInput, setToInput] = useState(searchParams.get('to') ?? '')
  const [regionInput, setRegionInput] = useState(searchParams.get('region') ?? '')
  const [region, setRegion] = useState(searchParams.get('region') ?? '')
  const [subjectType, setSubjectType] = useState(searchParams.get('subjectType') ?? '')
  const [hashtagInput, setHashtagInput] = useState(searchParams.get('hashtag') ?? '')
  const [hashtag, setHashtag] = useState(searchParams.get('hashtag') ?? '')

  const queryParams: StatsParams = {
    from: fromInput || undefined,
    to: toInput || undefined,
    region: region || undefined,
    subjectType: subjectType || undefined,
    hashtag: hashtag || undefined,
    limit: 10,
  }

  const { data, isPending, isError } = useStatsOverview(queryParams)

  const hasFilter = !!(fromInput || toInput || region || subjectType || hashtag)

  return (
    <div className="stack-lg">
      {/* 헤더 */}
      {/* <section className="grid gap-1">
        <h1 className="m-0">통계</h1>
        <p className="m-0 text-[13px] text-(--text-muted)">
          현수막 데이터 기반 탐색형 대시보드입니다.{' '}
          <span className="font-medium text-(--text-base)">
            현재 관측 수는 초기 업로드 기준이며 정확도가 제한될 수 있습니다.
          </span>
        </p>
      </section> */}

      {/* 필터 */}
      <section className="grid grid-cols-[1fr_1fr_2fr_1fr_1fr] gap-2 max-[1024px]:grid-cols-2 max-[640px]:grid-cols-1">
        <input
          type="date"
          value={fromInput}
          onChange={(e) => setFromInput(e.target.value)}
          title="시작일"
        />
        <input
          type="date"
          value={toInput}
          onChange={(e) => setToInput(e.target.value)}
          title="종료일"
        />
        <input
          type="text"
          placeholder="지역 검색 (Enter로 검색)"
          value={regionInput}
          onChange={(e) => setRegionInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setRegion(regionInput) }}
        />
        <select value={subjectType} onChange={(e) => setSubjectType(e.target.value)}>
          <option value="">주체 전체</option>
          {BANNER_SUBJECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="해시태그 (Enter로 검색)"
          value={hashtagInput}
          onChange={(e) => setHashtagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setHashtag(hashtagInput) }}
        />
      </section>

      {/* 필터 초기화 */}
      {hasFilter && (
        <button
          className="self-start text-[13px] text-(--text-muted) underline"
          onClick={() => {
            setFromInput('')
            setToInput('')
            setRegionInput('')
            setRegion('')
            setSubjectType('')
            setHashtagInput('')
            setHashtag('')
          }}
        >
          필터 초기화
        </button>
      )}

      {/* 로딩 */}
      {isPending && (
        <>
          <section className="grid grid-cols-3 gap-3 max-[640px]:grid-cols-1">
            <SkeletonSummaryCard />
            <SkeletonSummaryCard />
            <SkeletonSummaryCard />
          </section>
          <div className="grid grid-cols-2 gap-4 max-[768px]:grid-cols-1">
            <SkeletonChartSection />
            <SkeletonChartSection />
            <SkeletonChartSection />
            <SkeletonChartSection />
          </div>
        </>
      )}

      {/* 에러 */}
      {isError && (
        <p className="text-[13px] text-red-500">
          데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {/* 요약 카드 */}
      {data && (
        <section className="grid grid-cols-3 gap-3 max-[640px]:grid-cols-1">
          <SummaryCard label="총 현수막 수" value={data.summary.totalBanners} />
          <SummaryCard label="지역 수" value={data.summary.totalRegions} />
          <SummaryCard label="주체 유형 수" value={data.summary.totalSubjects} />
        </section>
      )}

      {/* 빈 데이터 */}
      {data && data.summary.totalBanners === 0 && (
        <p className="text-[13px] text-(--text-muted)">해당 조건에 맞는 데이터가 없습니다.</p>
      )}

      {/* 차트 영역 */}
      {data && data.summary.totalBanners > 0 && (
        <div className="grid grid-cols-2 gap-4 max-[768px]:grid-cols-1">
          {/* 차트 1: 지역별 Top 10 */}
          <ChartSection title="지역별 현수막 수 (Top 10)">
            {data.byRegion.length === 0 ? (
              <p className="text-[13px] text-(--text-muted)">데이터 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={data.byRegion}
                  layout="vertical"
                  margin={{ left: 8, right: 16, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="region"
                    width={90}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => (v.length > 8 ? v.slice(0, 8) + '…' : v)}
                  />
                  <Tooltip
                    formatter={fmtCount}
                    labelFormatter={(label) => `지역: ${fmtLabel(label)}`}
                  />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLORS[0]}
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(d: unknown) => {
                      const entry = d as { region: string }
                      if (entry?.region) { setRegionInput(entry.region); setRegion(entry.region) }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartSection>

          {/* 차트 2: 주체별 분포 */}
          <ChartSection title="주체별 현수막 분포">
            {data.bySubjectType.length === 0 ? (
              <p className="text-[13px] text-(--text-muted)">데이터 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.bySubjectType}
                    dataKey="count"
                    nameKey="subjectType"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={2}
                    fill={CHART_COLORS[0]}
                    label={(props: { name?: string; percent?: number; fill?: string }) => {
                      const pct = ((props.percent ?? 0) * 100).toFixed(0)
                      return `${props.name ?? ''} ${pct}%`
                    }}
                    labelLine={false}
                    cursor="pointer"
                    onClick={(d: unknown) => {
                      const entry = d as { subjectType: string }
                      if (entry?.subjectType && entry.subjectType !== '미분류') {
                        setSubjectType(entry.subjectType)
                      }
                    }}
                  />
                  <Tooltip
                    formatter={fmtCount}
                    labelFormatter={(label) => `주체: ${fmtLabel(label)}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartSection>

          {/* 차트 3: 해시태그 Top 10 */}
          <ChartSection title="해시태그 Top 10">
            {data.topHashtags.length === 0 ? (
              <p className="text-[13px] text-(--text-muted)">데이터 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={data.topHashtags}
                  layout="vertical"
                  margin={{ left: 8, right: 16, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="tag"
                    width={90}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => (v.length > 8 ? v.slice(0, 8) + '…' : v)}
                  />
                  <Tooltip
                    formatter={(value: number | undefined) =>
                      [(value ?? 0).toLocaleString(), '등장 건수'] as [string, string]
                    }
                    labelFormatter={(label) => `#${fmtLabel(label)}`}
                  />
                  <Bar
                    dataKey="count"
                    fill={CHART_COLORS[2]}
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(d: unknown) => {
                      const entry = d as { tag: string }
                      if (entry?.tag) { setHashtagInput(entry.tag); setHashtag(entry.tag) }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartSection>

          {/* 차트 4: 기간별 추이 */}
          <ChartSection title="기간별 업로드 추이">
            {data.timeSeries.length === 0 ? (
              <p className="text-[13px] text-(--text-muted)">데이터 없음</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={data.timeSeries}
                  margin={{ left: 0, right: 16, top: 4, bottom: 0 }}
                >
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(5)} // MM-DD
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={fmtCount}
                    labelFormatter={(label) => `날짜: ${fmtLabel(label)}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={CHART_COLORS[0]}
                    strokeWidth={2}
                    dot={data.timeSeries.length <= 30}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartSection>
        </div>
      )}

      {/* 하단 테이블: 지역별 상세 */}
      {data && data.byRegion.length > 0 && (
        <section className="stack-md">
          <h3 className="m-0 text-[14px] font-semibold">지역별 상세</h3>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line-base)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 12px', fontWeight: 600 }}>지역</th>
                  <th style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 600 }}>건수</th>
                  <th style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 600 }}>비율</th>
                </tr>
              </thead>
              <tbody>
                {data.byRegion.map((r) => (
                  <tr
                    key={r.region}
                    style={{ borderBottom: '1px solid var(--line-base)', cursor: 'pointer' }}
                    onClick={() => { setRegionInput(r.region); setRegion(r.region) }}
                  >
                    <td style={{ padding: '6px 12px' }}>{r.region}</td>
                    <td style={{ textAlign: 'right', padding: '6px 12px', fontVariantNumeric: 'tabular-nums' }}>
                      {r.count.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', padding: '6px 12px', color: 'var(--text-muted)' }}>
                      {data.summary.totalBanners > 0
                        ? `${((r.count / data.summary.totalBanners) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

export default function StatsPage() {
  return (
    <Suspense>
      <StatsContent />
    </Suspense>
  )
}
