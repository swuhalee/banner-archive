import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "80px",
          background: "#f6f6f6",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 6,
              height: 64,
              background: "#111111",
              borderRadius: 3,
              marginRight: 24,
            }}
          />
          <span
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: "#111111",
              lineHeight: 1,
            }}
          >
            한국 현수막 저장소
          </span>
        </div>
        <p
          style={{
            fontSize: 30,
            color: "#6a6a6a",
            margin: 0,
            paddingLeft: 30,
          }}
        >
          국내 정당·정치인 현수막을 모아보는 아카이브
        </p>
      </div>
    ),
    { ...size },
  );
}
