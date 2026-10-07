"use client";

import { useEffect, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { SearchItem } from "@/lib/search";
import { DevDrawer } from "./dev-drawer";
import { FeedbackModal } from "./feedback-modal";
import { Rail } from "./rail";
import { TopBar } from "./topbar";

export function Shell({ children, index }: { children: ReactNode; index: SearchItem[] }) {
  useEffect(() => {
    void useStore.persist.rehydrate();
  }, []);
  return (
    <>
      <Rail />
      <TopBar index={index} />
      <main className="ml-[240px] min-h-screen pt-14">{children}</main>
      <FeedbackModal />
      <DevDrawer />
    </>
  );
}
