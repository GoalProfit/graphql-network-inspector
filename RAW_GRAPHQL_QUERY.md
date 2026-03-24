# Raw GraphQL query (inlined variables)

Recorded payloads and the **Copy Raw** action build a `raw` query string by parsing the original document, removing variable definitions, and substituting `$variables` with literals. JSON variables often represent GraphQL **enums** as strings (e.g. `"asc"`); those must be printed as enum tokens (`asc`), not as string literals (`"asc"`).

## Extending enum-like fields

If validation fails with a message like *cannot represent value: `"…"`* for a field that is actually a GraphQL enum in your schema, add that **input object field name** to the allowlist.

1. Open `src/helpers/buildRawGraphqlQuery.ts`.
2. Find `ENUM_STRING_OBJECT_FIELD_NAMES` (next to the existing `order` entry).
3. Add the field name, for example:

```ts
const ENUM_STRING_OBJECT_FIELD_NAMES = new Set(['order', 'direction'])
```

Only names that match a valid GraphQL `Name` and appear as **keys** on inlined variable objects are promoted from JSON strings to `EnumValue` nodes. Other strings stay quoted.
