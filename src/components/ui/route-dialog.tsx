"use client";

import { useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { Dialog, DialogPanel } from "@headlessui/react";
import { useRouter } from "next/navigation";

type RouteDialogProps = {
  ariaLabel: string;
  dialogClassName: string;
  closeHref: string;
  children: ReactNode;
  disableOutsideClose?: boolean;
};

export default function RouteDialog({ ariaLabel, dialogClassName, closeHref, children, disableOutsideClose = false }: RouteDialogProps) {
  const router = useRouter();
  // 닫기 로직이 중복 실행되는 것을 막는 잠금 플래그
  const isClosingRef = useRef(false);

  // 모달 닫기 공통 함수
  // - 히스토리가 남아있으면 router.back()으로 이전 화면 복귀
  // - 그렇지 않으면 closeHref로 안전하게 대체 이동
  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(closeHref);
  }, [closeHref, router]);

  // Headless UI Dialog의 onClose에서 호출:
  // - Escape 키
  // - 패널 바깥(backdrop) 클릭
  // 단, 자식 다이얼로그가 열려 있는 동안은 부모 모달 닫힘을 막음
  const handleDialogClose = useCallback(() => {
    if (disableOutsideClose) return;
    handleClose();
  }, [handleClose, disableOutsideClose]);

  return (
    <Dialog open onClose={handleDialogClose} className={dialogClassName}>
      <DialogPanel aria-label={ariaLabel}>{children}</DialogPanel>
    </Dialog>
  );
}
