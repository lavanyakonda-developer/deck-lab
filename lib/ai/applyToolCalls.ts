import type { LayoutHints, Slide, SlideType } from "@/lib/schema/slide";
import { normalizeBlock, normalizeLayout } from "./normalize";
import type { ValidatedToolCall } from "./tools";

interface ChangeLayoutChanges {
  type?: SlideType;
  layout?: LayoutHints;
}

interface DeckActions {
  addSlide: (slide: Omit<Slide, "id">, index?: number) => string;
  updateSlide: (id: string, patch: Partial<Omit<Slide, "id">>) => void;
  deleteSlide: (id: string) => void;
  reorderSlides: (orderedIds: string[]) => void;
  changeLayout: (id: string, changes: ChangeLayoutChanges) => void;
  selectSlide: (id: string | null) => void;
}

// Applies one already-validated tool call directly through the deck
// store's existing actions - the same ones manual editing uses, so a
// tool call is a targeted patch by construction, never a full rebuild.
export function applyToolCall(actions: DeckActions, call: ValidatedToolCall) {
  switch (call.tool) {
    case "generate_deck":
      // The server intercepts generate_deck and returns it as
      // `generatedDeck` (applied via loadDeck), never inside `toolCalls` -
      // this branch should be unreachable in practice.
      console.warn(
        "[applyToolCall] received an unexpected generate_deck tool call - this should have been intercepted server-side",
        call,
      );
      return;

    case "add_slide":
      actions.addSlide(
        {
          type: call.args.slide.type,
          title: call.args.slide.title,
          subtitle: call.args.slide.subtitle ?? undefined,
          body: call.args.slide.body.map(normalizeBlock),
          layout: normalizeLayout(call.args.slide.layout),
        },
        call.args.index ?? undefined,
      );
      return;

    case "update_slide": {
      const patch: Partial<Omit<Slide, "id">> = {};
      if (call.args.title !== null) patch.title = call.args.title;
      if (call.args.subtitle !== null) patch.subtitle = call.args.subtitle;
      if (call.args.body !== null)
        patch.body = call.args.body.map(normalizeBlock);
      if (call.args.layout !== null)
        patch.layout = normalizeLayout(call.args.layout);
      actions.updateSlide(call.args.id, patch);
      // Select the edited slide so the user sees the change live, even
      // if they were looking at a different slide when it landed.
      actions.selectSlide(call.args.id);
      return;
    }

    case "delete_slide":
      actions.deleteSlide(call.args.id);
      return;

    case "reorder_slides":
      actions.reorderSlides(call.args.orderedIds);
      return;

    case "change_layout":
      actions.changeLayout(call.args.id, {
        type: call.args.type ?? undefined,
        layout: normalizeLayout(call.args.layout),
      });
      actions.selectSlide(call.args.id);
      return;
  }
}
