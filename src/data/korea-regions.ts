import data from "./korea-regions.json";

type KoreaRegionsData = {
  시도: string[];
  시군구: Record<string, string[]>;
  읍면동: Record<string, string[]>;
  리: Record<string, string[]>;
};

const regions = data as KoreaRegionsData;

export function getSidoList(): string[] {
  return regions["시도"];
}

export function getSigunguList(sido: string): string[] {
  return regions["시군구"][sido] ?? [];
}

export function getEupmyeondongList(sido: string, sigungu: string): string[] {
  return regions["읍면동"][`${sido} ${sigungu}`] ?? [];
}

export function getRiList(sido: string, sigungu: string, eupmyeondong: string): string[] {
  return regions["리"][`${sido} ${sigungu} ${eupmyeondong}`] ?? [];
}
