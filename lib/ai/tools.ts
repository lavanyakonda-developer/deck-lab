import { z } from "zod";
import { SlideTypeSchema } from "@/lib/schema/slide";
import {
  ContentBlockGeneratedSchema,
  LayoutHintsGeneratedSchema,
  SlideGeneratedSchema,
} from "./deckGenerationSchema";
import {
  contentBlockArrayJsonSchema,
  layoutHintsJsonSchema,
  slidePropertiesJsonSchema,
  slideRequiredFields,
  slideTypeEnumJsonSchema,
} from "./jsonSchemaFragments";

// --- generate_deck --------------------------------------------------------

const GenerateDeckArgsSchema = z.object({
  prompt: z.string().min(1),
});
type GenerateDeckArgs = z.infer<typeof GenerateDeckArgsSchema>;

const generateDeckTool = {
  type: "function" as const,
  function: {
    name: "generate_deck",
    description: `
Create a BRAND NEW multi-slide deck from scratch, REPLACING THE ENTIRE CURRENT DECK.

ONLY use this tool when the user explicitly wants a completely new presentation
or wants to replace the existing deck with a new presentation.

Examples that should use this tool:
- "Create a presentation about AI in healthcare"
- "Make me a new deck about climate change"
- "Start a new presentation about our Q4 strategy"
- "Replace this deck with a presentation about X"

DO NOT use this tool when the user wants to modify the existing deck, including:
- adding slides → add_slide
- deleting slides → delete_slide
- changing slide content → update_slide
- changing layout → change_layout
- reordering slides → reorder_slides

IMPORTANT:
This tool replaces ALL existing slides. Do not use it merely because the user
wants substantial changes to the existing presentation.
`,
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        prompt: {
          type: "string",
          description:
            "The topic/brief to generate the new deck from, in the user's own words.",
        },
      },
      required: ["prompt"],
    },
  },
};

// --- add_slide ---------------------------------------------------------

const AddSlideArgsSchema = z.object({
  slide: SlideGeneratedSchema,
  index: z.number().int().min(0).nullable(),
});
type AddSlideArgs = z.infer<typeof AddSlideArgsSchema>;

const addSlideTool = {
  type: "function" as const,
  function: {
    name: "add_slide",
    description: `
Create and insert ONE new slide into the existing deck.

ALWAYS use this tool when the user asks to:
- add a slide
- create a new slide
- insert a slide
- add a slide before/after another slide
- add a slide at a specific position
- append a slide to the deck

This modifies the existing deck; it must NOT replace the existing deck.

\`index\` is the 0-based position among the CURRENT slides:
- 0 = first slide
- 1 = second slide
- 2 = third slide
- null = append to the end

If the user specifies a relative position such as "after slide 3",
resolve that position against the CURRENT deck and provide the resulting index.

Do NOT use this tool to modify an existing slide.
`,
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        slide: {
          type: "object",
          additionalProperties: false,
          properties: slidePropertiesJsonSchema,
          required: slideRequiredFields,
        },
        index: { type: ["integer", "null"] },
      },
      required: ["slide", "index"],
    },
  },
};

// --- update_slide --------------------------------------------------------

const UpdateSlideArgsSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  body: z.array(ContentBlockGeneratedSchema).nullable(),
  layout: LayoutHintsGeneratedSchema.nullable(),
});
type UpdateSlideArgs = z.infer<typeof UpdateSlideArgsSchema>;

const updateSlideTool = {
  type: "function" as const,
  function: {
    name: "update_slide",
    description: `
Modify the CONTENT of exactly one existing slide, referenced by its exact "id" from the deck context.

Use this tool when the user asks to:
- change or rewrite a slide's title
- change or rewrite a subtitle
- add, remove, or edit bullets/content
- change the wording or text on a slide
- replace the body/content of a slide

Do NOT use this tool to:
- change the order or position of slides → use reorder_slides
- change a slide's layout or visual arrangement → use change_layout
- add a new slide → use add_slide
- remove a slide → use delete_slide

Every field is nullable:
- null = leave that field unchanged
- a real value = replace that field with the supplied value

IMPORTANT:
If changing the body, provide the COMPLETE new body array because it replaces the existing body.
Do not provide only the changed bullet/block.
`,
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        title: { type: ["string", "null"] },
        subtitle: { type: ["string", "null"] },
        body: {
          type: ["array", "null"],
          items: contentBlockArrayJsonSchema.items,
        },
        layout: layoutHintsJsonSchema,
      },
      required: ["id", "title", "subtitle", "body", "layout"],
    },
  },
};

// --- delete_slide --------------------------------------------------------

const DeleteSlideArgsSchema = z.object({
  id: z.string().min(1),
});
type DeleteSlideArgs = z.infer<typeof DeleteSlideArgsSchema>;

const deleteSlideTool = {
  type: "function" as const,
  function: {
    name: "delete_slide",
    description: `
Delete exactly ONE existing slide from the deck, referenced by its exact "id".

ALWAYS use this tool when the user asks to:
- delete a slide
- remove a slide
- get rid of a slide
- discard a slide

Do NOT use this tool to:
- hide or modify slide content
- change slide order → use reorder_slides
- replace the entire deck → use generate_deck

Only delete the slide explicitly requested by the user.
`,
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
};

// --- reorder_slides --------------------------------------------------------

const ReorderSlidesArgsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});
type ReorderSlidesArgs = z.infer<typeof ReorderSlidesArgsSchema>;

const reorderSlidesTool = {
  type: "function" as const,
  function: {
    name: "reorder_slides",
    description: `
Reorder slides in the deck when the user asks to change the ORDER or POSITION of slides.

ALWAYS call this tool for requests such as:
- "swap slide 2 and slide 3"
- "move slide 5 before slide 2"
- "move slide 3 after slide 7"
- "put slide 4 first"
- "make slide 6 the last slide"
- "rearrange these slides"
- "change the order of the slides"

A reorder means changing the slide's position in the deck, NOT changing its content, layout, or visual elements.

IMPORTANT:
- Do NOT modify slide content to accomplish a reorder.
- Do NOT treat a reorder as a visual/layout edit.
- The tool must be called even when the user only asks to swap two slides.
- \`orderedIds\` MUST contain the COMPLETE list of EVERY current slide id, exactly once, in the desired final order.
- Preserve the relative order of all slides that the user did not ask to move.
- Never omit unchanged slides from \`orderedIds\`.
`,
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        orderedIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Complete final slide order. Include every current slide ID exactly once. Do not provide only the slides being moved.",
        },
      },
      required: ["orderedIds"],
    },
  },
};

// --- change_layout --------------------------------------------------------

const ChangeLayoutArgsSchema = z.object({
  id: z.string().min(1),
  type: SlideTypeSchema.nullable(),
  layout: LayoutHintsGeneratedSchema.nullable(),
});
type ChangeLayoutArgs = z.infer<typeof ChangeLayoutArgsSchema>;

const changeLayoutTool = {
  type: "function" as const,
  function: {
    name: "change_layout",
    description: `
Change the LAYOUT or visual structure of exactly one existing slide, referenced by its exact "id".

ALWAYS use this tool when the user asks to:
- change a slide layout
- switch between layout types
- make a slide two-column, single-column, title-only, etc.
- change the positioning/arrangement of content within a slide
- change layout hints
- make a slide visually structured differently

Do NOT use this tool to:
- change slide order → use reorder_slides
- change slide text/content → use update_slide
- add a slide → use add_slide
- delete a slide → use delete_slide

\`type\` null means keep the current slide type.
\`layout\` null means keep the current layout hints.
`,
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string" },
        type: {
          ...slideTypeEnumJsonSchema,
          type: ["string", "null"],
          enum: [...slideTypeEnumJsonSchema.enum, null],
        },
        layout: layoutHintsJsonSchema,
      },
      required: ["id", "type", "layout"],
    },
  },
};

// --- combined export --------------------------------------------------------

export const TOOL_DEFINITIONS = [
  generateDeckTool,
  addSlideTool,
  updateSlideTool,
  deleteSlideTool,
  reorderSlidesTool,
  changeLayoutTool,
];

export type ValidatedToolCall =
  | { tool: "generate_deck"; args: GenerateDeckArgs }
  | { tool: "add_slide"; args: AddSlideArgs }
  | { tool: "update_slide"; args: UpdateSlideArgs }
  | { tool: "delete_slide"; args: DeleteSlideArgs }
  | { tool: "reorder_slides"; args: ReorderSlidesArgs }
  | { tool: "change_layout"; args: ChangeLayoutArgs };

// Validates a tool call's raw (already JSON.parse'd) arguments against the
// matching zod schema. Returns null for an unknown tool name or invalid
// arguments, so the caller can simply skip malformed calls rather than
// fail the whole request over one bad tool call.
export function validateToolCall(
  name: string,
  rawArgs: unknown,
): ValidatedToolCall | null {
  switch (name) {
    case "generate_deck": {
      const result = GenerateDeckArgsSchema.safeParse(rawArgs);
      return result.success
        ? { tool: "generate_deck", args: result.data }
        : null;
    }
    case "add_slide": {
      const result = AddSlideArgsSchema.safeParse(rawArgs);
      return result.success ? { tool: "add_slide", args: result.data } : null;
    }
    case "update_slide": {
      const result = UpdateSlideArgsSchema.safeParse(rawArgs);
      return result.success
        ? { tool: "update_slide", args: result.data }
        : null;
    }
    case "delete_slide": {
      const result = DeleteSlideArgsSchema.safeParse(rawArgs);
      return result.success
        ? { tool: "delete_slide", args: result.data }
        : null;
    }
    case "reorder_slides": {
      const result = ReorderSlidesArgsSchema.safeParse(rawArgs);
      return result.success
        ? { tool: "reorder_slides", args: result.data }
        : null;
    }
    case "change_layout": {
      const result = ChangeLayoutArgsSchema.safeParse(rawArgs);
      return result.success
        ? { tool: "change_layout", args: result.data }
        : null;
    }
    default:
      return null;
  }
}
