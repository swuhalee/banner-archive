export type StatsOverviewResponse = {
  summary: {
    totalBanners: number
    totalRegions: number
    totalSubjects: number
  }
  byRegion: Array<{ region: string; count: number }>
  bySubjectType: Array<{ subjectType: string; count: number }>
  topHashtags: Array<{ tag: string; count: number; ratio: number }>
  timeSeries: Array<{ bucket: string; count: number }>
}
