import util from 'node:util';

export const PROMISE_STATE = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
};

export const promiseState = <T>(promise: Promise<T>) => {
  const inspec = util.inspect(promise);
  if (inspec.includes(PROMISE_STATE.PENDING)) return PROMISE_STATE.PENDING;
  else if (inspec.includes(PROMISE_STATE.REJECTED))
    return PROMISE_STATE.REJECTED;
  else return PROMISE_STATE.FULFILLED;
};

export const asyncPool = <T>(
  poolLimit: number,
  iterableFun: Array<() => Promise<T>>,
) => {
  let i = 0;
  const ret: Array<Promise<T>> = [];
  const executing: Array<Promise<T>> = [];
  const queue = (): Promise<any> => {
    if (i === iterableFun.length) {
      return Promise.resolve();
    }
    const p = iterableFun[i]();
    i += 1;
    ret.push(p);
    // promise执行完毕，从executing数组中删除
    const e: Promise<any> = p.then(() =>
      executing.splice(executing.indexOf(e), 1),
    );
    executing.push(e);
    let r: Promise<any> = Promise.resolve();
    // 使用Promise.race，获得executing中promise的执行情况
    // 每当正在执行的promise数量高于poolLimit，就执行一次 否则继续实例化新的Promise达到poolLimit时执行
    if (executing.length >= poolLimit) {
      r = Promise.race(executing);
    }
    // 递归，直到遍历完array
    return r.then(() => queue());
  };
  return queue().then(() => Promise.all(ret));
};

export async function filterAsync<T>(
  array: T[],
  predicate: (value: T, index: number) => Promise<boolean>,
): Promise<T[]> {
  const results = await Promise.all(
    array.map(async (element, index) => {
      return {
        element,
        keep: await predicate(element, index),
      };
    }),
  );

  return results.filter((item) => item.keep).map((item) => item.element);
}
