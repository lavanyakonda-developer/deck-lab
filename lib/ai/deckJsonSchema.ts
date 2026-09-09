import {
  slidePropertiesJsonSchema,
  slideRequiredFields,
} from "./jsonSchemaFragments";

// Hand-written (not zod-derived) to stay within the JSON Schema subset
// OpenAI's strict structured-output mode supports. Response content is
// re-validated against the real zod schema afterward (see
// deckGenerationSchema.ts), which does enforce content-quality minimums
// (e.g. non-empty bullets) that strict mode itself can't express.
export const deckJsonSchema = {
  name: "deck",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      slides: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: slidePropertiesJsonSchema,
          required: slideRequiredFields,
        },
      },
    },
    required: ["title", "slides"],
  },
};
