import ArchivePhotoCard from "../_components/archive-photo-card";

const collections = [
  {
    title: "정당 컬렉션",
    description: "정당 주체 현수막 기록",
    items: [
      { id: "BA-2301", region: "서울 중구", image: "https://picsum.photos/seed/collection-party-1/1200/900" },
      { id: "BA-2302", region: "인천 연수구", image: "https://picsum.photos/seed/collection-party-2/1200/1600" },
    ],
  },
  {
    title: "시장/군수 컬렉션",
    description: "지자체장 주체 현수막 기록",
    items: [
      { id: "BA-2310", region: "대전 서구", image: "https://picsum.photos/seed/collection-mayor-1/1600/900" },
      { id: "BA-2311", region: "광주 북구", image: "https://picsum.photos/seed/collection-mayor-2/1200/900" },
    ],
  },
  {
    title: "정책 분석 후보군",
    description: "향후 분석 페이지로 확장 가능한 묶음",
    items: [
      { id: "BA-2320", region: "경기 성남시", image: "https://picsum.photos/seed/collection-analysis-1/1200/900" },
      { id: "BA-2321", region: "부산 해운대구", image: "https://picsum.photos/seed/collection-analysis-2/1000/1000" },
    ],
  },
];

export default function CollectionsPage() {
  return (
    <div className="stack-lg">
      {/* <section className="grid gap-1">
        <h1 className="m-0">컬렉션</h1>
        <p className="m-0 text-[13px] text-[var(--text-muted)]">정당/주체/분석 후보군 기준으로 기록을 묶어 봅니다.</p>
      </section> */}

      {collections.map((collection) => (
        <section key={collection.title} className="stack-md">
          <div className="grid gap-1">
            <h2 className="m-0">{collection.title}</h2>
            <p className="m-0 text-[13px] text-[var(--text-muted)]">{collection.description}</p>
          </div>
          <div className="masonry">
            {collection.items.map((item, idx) => (
              <ArchivePhotoCard
                key={item.id}
                item={item}
                mediaClass={`media-${(idx % 4) + 1}`}
                fromPath="/collections"
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
