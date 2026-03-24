import {
  GRAPHQL_MAX_INT,
  GRAPHQL_MIN_INT,
  Kind,
  parse,
  print,
  visit,
} from 'graphql'
import type {
  NameNode,
  ObjectFieldNode,
  OperationDefinitionNode,
  ValueNode,
} from 'graphql'

/** GraphQL `Name` token (field keys in input objects). */
const GRAPHQL_NAME_RE = /^[A-Za-z_]\w*$/

/**
 * JSON variables often encode GraphQL enums as strings (e.g. `"asc"`).
 * Without a schema we only promote to EnumValue for known input fields.
 */
const ENUM_STRING_OBJECT_FIELD_NAMES = new Set(['order'])

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const numberToValueNode = (value: number): ValueNode | null => {
  if (!Number.isFinite(value)) {
    return null
  }
  if (
    Number.isInteger(value) &&
    value >= GRAPHQL_MIN_INT &&
    value <= GRAPHQL_MAX_INT
  ) {
    return { kind: Kind.INT, value: String(value) }
  }
  return { kind: Kind.FLOAT, value: String(value) }
}

const arrayToListValueNode = (value: unknown[]): ValueNode | null => {
  const values: ValueNode[] = []
  for (const item of value) {
    if (item === undefined) {
      continue
    }
    const node = jsValueToValueNode(item, undefined)
    if (node === null && item !== null) {
      return null
    }
    values.push(node ?? { kind: Kind.NULL })
  }
  return { kind: Kind.LIST, values }
}

const stringToValueNode = (
  value: string,
  objectFieldKey: string | undefined
): ValueNode => {
  if (
    objectFieldKey &&
    ENUM_STRING_OBJECT_FIELD_NAMES.has(objectFieldKey) &&
    GRAPHQL_NAME_RE.test(value)
  ) {
    return { kind: Kind.ENUM, value }
  }
  return { kind: Kind.STRING, value, block: false }
}

const objectToObjectValueNode = (
  value: Record<string, unknown>
): ValueNode | null => {
  const fields: ObjectFieldNode[] = []
  for (const [key, v] of Object.entries(value)) {
    if (!GRAPHQL_NAME_RE.test(key)) {
      return null
    }
    if (v === undefined) {
      continue
    }
    const fieldValue = jsValueToValueNode(v, key)
    if (fieldValue === null) {
      return null
    }
    fields.push({
      kind: Kind.OBJECT_FIELD,
      name: { kind: Kind.NAME, value: key },
      value: fieldValue,
    })
  }
  return { kind: Kind.OBJECT, fields }
}

/**
 * Turn a runtime variables object into GraphQL value literals for inlining
 * into a document (no schema; heuristics match typical JSON variable shapes).
 */
function jsValueToValueNode(
  value: unknown,
  objectFieldKey: string | undefined
): ValueNode | null {
  if (value === null) {
    return { kind: Kind.NULL }
  }
  if (value === undefined) {
    return null
  }
  if (typeof value === 'boolean') {
    return { kind: Kind.BOOLEAN, value }
  }
  if (typeof value === 'number') {
    return numberToValueNode(value)
  }
  if (typeof value === 'string') {
    return stringToValueNode(value, objectFieldKey)
  }
  if (Array.isArray(value)) {
    return arrayToListValueNode(value)
  }
  if (isPlainObject(value)) {
    return objectToObjectValueNode(value)
  }
  return null
}

const getInlinedOperationName = (
  operation: OperationDefinitionNode['operation']
): NameNode => {
  if (operation === 'mutation') {
    return { kind: Kind.NAME, value: 'InlinedMutation' }
  }
  if (operation === 'subscription') {
    return { kind: Kind.NAME, value: 'InlinedSubscription' }
  }
  return { kind: Kind.NAME, value: 'InlinedQuery' }
}

/**
 * Returns a single GraphQL document string with variable definitions removed
 * and `$variable` references replaced by literal values from `variables`.
 * Useful for pasting into clients/tests without a separate variables map.
 */
export const buildRawGraphqlQuery = (
  query: string | undefined,
  variables: Record<string, unknown> | undefined
): string | null => {
  if (!query?.trim()) {
    return null
  }

  const vars = variables ?? {}

  try {
    const ast = parse(query)

    const visited = visit(ast, {
      OperationDefinition: {
        leave(node: OperationDefinitionNode) {
          return {
            ...node,
            // Variables are inlined into the body, so remove definitions.
            variableDefinitions: [],
            // Keep explicit operation syntax (avoid `{ ... }` shorthand).
            name: node.name ?? getInlinedOperationName(node.operation),
          }
        },
      },
      Variable(node) {
        const name = node.name.value
        if (!(name in vars)) {
          return node
        }
        const value = vars[name]
        const literal = jsValueToValueNode(value, undefined)
        return literal ?? node
      },
    })

    return print(visited)
  } catch {
    return null
  }
}
