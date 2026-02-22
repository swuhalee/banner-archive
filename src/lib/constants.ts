export const BANNER_SUBJECT_TYPES = ['정치인', '정당', '기타'] as const

export type BannerSubjectType = (typeof BANNER_SUBJECT_TYPES)[number]
