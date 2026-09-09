import { ChatPanel } from "@/components/chat/ChatPanel";
import { SlideCanvas } from "@/components/deck/SlideCanvas";
import { ThumbnailRail } from "@/components/deck/ThumbnailRail";

export default function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <ChatPanel />
      <main className="flex min-h-0 flex-1 flex-col">
        <SlideCanvas />
        <ThumbnailRail />
      </main>
    </div>
  );
}
