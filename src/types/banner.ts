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

// ─── 다중 업로드 (analyze / commit) 관련 타입 ───────────────────────────────

export type BBox = {
  x: number      // 이미지 너비 대비 비율 (0–1)
  y: number      // 이미지 높이 대비 비율 (0–1)
  width: number  // 이미지 너비 대비 비율 (0–1)
  height: number // 이미지 높이 대비 비율 (0–1)
}

export type UploadCandidate = {
  tempId: string
  title: string | null
  hashtags: string[]
  subjectType: string | null
  bbox: BBox
  confidence: number
}

export type AnalyzeResponse = {
  uploadSourceId: string
  candidates: UploadCandidate[]
}

export type CommitCandidate = {
  tempId: string
  title: string | null
  hashtags: string[]
  subjectType: string | null
  bbox: BBox
  confidence: number
}

export type CommitRequest = {
  uploadSourceId: string
  selectedCandidates: CommitCandidate[]
}

export type CommitResponse = {
  bannerIds: string[]
  count: number
}
