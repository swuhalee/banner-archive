/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RegionSelector from '@/features/uploads/components/region-selector'

vi.mock('@/data/korea-regions', () => ({
  getSidoList: () => ['서울'],
  getSigunguList: (sido: string) => (sido === '서울' ? ['강남구'] : []),
  getEupmyeondongList: (sido: string, sigungu: string) =>
    sido === '서울' && sigungu === '강남구' ? ['역삼동'] : [],
  getRiList: (sido: string, sigungu: string, eupmyeondong: string) =>
    sido === '서울' && sigungu === '강남구' && eupmyeondong === '역삼동' ? ['역삼1리'] : [],
}))

describe('RegionSelector', () => {
  it('행정구역을 단계적으로 선택하고 onChange를 호출한다', () => {
    const onChange = vi.fn()
    render(<RegionSelector value="" onChange={onChange} />)

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: '서울' } })
    expect(onChange).toHaveBeenLastCalledWith('서울')

    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '강남구' } })
    expect(onChange).toHaveBeenLastCalledWith('서울 강남구')

    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: '역삼동' } })
    expect(onChange).toHaveBeenLastCalledWith('서울 강남구 역삼동')

    fireEvent.change(screen.getAllByRole('combobox')[3], { target: { value: '역삼1리' } })
    expect(onChange).toHaveBeenLastCalledWith('서울 강남구 역삼동 역삼1리')
  })

  it('외부 value가 빈 문자열로 바뀌면 내부 선택 상태를 초기화한다', () => {
    const onChange = vi.fn()
    const { rerender } = render(<RegionSelector value="서울 강남구" onChange={onChange} />)

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '서울' } })
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('서울')

    rerender(<RegionSelector value="" onChange={onChange} />)
    expect(screen.getAllByRole('combobox')[0]).toHaveValue('')
  })
})
