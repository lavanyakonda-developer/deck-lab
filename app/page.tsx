import { ChatPanel } from "@/components/chat/ChatPanel";
import { DeckHydrator } from "@/components/deck/DeckHydrator";
import { SlideCanvas } from "@/components/deck/SlideCanvas";
import { ThumbnailRail } from "@/components/deck/ThumbnailRail";

export default function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <DeckHydrator />
      <ChatPanel />
      <main className="flex min-h-0 flex-1 flex-col">
        <SlideCanvas />
        <ThumbnailRail />
      </main>
    </div>
  );
}
