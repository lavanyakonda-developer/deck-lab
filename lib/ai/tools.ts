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
export type GenerateDeckArgs = z.infer<typeof GenerateDeckArgsSchema>;

const generateDeckTool = {
  type: "function" as const,
  function: {
    name: "generate_deck",
    description:
      "Create a brand new multi-slide deck from scratch, REPLACING the current deck entirely. Use this only when the user is asking for an entirely new/different presentation - not for any request that refers to, adds to, or modifies the existing deck's slides (use the other tools for those). `prompt` should be the topic/brief to generate from, in the user's own words.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        prompt: { type: "string" },
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
export type AddSlideArgs = z.infer<typeof AddSlideArgsSchema>;

const addSlideTool = {
  type: "function" as const,
  function: {
    name: "add_slide",
    description:
      "Insert a new slide into the deck. `index` is the 0-based position among the CURRENT slides where it should land (e.g. 0 = first, 2 = becomes the 3rd slide); pass null to append at the end.",
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
export type UpdateSlideArgs = z.infer<typeof UpdateSlideArgsSchema>;

const updateSlideTool = {
  type: "function" as const,
  function: {
    name: "update_slide",
    description:
      'Change one existing slide, referenced by its exact "id" from the deck context. Every field is nullable: null means "leave this field unchanged", a real value means "set it to this". If you are changing any part of the body (e.g. one bullet), you must supply the FULL new body array, since it replaces the whole thing.',
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
export type DeleteSlideArgs = z.infer<typeof DeleteSlideArgsSchema>;

const deleteSlideTool = {
  type: "function" as const,
  function: {
    name: "delete_slide",
    description:
      'Remove one slide, referenced by its exact "id" from the deck context.',
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
export type ReorderSlidesArgs = z.infer<typeof ReorderSlidesArgsSchema>;

const reorderSlidesTool = {
  type: "function" as const,
  function: {
    name: "reorder_slides",
    description:
      "Reorder the deck. `orderedIds` must be the COMPLETE list of every current slide id, in the new desired order - not a partial list.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        orderedIds: { type: "array", items: { type: "string" } },
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
export type ChangeLayoutArgs = z.infer<typeof ChangeLayoutArgsSchema>;

const changeLayoutTool = {
  type: "function" as const,
  function: {
    name: "change_layout",
    description:
      'Change a slide\'s layout type and/or layout hints, referenced by its exact "id". `type` null means keep the current slide type; `layout` null means keep the current layout hints.',
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
