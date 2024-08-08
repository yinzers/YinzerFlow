export default (str: string, separator: string): [string, string] => {
  const index = str.indexOf(separator);
  const first = str.slice(0, index);
  const rest = str.slice(index + separator.length);
  return [first, rest];
};
