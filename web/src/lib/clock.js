// 伺服器時間。倒數一律以 x-server-now 校正,不信瀏覽器時鐘(使用者的機器可能慢五分鐘)。
let offset = 0
export function syncServerNow(serverNow) {
  if (Number.isFinite(serverNow)) offset = serverNow - Date.now()
}
export const serverNow = () => Date.now() + offset
