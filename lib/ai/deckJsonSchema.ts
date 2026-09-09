// Hand-written (not zod-derived) to stay within the JSON Schema subset
// OpenAI's strict structured-output mode supports - notably no min/max
// length or item-count constraints, which strict mode ignores/rejects.
// Response content is re-validated against the real zod schema afterward
// (see deckGenerationSchema.ts), which does enforce those minimums.
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
          properties: {
            type: {
              type: "string",
              enum: ["title", "content", "two-column", "comparison", "table"],
            },
            title: { type: "string" },
            subtitle: { type: ["string", "null"] },
            speakerNotes: { type: "string" },
            layout: {
              type: ["object", "null"],
              additionalProperties: false,
              properties: {
                align: {
                  type: ["string", "null"],
                  enum: ["left", "center", "right", null],
                },
                columns: { type: ["integer", "null"], enum: [1, 2, null] },
                columnTitles: {
                  type: ["array", "null"],
                  items: { type: "string" },
                },
                density: {
                  type: ["string", "null"],
                  enum: ["compact", "comfortable", "spacious", null],
                },
              },
              required: ["align", "columns", "columnTitles", "density"],
            },
            body: {
              type: "array",
              items: {
                anyOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: { type: "string", enum: ["bullets"] },
                      items: { type: "array", items: { type: "string" } },
                      column: {
                        type: ["integer", "null"],
                        enum: [0, 1, null],
                      },
                    },
                    required: ["type", "items", "column"],
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: { type: "string", enum: ["paragraph"] },
                      text: { type: "string" },
                      column: {
                        type: ["integer", "null"],
                        enum: [0, 1, null],
                      },
                    },
                    required: ["type", "text", "column"],
                  },
                  {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      type: { type: "string", enum: ["table"] },
                      headers: { type: "array", items: { type: "string" } },
                      rows: {
                        type: "array",
                        items: { type: "array", items: { type: "string" } },
                      },
                      column: {
                        type: ["integer", "null"],
                        enum: [0, 1, null],
                      },
                    },
                    required: ["type", "headers", "rows", "column"],
                  },
                ],
              },
            },
          },
          required: [
            "type",
            "title",
            "subtitle",
            "speakerNotes",
            "layout",
            "body",
          ],
        },
      },
    },
    required: ["title", "slides"],
  },
};
