/**
 * Interface for a stack item in the YAML parser
 */
export interface IStackItem {
  /** The indentation level of this item */
  indent: number;
  /** The object or array being built */
  obj: Array<TYamlData> | Record<string, TYamlData>;
  /** Whether this item is an array */
  isArray?: boolean;
  /** The key that will contain an array if a list item is encountered */
  arrayKey?: string;
  /** The key for a multiline string */
  multilineKey?: string;
  /** The accumulated value for a multiline string */
  multilineValue?: string;
  /** The type of multiline string ('literal' or 'folded') */
  multilineType?: 'folded' | 'literal';
}

/**
 * Interface for parameters when processing an item in an array
 */
export interface IProcessItemParams {
  /** The content of the item */
  itemContent: string;
  /** The indentation level */
  indent: number;
  /** The stack of objects being built */
  stack: Array<IStackItem>;
  /** The array being built (for existing arrays) */
  array?: Array<TYamlData>;
  /** The last item on the stack (for new arrays) */
  lastStackItem?: IStackItem;
  /** The current line number */
  lineNumber?: number;
}

/**
 * Interface for parameters when processing a key-value pair
 */
export interface IKeyValueParams {
  /** The key */
  key: string;
  /** The value (optional) */
  value: string | undefined;
  /** The indentation level */
  indent: number;
  /** The stack of objects being built */
  stack: Array<IStackItem>;
  /** The object to add the key-value pair to */
  obj: Record<string, TYamlData>;
  /** The current line number */
  lineNumber?: number;
}

/**
 * Type for a map of anchors to their values
 */
export type TAnchorMap = Record<string, unknown>;

/**
 * Represents YAML data parsed from a request
 *
 * This type provides a structured representation of YAML content,
 * using unknown for type safety while allowing for nested structures.
 */
export type TYamlData = Array<TYamlData> | boolean | number | string | { [key: string]: TYamlData } | null;
