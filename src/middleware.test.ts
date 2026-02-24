import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  getUserMock: vi.fn(),
  nextMock: vi.fn(),
  cookiesAdapter: null as null | { setAll: (cookies: Array<{ name: string; value: string; options?: object }>) => void },
  responses: [] as Array<{ cookies: { set: ReturnType<typeof vi.fn> } }>,
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: state.createServerClientMock,
}))

vi.mock('next/server', () => ({
  NextResponse: {
    next: state.nextMock,
  },
}))

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.responses = []
    state.cookiesAdapter = null

    state.nextMock.mockImplementation(() => {
      const response = { cookies: { set: vi.fn() } }
      state.responses.push(response)
      return response
    })

    state.createServerClientMock.mockImplementation(
      (_url: string, _key: string, options: { cookies: { setAll: (cookies: Array<{ name: string; value: string; options?: object }>) => void } }) => {
        state.cookiesAdapter = options.cookies
        return {
          auth: {
            getUser: state.getUserMock,
          },
        }
      },
    )
  })

  it('getUser 호출 후 최신 응답 객체를 반환한다', async () => {
    const request = {
      cookies: {
        getAll: vi.fn(() => [{ name: 'a', value: 'b' }]),
        set: vi.fn(),
      },
    }

    state.getUserMock.mockResolvedValue({ data: { user: null } })
    const { middleware } = await import('./middleware')
    const response = await middleware(request as never)

    expect(state.createServerClientMock).toHaveBeenCalledTimes(1)
    expect(state.getUserMock).toHaveBeenCalledTimes(1)
    expect(response).toBe(state.responses[0])
  })

  it('쿠키 갱신이 발생하면 request/response 양쪽 쿠키를 동기화한다', async () => {
    const request = {
      cookies: {
        getAll: vi.fn(() => []),
        set: vi.fn(),
      },
    }

    state.getUserMock.mockImplementation(async () => {
      state.cookiesAdapter?.setAll([
        { name: 'sb-access-token', value: 'token', options: { path: '/' } },
      ])
      return { data: { user: null } }
    })

    const { middleware } = await import('./middleware')
    const response = await middleware(request as never)

    expect(state.nextMock).toHaveBeenCalledTimes(2)
    expect(request.cookies.set).toHaveBeenCalledWith('sb-access-token', 'token')
    expect(response.cookies.set).toHaveBeenCalledWith('sb-access-token', 'token', { path: '/' })
  })
})
