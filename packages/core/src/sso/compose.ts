export const compose = (...funcs: any[]) => {
  if (funcs.length === 0) return (args: any) => args;
  if (funcs.length === 1) return funcs[0];
  return funcs.reduce(
    (f1, f2) =>
      (...args: any[]) =>
        f1(f2(...args)),
  );
};
