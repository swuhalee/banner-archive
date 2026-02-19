import ArchivePhotoCard from "../_components/archive-photo-card";

const byRegion = [
  {
    region: "서울",
    items: [
      { id: "BA-2201", region: "서울 영등포구", image: "https://picsum.photos/seed/archive-seoul-1/1200/900" },
      { id: "BA-2200", region: "서울 마포구", image: "https://picsum.photos/seed/archive-seoul-2/1200/1600" },
    ],
  },
  {
    region: "부산",
    items: [
      { id: "BA-2196", region: "부산 남구", image: "https://picsum.photos/seed/archive-busan-1/1200/900" },
      { id: "BA-2191", region: "부산 수영구", image: "https://picsum.photos/seed/archive-busan-2/1600/900" },
    ],
  },
  {
    region: "전남",
    items: [
      { id: "BA-2189", region: "전남 나주시", image: "https://picsum.photos/seed/archive-jeonnam-1/1200/1600" },
      { id: "BA-2185", region: "전남 목포시", image: "https://picsum.photos/seed/archive-jeonnam-2/1000/1000" },
    ],
  },
];

export default function ArchivePage() {
  return (
    <div className="stack-lg">
      <section className="grid grid-cols-[2fr_1fr_1fr] gap-2 pb-[10px] max-[1024px]:grid-cols-1">
        <input type="text" placeholder="지역 검색" />
        <select defaultValue="all">
          <option value="all">주체 전체</option>
          <option>정치인</option>
          <option>정당</option>
          <option>시장</option>
          <option>군수</option>
        </select>
        <select defaultValue="recent">
          <option value="recent">최근 관측순</option>
          <option value="first">최초 관측순</option>
          <option value="count">관측 횟수순</option>
        </select>
      </section>

      {byRegion.map((group) => (
        <section key={group.region} className="stack-md">
          <div className="grid gap-1">
            <h2 className="m-0">{group.region}</h2>
            <p className="m-0 text-[13px] text-[var(--text-muted)]">{group.region} 지역 기록</p>
          </div>
          <div className="masonry">
            {group.items.map((item, idx) => (
              <ArchivePhotoCard
                key={item.id}
                item={item}
                mediaClass={`media-${((idx + 1) % 4) + 1}`}
                fromPath="/archive"
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
