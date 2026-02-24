export type BannerImage = {
  id: string
  bannerId: string
  maskedImageUrl: string
  originalImageUrl: string | null
  maskingStatus: 'pending' | 'success' | 'fail' | 'review'
  maskingMetadata: unknown | null
  phash: string | null
  createdAt: string
}

export type Banner = {
  id: string
  title: string | null
  hashtags: string[]
  subjectType: string | null
  regionText: string
  firstSeenAt: string
  lastSeenAt: string
  observedCount: number
  status: 'active' | 'hidden' | 'deleted'
  createdAt: string
  updatedAt: string
  images?: BannerImage[]
}

export type BannerWithImages = Banner & { images: BannerImage[] }

export type BannerListResponse = {
  data: Banner[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
