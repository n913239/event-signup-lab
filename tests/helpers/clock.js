// 假時鐘:給 createApp({ now }) 用。
// 測試自己決定現在幾點,邊界(剛好等於開賣、剛好逾時)才測得到。
export function fakeClock(t0) {
  let t = t0
  return {
    now: () => t,
    advance(ms) { t += ms },
    set(ms) { t = ms },
  }
}
