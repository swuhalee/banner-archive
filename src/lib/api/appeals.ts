export type AppealReasonType = 'privacy' | 'portrait' | 'false_info' | 'other'

export type SubmitAppealParams = {
  bannerId: string
  reasonType: AppealReasonType
  reasonDetail?: string
}

export async function submitAppeal(params: SubmitAppealParams): Promise<void> {
  const res = await fetch('/api/appeals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? '신고 접수에 실패했습니다')
  }
}
