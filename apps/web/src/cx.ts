/** 조건부 className 합치기: cx('a', cond && 'b', undefined) → 'a b' */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter((name) => typeof name === 'string' && name !== '').join(' ');
}
