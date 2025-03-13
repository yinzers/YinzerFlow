/* eslint-disable max-lines */
/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { IKeyValueParams, IProcessItemParams, IStackItem, TAnchorMap, TYamlData } from 'types/parsers/fileParsers/Yaml.ts';

/**
 * Parse YAML request body
 *
 * @param body - Raw YAML string
 * @returns Parsed YAML object
 * @throws Error if YAML is invalid
 */
export const parseYaml = (body: string): TYamlData => {
  try {
    // The result of parseYamlDocument is TYamlData, but we need to return TRequestBody
    // Since TYamlData is a valid subset of TRequestBody, we can safely cast it
    return parseYamlDocument(body);
  } catch (e) {
    throw new Error(`Invalid YAML: ${e instanceof Error ? e.message : String(e)}`);
  }
};

/**
 * Parse a complete YAML document
 *
 * @param yamlString - Raw YAML string
 * @returns Parsed YAML object
 */
const parseYamlDocument = (yamlString: string): TYamlData => {
  // Simple YAML parsing implementation
  // This is a basic implementation and doesn't handle all YAML features
  const result = <Record<string, TYamlData>>Object.create(null);

  // Split into lines
  const lines = yamlString.split(/\r?\n/);

  // Track indentation levels and their corresponding objects
  const stack: Array<IStackItem> = [{ indent: -1, obj: result }];

  // Track anchors for reference
  const anchors: TAnchorMap = {};

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    try {
      const line = lines[i];
      if (line !== undefined) {
        processYamlLine(line, stack, i + 1, anchors);
      }
    } catch (error) {
      // Add line number to error message
      throw new Error(`Line ${i + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
};

/**
 * Process a single line of YAML
 *
 * @param line - A single line from the YAML document
 * @param stack - The current stack of objects being built
 * @param lineNumber - The current line number (for error reporting)
 * @param anchors - Map of anchors to their values
 */

const processYamlLine = (line: string, stack: Array<IStackItem>, lineNumber = 0, anchors: TAnchorMap = {}): void => {
  // Skip empty lines and comments
  if (!line || line.trim() === '' || line.trim().startsWith('#')) return;

  // Calculate indentation level
  const indent = line.search(/\S/);
  const content = line.trim();

  // Check if we're in a multiline string context
  const lastStackItem = stack[stack.length - 1];
  if (lastStackItem?.multilineKey) {
    processMultilineString(line, indent, stack);
    return;
  }

  // Process different line types
  processLineByType(content, indent, stack, lineNumber, anchors);
};

/**
 * Process a line based on its type (list item, key-value, anchor, alias)
 *
 * @param content - The trimmed content of the line
 * @param indent - The indentation level
 * @param stack - The current stack of objects being built
 * @param lineNumber - The current line number
 * @param anchors - Map of anchors to their values
 */

const processLineByType = (content: string, indent: number, stack: Array<IStackItem>, lineNumber: number, anchors: TAnchorMap): void => {
  if (content.startsWith('-')) {
    // List item
    processListItem(content, indent, stack, lineNumber, anchors);
  } else if (content.includes(':')) {
    processKeyValuePair(content, indent, stack, lineNumber, anchors);
  } else if (content.startsWith('&')) {
    // This is an anchor definition, handled in processKeyValuePair
  } else if (content.startsWith('*')) {
    // This is an alias reference
    processAliasReference(content, stack, anchors);
  }
};

/**
 * Process an alias reference (*alias)
 *
 * @param content - The line content
 * @param stack - The stack of objects being built
 * @param anchors - Map of anchors to their values
 */
const processAliasReference = (content: string, stack: Array<IStackItem>, anchors: TAnchorMap): void => {
  // Extract the alias name
  const aliasName = content.substring(1).trim();

  // Check if the alias exists
  if (!(aliasName in anchors)) {
    throw new Error(`Unknown alias: ${aliasName}`);
  }

  // Get the referenced value
  const referencedValue = anchors[aliasName];

  // Get the current context
  const lastStackItem = stack[stack.length - 1];
  if (!lastStackItem) return;

  // If we're in an array, add the referenced value to it
  if (lastStackItem.isArray && Array.isArray(lastStackItem.obj)) {
    // We need to ensure the referenced value is a valid TYamlData
    lastStackItem.obj.push(<TYamlData>referencedValue);
  }
  // Otherwise, we can't handle standalone aliases outside of arrays
  // In a real implementation, we would need to handle this case
};

/**
 * Process a multiline string
 *
 * @param line - The current line
 * @param indent - The indentation level
 * @param stack - The stack of objects being built
 */
const processMultilineString = (line: string, indent: number, stack: Array<IStackItem>): void => {
  const lastStackItem = stack[stack.length - 1];
  if (!lastStackItem || !lastStackItem.multilineKey) return;

  // If this line has less indentation than the multiline string started with,
  // we've reached the end of the multiline string
  if (indent <= lastStackItem.indent) {
    finishMultilineString(lastStackItem);

    // Process this line normally
    processYamlLine(line, stack);
    return;
  }

  // Add this line to the multiline value
  const lineContent = line.slice(lastStackItem.indent + 2); // +2 for the extra indentation
  if (lastStackItem.multilineValue) {
    lastStackItem.multilineValue += `\n${lineContent}`;
  } else {
    lastStackItem.multilineValue = lineContent;
  }
};

/**
 * Finish processing a multiline string and add it to the parent object
 *
 * @param stackItem - The stack item containing the multiline string
 */
const finishMultilineString = (stackItem: IStackItem): void => {
  // Process the accumulated multiline value
  if (typeof stackItem.obj === 'object' && stackItem.obj !== null && !Array.isArray(stackItem.obj) && stackItem.multilineKey) {
    const parent = stackItem.obj;
    const value = stackItem.multilineValue ?? '';
    const key = stackItem.multilineKey;

    // Process based on the multiline type
    if (stackItem.multilineType === 'literal') {
      // Preserve line breaks in literal style (|)
      parent[key] = value;
    } else {
      // Replace line breaks with spaces in folded style (>)
      parent[key] = value.replace(/\n/g, ' ');
    }
  }

  // Clear multiline context
  delete stackItem.multilineKey;
  delete stackItem.multilineValue;
  delete stackItem.multilineType;
};

/**
 * Process a list item line from YAML
 *
 * @param content - The trimmed content of the line
 * @param indent - The indentation level
 * @param stack - The current stack of objects being built
 * @param lineNumber - The current line number
 * @param anchors - Map of anchors to their values
 */

const processListItem = (content: string, indent: number, stack: Array<IStackItem>, lineNumber = 0, anchors: TAnchorMap = {}): void => {
  // Remove the dash and trim
  const itemContent = content.substring(1).trim();

  // Adjust the stack based on indentation
  adjustStack(stack, indent);

  // Get parent object safely
  const lastStackItem = stack[stack.length - 1];
  if (!lastStackItem) return;

  // Check if we're already in an array context
  if (lastStackItem.isArray && Array.isArray(lastStackItem.obj)) {
    processItemInExistingArray(
      {
        itemContent,
        indent,
        stack,
        array: lastStackItem.obj,
        lineNumber,
      },
      anchors,
    );
  } else {
    // If we're at the root level and there's a key in the parent object that matches the array key
    if (typeof lastStackItem.obj === 'object' && lastStackItem.obj !== null && !Array.isArray(lastStackItem.obj)) {
      const parent = lastStackItem.obj;
      const key = lastStackItem.arrayKey;

      // If we have a specific key for this array
      if (key && key in parent) {
        // If the property exists but isn't an array yet, convert it to an array
        if (!Array.isArray(parent[key])) {
          parent[key] = [];
        }

        // Use the existing array
        const array = <Array<TYamlData>>parent[key];
        processItemInExistingArray(
          {
            itemContent,
            indent,
            stack,
            array,
            lineNumber,
          },
          anchors,
        );

        // Push the array onto the stack
        stack.push({
          indent,
          obj: array,
          isArray: true,
        });

        return;
      }
    }

    // Create a new array with the appropriate key
    createNewArrayWithItem(
      {
        itemContent,
        indent,
        stack,
        lastStackItem,
        lineNumber,
      },
      anchors,
    );
  }
};

/**
 * Process an item in an existing array
 *
 * @param params - Parameters for processing an item in an array
 * @param anchors - Map of anchors to their values
 */
const processItemInExistingArray = (params: IProcessItemParams, anchors: TAnchorMap = {}): void => {
  const { itemContent, indent, stack, array, lineNumber } = params;

  if (!array) return;

  // Extract anchor and content
  const { processedContent, anchorName } = extractAnchorInfo(itemContent);

  if (processedContent.includes(':')) {
    // This is an object in an array
    const newObj = <Record<string, TYamlData>>Object.create(null);
    array.push(newObj);

    // Store anchor if defined
    if (anchorName) {
      anchors[anchorName] = newObj;
    }

    // Process the key-value pair within this object
    const [key, value] = processedContent.split(':', 2);

    if (key) {
      processKeyValueInArrayItem({
        key,
        value,
        indent,
        stack,
        obj: newObj,
        lineNumber: lineNumber ?? 0,
      });
    }
  } else {
    // Simple value in array
    const parsedValue = parseYamlValue(processedContent);
    array.push(parsedValue);

    // Store anchor if defined
    if (anchorName) {
      anchors[anchorName] = parsedValue;
    }
  }
};

/**
 * Extract anchor information from a YAML line
 *
 * @param content - The content to extract from
 * @returns The processed content and anchor name
 */
const extractAnchorInfo = (content: string): { processedContent: string; anchorName: string | null } => {
  let processedContent = content;
  let anchorName: string | null = null;

  if (content.startsWith('&')) {
    const spaceIndex = content.indexOf(' ');
    if (spaceIndex > 1) {
      anchorName = content.substring(1, spaceIndex);
      processedContent = content.substring(spaceIndex + 1);
    }
  }

  return { processedContent, anchorName };
};

/**
 * Process a key-value pair within an array item
 *
 * @param params - Parameters for processing a key-value pair
 */
const processKeyValueInArrayItem = (params: IKeyValueParams): void => {
  const { key, value, indent, stack, obj } = params;

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return; // Can only add properties to objects
  }

  const objRecord = obj;
  const trimmedKey = key.trim();
  const trimmedValue = value?.trim() ?? '';

  if (trimmedValue === '') {
    // Nested object
    objRecord[trimmedKey] = <Record<string, TYamlData>>Object.create(null);
    stack.push({
      indent: indent + 2, // Assume nested items are indented
      obj: <Record<string, TYamlData>>objRecord[trimmedKey],
    });
  } else if (trimmedValue === '|' || trimmedValue === '>') {
    // Multiline string
    // | = literal style (preserve line breaks)
    // > = folded style (replace line breaks with spaces)
    if (stack.length > 0) {
      const lastItem = stack[stack.length - 1];
      if (lastItem) {
        lastItem.multilineKey = trimmedKey;
        lastItem.multilineType = trimmedValue === '|' ? 'literal' : 'folded';
      }
    }
  } else {
    // Simple key-value
    objRecord[trimmedKey] = parseYamlValue(trimmedValue);
  }
};

/**
 * Create a new array and add the first item
 *
 * @param params - Parameters for creating a new array
 * @param anchors - Map of anchors to their values
 */
const createNewArrayWithItem = (params: IProcessItemParams, anchors: TAnchorMap = {}): void => {
  const { itemContent, indent, stack, lastStackItem } = params;

  if (!lastStackItem) return;

  // We need to create a new array
  if (typeof lastStackItem.obj === 'object' && lastStackItem.obj !== null && !Array.isArray(lastStackItem.obj)) {
    const parent = lastStackItem.obj;
    const arrayKey = lastStackItem.arrayKey ?? 'items'; // Default key if none exists

    // Create the array
    parent[arrayKey] = <Array<TYamlData>>[];
    const newArray = <Array<TYamlData>>parent[arrayKey];

    // Add the first item to the array
    addFirstItemToArray(itemContent, indent, stack, newArray, anchors);
  }
};

/**
 * Add the first item to a newly created array
 *
 * @param itemContent - The content of the item
 * @param indent - The indentation level
 * @param stack - The stack of objects being built
 * @param newArray - The array to add the item to
 * @param anchors - Map of anchors to their values
 */

const addFirstItemToArray = (itemContent: string, indent: number, stack: Array<IStackItem>, newArray: Array<TYamlData>, anchors: TAnchorMap): void => {
  // Extract anchor and content
  const { processedContent, anchorName } = extractAnchorInfo(itemContent);

  // Add the first item
  if (processedContent.includes(':')) {
    // This is an object in an array
    const newObj = <Record<string, TYamlData>>Object.create(null);
    newArray.push(newObj);

    // Store anchor if defined
    if (anchorName) {
      anchors[anchorName] = newObj;
    }

    // Process the key-value pair within this object
    const [key, value] = processedContent.split(':', 2);

    if (key) {
      processKeyValueInArrayItem({
        key,
        value,
        indent,
        stack,
        obj: newObj,
        lineNumber: 0,
      });
    }
  } else {
    // Simple value in array
    const parsedValue = parseYamlValue(processedContent);
    newArray.push(parsedValue);

    // Store anchor if defined
    if (anchorName) {
      anchors[anchorName] = parsedValue;
    }
  }

  // Push the array onto the stack
  stack.push({
    indent,
    obj: newArray,
    isArray: true,
  });
};

/**
 * Process a key-value pair line from YAML
 *
 * @param content - The trimmed content of the line
 * @param indent - The indentation level of the line
 * @param stack - The current stack of objects being built
 * @param lineNumber - The current line number
 * @param anchors - Map of anchors to their values
 */

const processKeyValuePair = (content: string, indent: number, stack: Array<IStackItem>, lineNumber = 0, anchors: TAnchorMap = {}): void => {
  // Extract key-value and anchor information
  const { processedContent, key, value, anchorName } = extractKeyValueAnchorInfo(content);

  if (!key) return;

  const trimmedKey = key.trim();
  const trimmedValue = value?.trim() ?? '';

  // Adjust the stack based on indentation
  adjustStack(stack, indent);

  // Get parent object safely
  const lastStackItem = stack[stack.length - 1];
  if (!lastStackItem) return;

  // Handle array context
  if (handleArrayContext(content, indent, stack, lastStackItem, lineNumber, anchors)) {
    return;
  }

  // Ensure we're working with an object
  if (typeof lastStackItem.obj !== 'object' || lastStackItem.obj === null || Array.isArray(lastStackItem.obj)) {
    return; // Can only add properties to objects
  }

  const parent = lastStackItem.obj;

  // Process the key-value pair based on the value type
  processKeyValueByType(trimmedKey, trimmedValue, processedContent, indent, stack, parent, lastStackItem, anchorName, anchors);
};

/**
 * Extract key-value and anchor information from a line
 *
 * @param content - The line content
 * @returns The processed content, key, value, and anchor name
 */
const extractKeyValueAnchorInfo = (
  content: string,
): {
  processedContent: string;
  key: string | undefined;
  value: string | undefined;
  anchorName: string | null;
} => {
  let processedContent = content;
  let anchorName: string | null = null;

  const colonIndex = content.indexOf(':');
  if (colonIndex !== -1) {
    const key = content.substring(0, colonIndex).trim();
    let value = content.substring(colonIndex + 1).trim();

    if (value.startsWith('&')) {
      const spaceIndex = value.indexOf(' ');
      if (spaceIndex > 1) {
        anchorName = value.substring(1, spaceIndex);
        value = value.substring(spaceIndex + 1);
        processedContent = `${key}: ${value}`;
      }
    }
  }

  const [key, value] = processedContent.split(':', 2);

  return { processedContent, key, value, anchorName };
};

/**
 * Handle array context in key-value processing
 *
 * @param content - The line content
 * @param indent - The indentation level
 * @param stack - The stack of objects being built
 * @param lastStackItem - The last item on the stack
 * @param lineNumber - The current line number
 * @param anchors - Map of anchors to their values
 * @returns True if array context was handled
 */

const handleArrayContext = (
  content: string,
  indent: number,
  stack: Array<IStackItem>,
  lastStackItem: IStackItem,
  lineNumber: number,
  anchors: TAnchorMap,
): boolean => {
  // Make sure we're working with an object, not an array
  if (lastStackItem.isArray) {
    // If the current context is an array, we need to exit it
    stack.pop();
    // Try again with the parent context
    processKeyValuePair(content, indent, stack, lineNumber, anchors);
    return true;
  }

  return false;
};

/**
 * Process a key-value pair based on the value type
 *
 * @param key - The key
 * @param value - The value
 * @param processedContent - The processed content
 * @param indent - The indentation level
 * @param stack - The stack of objects being built
 * @param parent - The parent object
 * @param lastStackItem - The last item on the stack
 * @param anchorName - The anchor name
 * @param anchors - Map of anchors to their values
 */

const processKeyValueByType = (
  key: string,
  value: string,
  processedContent: string,
  indent: number,
  stack: Array<IStackItem>,
  parent: Record<string, TYamlData>,
  lastStackItem: IStackItem,
  anchorName: string | null,
  anchors: TAnchorMap,
): void => {
  if (value === '') {
    // Handle empty value (object or array)
    handleEmptyValue(key, processedContent, indent, stack, parent, anchorName, anchors);
  } else if (value === '|' || value === '>') {
    // Multiline string
    // | = literal style (preserve line breaks)
    // > = folded style (replace line breaks with spaces)
    lastStackItem.multilineKey = key;
    lastStackItem.multilineType = value === '|' ? 'literal' : 'folded';
  } else {
    // This is a key with a value
    const parsedValue = parseYamlValue(value);
    parent[key] = parsedValue;

    // Store anchor if defined
    if (anchorName) {
      anchors[anchorName] = parsedValue;
    }
  }
};

/**
 * Handle empty value in key-value pair (object or array)
 *
 * @param key - The key
 * @param processedContent - The processed content
 * @param indent - The indentation level
 * @param stack - The stack of objects being built
 * @param parent - The parent object
 * @param anchorName - The anchor name
 * @param anchors - Map of anchors to their values
 */

const handleEmptyValue = (
  key: string,
  processedContent: string,
  indent: number,
  stack: Array<IStackItem>,
  parent: Record<string, TYamlData>,
  anchorName: string | null,
  anchors: TAnchorMap,
): void => {
  // Check if the next line might be a list item
  // This is a key that will contain an array
  if (processedContent.endsWith(':')) {
    // Push a context for this key, marking it as potentially an array
    parent[key] = <Record<string, TYamlData>>Object.create(null);

    // Store anchor if defined
    if (anchorName) {
      anchors[anchorName] = parent[key];
    }

    stack.push({
      indent,
      obj: <Record<string, TYamlData>>parent[key],
      arrayKey: key,
    });
  } else {
    // This is an object key with nested values
    parent[key] = <Record<string, TYamlData>>Object.create(null);

    // Store anchor if defined
    if (anchorName) {
      anchors[anchorName] = parent[key];
    }

    stack.push({
      indent,
      obj: <Record<string, TYamlData>>parent[key],
    });
  }
};

/**
 * Adjust the stack based on indentation level
 *
 * @param stack - The current stack of objects being built
 * @param currentIndent - The indentation level of the current line
 */
const adjustStack = (stack: Array<IStackItem>, currentIndent: number): void => {
  // Pop stack until we find the parent object for this indentation
  while (stack.length > 1) {
    const lastItem = stack[stack.length - 1];
    if (lastItem && lastItem.indent >= currentIndent) {
      stack.pop();
    } else {
      break;
    }
  }
};

/**
 * Parse a YAML value, handling different types
 *
 * @param value - Raw YAML value string
 * @returns Parsed value (string, number, boolean, null)
 */
export const parseYamlValue = (value: string): TYamlData => {
  // Check for quoted strings
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Check for null/undefined values
  if (isNullValue(value)) {
    return null;
  }

  // Check for boolean values
  const booleanValue = parseBooleanValue(value);
  if (booleanValue !== undefined) {
    return booleanValue;
  }

  // Check for special number values
  const specialNumber = parseSpecialNumber(value);
  if (specialNumber !== undefined) {
    return specialNumber;
  }

  // Check for date values
  const dateValue = parseDateValue(value);
  if (dateValue instanceof Date) {
    return dateValue.toISOString(); // Convert Date to string for YAML
  }

  // Check for numeric values
  const numericValue = parseNumericValue(value);
  if (numericValue !== undefined) {
    return numericValue;
  }

  // Default to string
  return value;
};

/**
 * Check if a value represents null in YAML
 *
 * @param value - The value to check
 * @returns True if the value represents null
 */
const isNullValue = (value: string): boolean => value === 'null' || value === '~' || value === '';

/**
 * Parse a boolean value from YAML
 *
 * @param value - The value to parse
 * @returns The boolean value or undefined if not a boolean
 */
const parseBooleanValue = (value: string): boolean | undefined => {
  const lowerValue = value.toLowerCase();
  if (lowerValue === 'true') return true;
  if (lowerValue === 'false') return false;
  return undefined;
};

/**
 * Parse special number values (Infinity, NaN)
 *
 * @param value - The value to parse
 * @returns The special number or undefined
 */
const parseSpecialNumber = (value: string): number | undefined => {
  // Check for infinity
  if (value === '.inf' || value === '.Inf' || value === '.INF') return Infinity;
  if (value === '-.inf' || value === '-.Inf' || value === '-.INF') return -Infinity;

  // Check for NaN
  if (value === '.nan' || value === '.NaN' || value === '.NAN') return NaN;

  return undefined;
};

/**
 * Parse a date value from YAML
 *
 * @param value - The value to parse
 * @returns A Date object or the original value if not a valid date
 */
const parseDateValue = (value: string): Date | string => {
  // ISO 8601 date regex with non-capturing groups
  const dateRegex = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

  if (dateRegex.test(value)) {
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date;
  }

  return value;
};

/**
 * Parse numeric values (decimal, hex, octal)
 *
 * @param value - The value to parse
 * @returns The numeric value or undefined
 */
const parseNumericValue = (value: string): number | undefined => {
  // Check for decimal numbers
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  // Check for hexadecimal
  if (/^0x[0-9a-fA-F]+$/.test(value)) {
    return parseInt(value, 16);
  }

  // Check for octal
  if (/^0o[0-7]+$/.test(value)) {
    return parseInt(value.substring(2), 8);
  }

  return undefined;
};
