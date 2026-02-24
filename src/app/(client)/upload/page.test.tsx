import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/uploads', () => ({
  UploadDialog: (props: { asModal?: boolean }) => <div data-props={JSON.stringify(props)} />,
}))

describe('업로드 페이지', () => {
  it('UploadDialog를 페이지 모드(asModal=false)로 렌더한다', async () => {
    const { default: UploadPage } = await import('./page')
    const element = UploadPage()

    expect((element as { props: { asModal: boolean } }).props).toEqual({
      asModal: false,
    })
  })
})
