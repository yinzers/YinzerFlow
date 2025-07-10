/**
 * String manipulation utilities
 *
 * This file encapsulates string manipulation utilities used throughout the framework.
 */

/**
 * Divides a string into two parts based on a separator
 * @param str The string to divide
 * @param separator The separator to use
 * @returns A tuple containing the first part and the rest
 */
export const divideString = (str: string, separator: string): [string, string] => {
  const index = str.indexOf(separator);
  if (index === -1) {
    return [str, ''];
  }
  const first = str.slice(0, index);
  const rest = str.slice(index + separator.length);
  return [first, rest];
};
