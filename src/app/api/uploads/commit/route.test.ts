import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/uploads/commit/route'

describe('POST /api/uploads/commit', () => {
  it('JSON 본문 파싱에 실패하면 400을 반환한다', async () => {
    const req = {
      json: async () => {
        throw new Error('bad json')
      },
    } as unknown as Request

    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ error: '요청 본문을 파싱할 수 없습니다' })
  })

  it('uploadSourceId가 없으면 400을 반환한다', async () => {
    const req = {
      json: async () => ({ selectedCandidates: [{ tempId: '1' }] }),
    } as unknown as Request

    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ error: 'uploadSourceId는 필수입니다' })
  })

  it('selectedCandidates가 비어 있으면 400을 반환한다', async () => {
    const req = {
      json: async () => ({ uploadSourceId: 'upload-1', selectedCandidates: [] }),
    } as unknown as Request

    const res = await POST(req as never)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body).toEqual({ error: '저장할 현수막을 최소 1개 선택해주세요' })
  })
})
