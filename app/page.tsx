import { ChatPanel } from "@/components/chat/ChatPanel";
import { StoreHydrator } from "@/components/StoreHydrator";
import { SlideCanvas } from "@/components/deck/SlideCanvas";
import { ThumbnailRail } from "@/components/deck/ThumbnailRail";

export default function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-row">
      <StoreHydrator />
      <ChatPanel />
      <main className="flex min-w-0 flex-1 flex-col">
        <SlideCanvas />
        <ThumbnailRail />
      </main>
    </div>
  );
}
