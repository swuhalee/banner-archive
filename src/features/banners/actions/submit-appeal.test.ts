import { beforeEach, describe, expect, it, vi } from 'vitest'

const findFirstMock = vi.fn()
const returningMock = vi.fn()
const valuesMock = vi.fn()
const insertMock = vi.fn()

vi.mock('@/server/db', () => ({
  db: {
    query: {
      banners: {
        findFirst: findFirstMock,
      },
    },
    insert: insertMock,
  },
}))

vi.mock('@/server/db/schema', () => ({
  appeals: {},
  banners: { id: 'id' },
}))

describe('submitAppeal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    returningMock.mockResolvedValue([{ id: 'appeal-1' }])
    valuesMock.mockReturnValue({ returning: returningMock })
    insertMock.mockReturnValue({ values: valuesMock })
  })

  it('배너가 없으면 에러를 던진다', async () => {
    findFirstMock.mockResolvedValue(null)
    const { submitAppeal } = await import('./submit-appeal')

    await expect(
      submitAppeal({ bannerId: 'banner-1', reasonType: 'privacy' }),
    ).rejects.toThrow('배너를 찾을 수 없습니다')
  })

  it('삭제된 배너면 에러를 던진다', async () => {
    findFirstMock.mockResolvedValue({ id: 'banner-1', status: 'deleted' })
    const { submitAppeal } = await import('./submit-appeal')

    await expect(
      submitAppeal({ bannerId: 'banner-1', reasonType: 'privacy' }),
    ).rejects.toThrow('삭제된 배너입니다')
  })

  it('유효한 신고를 저장하고 반환한다', async () => {
    findFirstMock.mockResolvedValue({ id: 'banner-1', status: 'active' })
    const { submitAppeal } = await import('./submit-appeal')

    const result = await submitAppeal({
      bannerId: 'banner-1',
      reasonType: 'other',
      reasonDetail: '  상세 사유  ',
    })

    expect(valuesMock).toHaveBeenCalledWith({
      bannerId: 'banner-1',
      reasonType: 'other',
      reasonDetail: '상세 사유',
    })
    expect(result).toEqual({ id: 'appeal-1' })
  })
})
