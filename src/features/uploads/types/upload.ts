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

export type RejectedDuplicate = {
  tempId: string
  matchedBannerId: string
  similarityScore: number
  threshold: number
}

export type CommitResponse = {
  savedBannerIds: string[]
  rejectedDuplicates: RejectedDuplicate[]
  savedCount: number
  rejectedCount: number
  /** @deprecated savedBannerIds 사용 권장 */
  bannerIds: string[]
  /** @deprecated savedCount 사용 권장 */
  count: number
}
