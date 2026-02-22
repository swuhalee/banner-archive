"use client";

import { useEffect, useState } from "react";
import {
  getSidoList,
  getSigunguList,
  getEupmyeondongList,
  getRiList,
} from "@/data/korea-regions";

type RegionSelectorProps = {
  value: string;
  onChange: (regionText: string) => void;
};

export default function RegionSelector({ value, onChange }: RegionSelectorProps) {
  const [sido, setSido] = useState("");
  const [sigungu, setSigungu] = useState("");
  const [eupmyeondong, setEupmyeondong] = useState("");
  const [ri, setRi] = useState("");

  // 외부에서 value가 "" 으로 초기화되면 (handleReset) 내부 state도 초기화
  useEffect(() => {
    if (!value) {
      setSido("");
      setSigungu("");
      setEupmyeondong("");
      setRi("");
    }
  }, [value]);

  const sigunguList = sido ? getSigunguList(sido) : [];
  const eupmyeondongList = sido && sigungu ? getEupmyeondongList(sido, sigungu) : [];
  const riList = sido && sigungu && eupmyeondong ? getRiList(sido, sigungu, eupmyeondong) : [];

  function handleSidoChange(next: string) {
    setSido(next);
    setSigungu("");
    setEupmyeondong("");
    setRi("");
    onChange(next);
  }

  function handleSigunguChange(next: string) {
    setSigungu(next);
    setEupmyeondong("");
    setRi("");
    onChange(next ? `${sido} ${next}` : sido);
  }

  function handleEupmyeondongChange(next: string) {
    setEupmyeondong(next);
    setRi("");
    onChange(next ? `${sido} ${sigungu} ${next}` : `${sido} ${sigungu}`);
  }

  function handleRiChange(next: string) {
    setRi(next);
    onChange(next ? `${sido} ${sigungu} ${eupmyeondong} ${next}` : `${sido} ${sigungu} ${eupmyeondong}`);
  }

  return (
    <div className="grid gap-2">
      <select value={sido} onChange={(e) => handleSidoChange(e.target.value)}>
        <option value="">시 / 도 선택</option>
        {getSidoList().map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {sido && (
        <select value={sigungu} onChange={(e) => handleSigunguChange(e.target.value)}>
          <option value="">시 / 군 / 구 선택</option>
          {sigunguList.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}

      {sigungu && (
        <select value={eupmyeondong} onChange={(e) => handleEupmyeondongChange(e.target.value)}>
          <option value="">읍 / 면 / 동 선택</option>
          {eupmyeondongList.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}

      {riList.length > 0 && (
        <select value={ri} onChange={(e) => handleRiChange(e.target.value)}>
          <option value="">리 선택 (선택사항)</option>
          {riList.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      )}
    </div>
  );
}
