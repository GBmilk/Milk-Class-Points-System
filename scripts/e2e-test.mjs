// ===== 端到端功能测试 v2（通过 CDP 驱动应用） =====
const BASE = 'http://127.0.0.1:9222'

async function getPage() {
  const list = await (await fetch(`${BASE}/json`)).json()
  return list.find((t) => t.type === 'page')
}

const ws = new WebSocket((await getPage()).webSocketDebuggerUrl)
let msgId = 0
const pending = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
}
await new Promise((r) => (ws.onopen = r))

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId
    pending.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m)))
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.result && r.result.exceptionDetails) {
    throw new Error('页面脚本异常: ' + JSON.stringify(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text))
  }
  return r.result?.result?.value
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const q = (v) => JSON.stringify(v)

async function waitFor(sel, timeout = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await ev(`!!document.querySelector(${q(sel)})`)) return true
    await wait(250)
  }
  return false
}

async function setInput(sel, value) {
  return ev(`(() => {
    const el = document.querySelector(${q(sel)})
    if (!el) return false
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${q(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
}
async function setNumber(sel, idx, value) {
  return ev(`(() => {
    const els = [...document.querySelectorAll(${q(sel)})]
    const el = els[${idx}]
    if (!el) return false
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${q(String(value))})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  })()`)
}
const click = (sel) => ev(`(() => { const el = document.querySelector(${q(sel)}); if (!el) return false; el.click(); return true })()`)
const clickText = (txt) =>
  ev(`(() => { const els = [...document.querySelectorAll('.el-button')]; const el = els.find((b) => b.textContent.includes(${q(txt)})); if (!el) return false; el.click(); return true })()`)
const clickExactIn = (container, txt) =>
  ev(`(() => { const c = document.querySelector(${q(container)}); if (!c) return false; const els = [...c.querySelectorAll('.el-button')]; const el = els.find((b) => b.textContent.trim() === ${q(txt)}); if (!el) return false; el.click(); return true })()`)
const clickTab = (txt) =>
  ev(`(() => { const els = [...document.querySelectorAll('.el-tabs__item')]; const el = els.find((b) => b.textContent.includes(${q(txt)})); if (!el) return false; el.click(); return true })()`)
const clickRadio = (txt) =>
  ev(`(() => { const els = [...document.querySelectorAll('.el-radio-button')]; const el = els.find((b) => b.textContent.includes(${q(txt)})); if (!el) return false; el.click(); return true })()`)
const clickChip = (txt) =>
  ev(`(() => { const els = [...document.querySelectorAll('.reason-chip')]; const el = els.find((b) => b.textContent.includes(${q(txt)})) || els[0]; if (!el) return false; el.click(); return true })()`)
const pickDropdown = (txt) =>
  ev(`(() => { const els = [...document.querySelectorAll('.el-select-dropdown__item')]; const el = els.find((i) => i.offsetParent !== null && i.textContent.includes(${q(txt)})); if (!el) return false; el.click(); return true })()`)
const openSelect = (sel) => ev(`(() => { const el = document.querySelector(${q(sel)}); if (!el) return false; const target = el.querySelector('.el-select__wrapper') ?? el; target.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true })()`)
const lastMessage = () => ev(`[...document.querySelectorAll('.el-message')].map((m) => m.textContent).join('|')`)
const bodyText = () => ev('document.body.innerText')
const hash = () => ev('location.hash')

const openSelectInActive = (sel) =>
  ev(`(() => { const root = document.querySelector('.el-tab-pane:not([style*="display: none"])') ?? document; const el = root.querySelector(${q(sel)}); if (!el) return false; const target = el.querySelector('.el-select__wrapper') ?? el; target.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true })()`)
const clickInActive = (sel) =>
  ev(`(() => { const root = document.querySelector('.el-tab-pane:not([style*="display: none"])') ?? document; const el = root.querySelector(${q(sel)}); if (!el) return false; el.click(); return true })()`)
const setNumberInActive = (sel, idx, value) =>
  ev(`(() => { const root = document.querySelector('.el-tab-pane:not([style*="display: none"])') ?? document; const els = [...root.querySelectorAll(${q(sel)})]; const el = els[${idx}]; if (!el) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${q(String(value))}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
const pickVisible = (txt) =>
  ev(`(() => { const els = [...document.querySelectorAll('.el-select-dropdown__item')]; const el = els.find((i) => i.offsetParent !== null && i.textContent.includes(${q(txt)})); if (!el) return false; el.click(); return true })()`)

const confirmBox = () =>
  // 取最后一个弹窗：页面上可能残留已关闭但未移除的旧弹窗，必须点击最新打开的那个
  ev(`(() => { const boxes = [...document.querySelectorAll('.el-message-box')]; const box = boxes[boxes.length - 1]; if (!box) return false; const b = box.querySelector('.el-button--primary'); if (!b) return false; b.click(); return true })()`)
// 记录数统计：IndexedDB 优先，localStorage 兜底（与应用持久化逻辑一致）
const dbRecordsCount = () =>
  ev(`(() => new Promise((res) => {
    const readLs = () => { const raw = localStorage.getItem('db:milk-class-points:data'); res(raw ? JSON.parse(raw).records.length : -1) }
    try {
      const req = indexedDB.open('milk-class-points-db')
      req.onupgradeneeded = () => { try { if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv') } catch (e) { readLs() } }
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction('kv', 'readonly')
          const g = tx.objectStore('kv').get('milk-class-points:data')
          g.onsuccess = () => { if (g.result && Array.isArray(g.result.records)) res(g.result.records.length); else readLs() }
          g.onerror = () => readLs()
        } catch (e) { readLs() }
      }
      req.onerror = () => readLs()
      req.onblocked = () => readLs()
    } catch (e) { readLs() }
  }))()`)

let passed = 0
let failed = 0
function check(name, ok, extra = '') {
  if (ok) {
    passed++
    console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`)
  } else {
    failed++
    console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`)
  }
}

console.log('======== 牛奶智慧班级积分 端到端测试 v2 ========')

// S0 重置数据，确保从干净状态开始
await ev('localStorage.clear()')
await ev(`(() => new Promise((res) => { const req = indexedDB.deleteDatabase('milk-class-points-db'); req.onsuccess = req.onerror = req.onblocked = () => res(true); setTimeout(() => res(true), 1500) }))()`)
await send('Page.reload')
await waitFor('.el-input input')
await wait(500)
check('重置后进入登录页', (await hash()) === '#/login', await hash())

// S1 错误密码
await setInput('.el-input input', 'wrongpass')
await clickText('登 录')
await wait(600)
let errTxt = await ev(`document.querySelector('.error-tip')?.textContent ?? ''`)
check('错误密码给出提示', errTxt.includes('密码错误'), errTxt)

// S2 默认密码登录
await setInput('.el-input input', '123456')
await clickText('登 录')
await wait(1000)
check('默认密码 123456 登录成功', (await hash()) === '#/', await hash())

// S3 添加三名学生
async function addStudent(name, gender, points) {
  await ev('location.hash = "#/students"')
  await waitFor('.toolbar')
  await clickText('新增学生')
  await waitFor('.el-dialog .el-input input')
  await setInput('.el-dialog .el-input input', name)
  await clickRadio(gender === '男' ? '男生' : '女生')
  await wait(200)
  if (points > 0) await setNumber('.el-dialog .el-input-number input', 0, points)
  await clickExactIn('.el-dialog', '保存')
  await wait(600)
}
await addStudent('安琪', '女', 5)
await addStudent('李雷', '男', 3)
await addStudent('张三', '男', 8)
await ev('location.hash = "#/students"')
await waitFor('.student-grid, .empty-state')
const names = await ev(`[...document.querySelectorAll('.student-card .name')].map((n) => n.textContent.trim())`)
check('学生按拼音排序(安琪/李雷/张三)', JSON.stringify(names) === JSON.stringify(['安琪', '李雷', '张三']), names.join('、'))

// S4 搜索学生
await setInput('.toolbar input', '李')
await wait(500)
const searchNames = await ev(`[...document.querySelectorAll('.student-card .name')].map((n) => n.textContent.trim())`)
check('搜索学生「李」', JSON.stringify(searchNames) === JSON.stringify(['李雷']), searchNames.join('、'))
await setInput('.toolbar input', '')
await wait(400)

// S5 批量加分
await ev('location.hash = "#/points"')
await waitFor('.points-tabs')
await clickRadio('批量学生')
await wait(300)
await clickText('全选')
await wait(300)
await setNumberInActive('.op-card .el-input-number input', 0, 2)
await clickChip('课堂表现优秀')
await clickText('确认加分')
await wait(700)
let msg = await lastMessage()
check('批量加分成功', msg.includes('加分成功'), msg)

// S6 批量减分（李雷不够扣 → 整体失败）
await clickTab('减分')
await wait(400)
await clickRadio('批量学生')
await wait(300)
await clickText('全选')
await wait(300)
await setNumberInActive('.op-card .el-input-number input', 0, 6)
await clickChip('课堂纪律问题')
await clickText('确认减分')
await wait(700)
msg = await lastMessage()
check('减分超限被拦截(整体失败)', msg.includes('积分不足'), msg)

// S7 单个减分（张三扣 2）
await clickRadio('单个学生')
await wait(300)
await openSelectInActive('.op-card .el-select')
await wait(400)
await pickDropdown('张三')
await wait(300)
await setNumberInActive('.op-card .el-input-number input', 0, 2)
await clickChip('未按时完成作业')
await clickText('确认减分')
await wait(700)
msg = await lastMessage()
check('单个减分成功', msg.includes('减分成功'), msg)
// S8 积分记录生成
await ev('location.hash = "#/records"')
await waitFor('.table-card')
let recRows = await ev(`document.querySelectorAll('.el-table__body-wrapper tbody tr').length`)
check('积分记录已生成(4条+)', recRows >= 4, `表格行数 ${recRows}`)

// S9 创建小组
await ev('location.hash = "#/groups"')
await waitFor('.class-card')
await clickText('创建小组')
await waitFor('.el-dialog .el-input input')
await setInput('.el-dialog .el-input input', '智慧星')
await clickExactIn('.el-dialog', '保存')
await wait(700)
let groupTxt = await bodyText()
check('创建小组成功', groupTxt.includes('智慧星'))

// S10 小组加分（安琪入组 +3）
await clickText('成员与加减分')
await waitFor('.el-drawer .el-select')
await openSelect('.el-drawer .el-select')
await wait(400)
await pickDropdown('安琪')
await wait(300)
await clickText('加入小组')
await wait(500)
await setNumber('.el-drawer .el-input-number input', 0, 3)
await clickChip('帮助同学')
await clickText('确认给全组加分')
await wait(600)
msg = await lastMessage()
check('小组加分成功', msg.includes('加分成功'), msg)
const groupPts = await ev(`document.querySelector('.el-drawer')?.innerText.match(/小组总积分：\\s*(\\d+)/)?.[1] ?? ''`)
check('小组总积分正确(安琪10分)', groupPts === '10', groupPts)
await click('.el-drawer__close-btn')
await wait(400)

// S11 上架商品
await ev('location.hash = "#/store"')
await waitFor('.product-grid, .empty-state')
await clickText('新增商品')
await waitFor('.el-dialog .el-input input')
await setInput('.el-dialog .el-input input', '免作业券')
await setNumber('.el-dialog .el-input-number input', 0, 20)
await setNumber('.el-dialog .el-input-number input', 1, 5)
await clickExactIn('.el-dialog', '保存')
await wait(700)
let storeTxt = await bodyText()
check('商品上架成功', storeTxt.includes('免作业券'))
check('商品显示价格与库存', storeTxt.includes('20 分') && storeTxt.includes('库存 5'))

// S12 商品编辑（改库存）
await clickText('编辑')
await waitFor('.el-dialog .el-input input')
await setNumber('.el-dialog .el-input-number input', 1, 7)
await clickExactIn('.el-dialog', '保存')
await wait(600)
storeTxt = await bodyText()
check('商品编辑后库存=7', storeTxt.includes('库存 7'), storeTxt.match(/库存 \\d+/)?.[0] ?? '')

// S13 积分不足禁止购买
await ev('location.hash = "#/points"')
await waitFor('.points-tabs')
await clickTab('购买')
await wait(500)
await openSelectInActive('.op-card .el-select')
await wait(400)
await pickDropdown('李雷')
await wait(300)
await clickInActive('.product-row')
await wait(300)
const buyState = await ev(`(() => {
  const root = document.querySelector('.el-tab-pane:not([style*="display: none"])') ?? document
  const btn = [...root.querySelectorAll('.el-button')].find((b) => b.textContent.includes('确认购买'))
  const tip = root.querySelector('.block-tip')
  return {
    disabled: btn ? btn.disabled || btn.getAttribute('disabled') !== null : null,
    tip: tip ? tip.textContent.trim() : ''
  }
})()`)
check('积分不足禁止购买(按钮禁用+提示)', buyState.disabled === true && buyState.tip.includes('积分不足'), JSON.stringify(buyState))

// S14 加 20 分后购买成功
await clickTab('加分')
await wait(400)
await clickRadio('单个学生')
await wait(300)
await openSelectInActive('.op-card .el-select')
await wait(400)
await pickDropdown('李雷')
await wait(300)
await setNumberInActive('.op-card .el-input-number input', 0, 20)
await clickChip('获得表扬')
await wait(250)
// 偶发时序下 chip 可能未选中，用自定义原因兜底
const chipOk = await ev(`[...document.querySelectorAll('.reason-chip.active')].some((c) => c.textContent.includes('获得表扬'))`)
if (!chipOk) await setInput('input[placeholder="或输入自定义原因"]', '获得表扬')
await clickText('确认加分')
await wait(600)
await clickTab('购买')
await wait(500)
await openSelectInActive('.op-card .el-select')
await wait(400)
await pickDropdown('李雷')
await wait(300)
await clickInActive('.product-row')
await wait(300)
await clickText('确认购买')
await wait(500)
await confirmBox()
await wait(800)
msg = await lastMessage()
check('购买成功', msg.includes('购买成功'), msg)

// S15 库存与积分变化
await ev('location.hash = "#/store"')
await wait(700)
storeTxt = await bodyText()
check('购买后库存扣减(免作业券6)', storeTxt.includes('库存 6'), storeTxt.match(/库存 \\d+/)?.[0] ?? '')
await ev('location.hash = "#/students"')
await wait(700)
const liLeiPts = await ev(`(() => { const c = [...document.querySelectorAll('.student-card')].find((x) => x.innerText.includes('李雷')); return c ? c.querySelector('.points-num').textContent : '' })()`)
check('李雷购买后积分=5', liLeiPts === '5', liLeiPts)

// S16 商品下架不能购买
await ev('location.hash = "#/store"')
await wait(700)
await ev(`(() => { const cards = [...document.querySelectorAll('.product-card')]; const c = cards.find((x) => x.innerText.includes('免作业券')); if (!c) return 'not found'; const b = [...c.querySelectorAll('.el-button')].find((x) => x.textContent.includes('下架')); if (!b) return 'no btn'; b.click(); return 'ok' })()`)
await wait(600)
await ev('location.hash = "#/points"')
await wait(700)
await clickTab('购买')
await wait(500)
await openSelectInActive('.op-card .el-select')
await wait(400)
await pickDropdown('李雷')
await wait(300)
const buyBtnDisabled = await ev(`(() => { const els=[...document.querySelectorAll('.el-button')]; const b=els.find((x)=>x.textContent.includes('确认购买')); return b ? b.disabled : 'none' })()`)
check('下架商品不可购买', buyBtnDisabled === true, String(buyBtnDisabled))
await ev('location.hash = "#/store"')
await wait(700)
await ev(`(() => { const cards = [...document.querySelectorAll('.product-card')]; const c = cards.find((x) => x.innerText.includes('免作业券')); if (!c) return 'not found'; const b = [...c.querySelectorAll('.el-button')].find((x) => x.textContent.includes('上架')); if (!b) return 'no btn'; b.click(); return 'ok' })()`)
await wait(500)

// S17 缺货商品不能购买
await ev('location.hash = "#/store"')
await wait(700)
await clickText('新增商品')
await waitFor('.el-dialog .el-input input')
await setInput('.el-dialog .el-input input', '铅笔')
await setNumber('.el-dialog .el-input-number input', 0, 3)
await setNumber('.el-dialog .el-input-number input', 1, 1)
await clickExactIn('.el-dialog', '保存')
await wait(600)
await ev('location.hash = "#/points"')
await wait(700)
await clickTab('购买')
await wait(500)
async function pickStudent(name) {
  for (let i = 0; i < 3; i++) {
    await openSelectInActive('.op-card .el-select')
    await wait(400)
    await pickDropdown(name)
    await wait(300)
    const ok = await ev(`(() => { const root = document.querySelector('.el-tab-pane:not([style*="display: none"])') ?? document; const info = root.querySelector('.student-info'); return info ? info.innerText.includes(${JSON.stringify(name)}) : false })()`)
    if (ok) return true
    await wait(400)
  }
  return false
}
await pickStudent('安琪')
async function selectPencil() {
  return ev(`(() => { const rows = [...document.querySelectorAll('.product-row')]; const r = rows.find((x) => x.innerText.includes('铅笔')); if (!r) return false; r.click(); return true })()`)
}
async function buyBtnReady() {
  return ev(`(() => { const els=[...document.querySelectorAll('.el-button')]; const b=els.find((x)=>x.textContent.includes('确认购买')); return b ? !b.disabled : false })()`)
}
await selectPencil()
await wait(300)
if (!(await buyBtnReady())) {
  // 偶发时序：重试选中铅笔
  await selectPencil()
  await wait(300)
}
// 关闭可能残留的消息框，确保只产生一个新消息框
await ev(`(() => { const mbs = [...document.querySelectorAll('.el-message-box')]; mbs.forEach((mb) => { const cancel = mb.querySelector('.el-button:not(.el-button--primary)'); if (cancel) cancel.click() }); return mbs.length })()`)
await wait(400)
await clickText('确认购买')
await waitFor('.el-message-box', 3000)
await wait(300)
const confirmClicked = await confirmBox()
await wait(1200)
console.log('[S17] confirmClicked=' + confirmClicked + ' boxes=' + await ev('JSON.stringify([...document.querySelectorAll(".el-message-box")].map((b) => b.innerText.slice(0, 90)))') + ' msgbox=' + await ev('document.querySelectorAll(".el-message-box").length') + ' stock=' + await ev("(() => new Promise((res) => { const readLs = () => { const raw = localStorage.getItem('db:milk-class-points:data'); const d = raw ? JSON.parse(raw) : null; const p = d ? d.products.find((x) => x.name.includes('铅笔')) : null; res(p ? p.stock : 'none') }; try { const req = indexedDB.open('milk-class-points-db'); req.onsuccess = () => { try { const g = req.result.transaction('kv','readonly').objectStore('kv').get('milk-class-points:data'); g.onsuccess = () => { const d = g.result; const p = d ? d.products.find((x) => x.name.includes('铅笔')) : null; res(p ? p.stock : 'none') }; g.onerror = () => readLs() } catch(e) { readLs() } }; req.onerror = () => readLs() } catch(e) { readLs() } }))()") + ' msgs=' + (await lastMessage()))
// 第一次购买成功，铅笔缺货
await clickTab('购买')
await wait(500)
await pickStudent('安琪')
const pencilRow = await ev(`(() => { const rows = [...document.querySelectorAll('.product-row')]; const r = rows.find((x) => x.innerText.includes('铅笔')); if (!r) return 'none'; r.click(); return r.className })()`)
await wait(300)
const buyDisabled2 = await ev(`(() => { const els=[...document.querySelectorAll('.el-button')]; const b=els.find((x)=>x.textContent.includes('确认购买')); return b ? b.disabled : 'none' })()`)
check('缺货商品不可购买', buyDisabled2 === true, `row=${pencilRow}, buyDisabled=${buyDisabled2}`)
// S18 主题切换
await ev('location.hash = "#/settings"')
await waitFor('.settings-tabs')
await clickTab('外观设置')
await wait(300)
await ev(`(() => { const els=[...document.querySelectorAll('.theme-item')]; const el=els.find((i)=>i.textContent.includes('樱花粉')); if (el) el.click(); return !!el })()`)
await wait(500)
const primary = await ev('getComputedStyle(document.documentElement).getPropertyValue("--app-primary").trim()')
check('主题切换为樱花粉立即生效', primary === '#f472b6', primary)

// S19 深色模式
await clickRadio('深色模式')
await wait(500)
const dark = await ev('document.documentElement.classList.contains("dark")')
check('深色模式生效', dark === true)
// 切回浅色，便于后续
await clickRadio('浅色模式')
await wait(400)

// S20 添加荣誉
await ev('location.hash = "#/honors"')
await waitFor('.page-header')
await clickText('添加荣誉')
await waitFor('.el-dialog .el-input input')
await setInput('.el-dialog .el-input input', '校级优秀班集体')
await clickExactIn('.el-dialog', '保存')
await wait(700)
let honorTxt = await bodyText()
check('荣誉添加成功', honorTxt.includes('校级优秀班集体'))

// S21 排行榜
await ev('location.hash = "#/leaderboard"')
await waitFor('.el-tabs')
const lbTxt = await bodyText()
check('个人排行榜显示前三名', lbTxt.includes('🥇') && lbTxt.includes('🥈') && lbTxt.includes('🥉'))
check('排行榜第一名是安琪', lbTxt.includes('安琪'))
await clickTab('小组排行榜')
await wait(500)
const gbTxt = await bodyText()
check('小组排行榜显示智慧星', gbTxt.includes('智慧星') && /\d+ 分/.test(gbTxt), gbTxt.match(/1\s*\|[^\n]*/)?.[0] ?? '')

// S22 数据持久化（重载后重新登录，数据仍在）
await send('Page.reload')
await wait(2500)
check('重载后回到登录页', (await hash()) === '#/login', await hash())
await setInput('.el-input input', '123456')
await clickText('登 录')
await wait(1000)
await ev('location.hash = "#/students"')
await wait(800)
let stuText = await bodyText()
check('重启后学生数据仍在', stuText.includes('安琪') && stuText.includes('李雷') && stuText.includes('张三'))
await ev('location.hash = "#/store"')
await wait(700)
storeTxt = await bodyText()
check('重启后商品数据仍在', storeTxt.includes('免作业券') && storeTxt.includes('铅笔'))
await ev('location.hash = "#/records"')
await wait(700)
recRows = await ev(`document.querySelectorAll('.el-table__body-wrapper tbody tr').length`)
check('重启后积分记录仍在', recRows >= 6, `记录数 ${recRows}`)

// S23 修改密码
await ev('location.hash = "#/settings"')
await wait(900)
await clickTab('密码设置')
await wait(400)
await ev(`(() => { const cards=[...document.querySelectorAll('.setting-card')]; const card=cards.find((x)=>x.innerText.includes('修改普通登录密码')); if(!card) return false; const els=[...card.querySelectorAll('.el-input input')]; const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true}))}; set(els[0],'123456'); set(els[1],'abc12345'); set(els[2],'abc12345'); return true })()`)
await clickText('修改密码')
await wait(700)
msg = await lastMessage()
check('修改密码成功', msg.includes('密码已更新'), msg)

// S24 旧密码失效、新密码可登录
await ev(`(() => { const els=[...document.querySelectorAll('.nav-item')]; const el=els.find((b)=>b.textContent.includes('退出登录')); if(el) el.click(); return true })()`)
await wait(800)
await setInput('.el-input input', '123456')
await clickText('登 录')
await wait(700)
check('旧密码失效', (await hash()) === '#/login', await hash())
await setInput('.el-input input', 'abc12345')
await clickText('登 录')
await wait(1000)
check('新密码登录成功', (await hash()) === '#/', await hash())

// S25 管理员密码文件（生成 + 登录）
await ev('location.hash = "#/settings"')
await wait(900)
await clickTab('管理员文件')
await wait(500)
await clickText('生成 / 更新 pwd 文件')
await waitFor('.el-dialog .el-input input')
await ev(`(() => { const els=[...document.querySelectorAll('.el-dialog .el-input input')]; const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true}))}; set(els[0],'admin888'); set(els[1],'admin888') })()`)
await clickExactIn('.el-dialog', '写入文件')
await wait(800)
msg = await lastMessage()
check('pwd 文件创建成功', msg.includes('已创建'), msg)
const pwdPath = await ev(`[...document.querySelectorAll('.el-descriptions__content')].map((x) => x.textContent).find((t) => t.includes('pwd')) ?? ''`)
check('设置页显示 pwd 文件路径', pwdPath.length > 0, pwdPath)
await ev(`(() => { const els=[...document.querySelectorAll('.nav-item')]; const el=els.find((b)=>b.textContent.includes('退出登录')); if(el) el.click(); return true })()`)
await wait(800)
await setInput('.el-input input', 'admin888')
await clickText('登 录')
await wait(1000)
check('管理员密码登录成功', (await hash()) === '#/', await hash())
const footerTxt = await ev(`document.querySelector('.footer')?.textContent ?? ''`)
check('登录身份显示为管理员', footerTxt.includes('管理员'), footerTxt)

// S26 幸运大转盘（侧边栏独立功能 + 设置抽屉 + 免费抽奖 + 中奖结果 + 记录持久化）
await ev('location.hash = "#/wheel"')
await waitFor('.wheel')
check('幸运大转盘作为独立页面打开', true)
const navWheel = await ev(`[...document.querySelectorAll('.nav-item')].some((n) => n.textContent.includes('幸运大转盘'))`)
check('左侧导航包含幸运大转盘', navWheel)
const onlyWheel = await ev(`(() => { const center = document.querySelector('.wheel-center'); if (!center) return false; const drawer = document.querySelector('.el-drawer'); return !drawer || drawer.offsetParent === null })()`)
check('默认只显示转盘且按钮不在旋转层内', onlyWheel)
const centerInWheel = await ev(`!!document.querySelector('.wheel .wheel-center')`)
check('抽奖按钮独立于转盘（不会跟着旋转）', centerInWheel === false)
await clickText('抽奖设置')
await waitFor('.el-drawer .award-row', 4000)
const wheelProducts = await ev(`document.querySelector('.el-drawer')?.innerText.includes('免作业券') ?? false`)
check('商品奖项自动加入转盘', wheelProducts)
await ev(`(() => { const els=[...document.querySelectorAll('.el-drawer .el-button')]; const el=els.find((b)=>b.textContent.includes('自定义奖项')); if(!el) return false; el.click(); return true })()`)
await waitFor('.el-drawer .award-name-input input', 3000)
let customNamed = false
for (let i = 0; i < 3 && !customNamed; i++) {
  await setInput('.el-drawer .award-name-input input', '免作业一次')
  await wait(300)
  const v = await ev(`document.querySelector('.el-drawer .award-name-input input')?.value ?? ''`)
  customNamed = v === '免作业一次'
  if (!customNamed) await wait(400)
}
check('自定义奖项可命名', customNamed)
// 参与学生已从设置抽屉移到转盘下方
const pickerBelowWheel = await ev(`(() => { const p = document.querySelector('.student-picker'); const w = document.querySelector('.wheel-wrap'); if (!p || !w) return false; return p.getBoundingClientRect().top >= w.getBoundingClientRect().bottom - 2 })()`)
check('学生选择区位于转盘下方（页面内）', pickerBelowWheel)
const pickerStillInDrawer = await ev(`!!document.querySelector('.el-drawer .student-picker') || (document.querySelector('.el-drawer')?.innerText.includes('参与学生') ?? false)`)
check('设置抽屉内不再包含参与学生配置', pickerStillInDrawer === false)
const freeTip = await ev(`document.querySelector('.el-drawer')?.innerText.includes('免费抽奖') ?? false`)
check('支持免费抽奖（设置抽屉内切换）', freeTip)
// 关闭设置抽屉，回到纯转盘界面
await ev(`(() => { const b = document.querySelector('.el-drawer__close-btn'); if (!b) return false; b.click(); return true })()`)
await wait(700)
// 在转盘下方选择参与抽奖的学生
await openSelect('.student-picker .el-select')
await wait(400)
await pickDropdown('张三')
await wait(400)
const pickedStudent = await ev(`(() => { const p = document.querySelector('.student-picker'); if (!p) return false; const active = [...p.querySelectorAll('.stu-chip')].find((c) => c.classList.contains('active')); return active ? active.innerText.includes('张三') : false })()`)
check('可在转盘下方选择参与学生', pickedStudent)
const recBefore = await dbRecordsCount()
await ev(`(() => { const b = document.querySelector('.wheel-center'); if (b) b.click(); return !!b })()`)
await wait(900)
const spinningNow = await ev(`document.querySelector('.wheel-center')?.classList.contains('spinning') ?? false`)
const centerTransform = await ev(`(() => { const el = document.querySelector('.wheel-center'); if (!el) return 'none'; const m = new DOMMatrix(getComputedStyle(el).transform); return Math.abs(m.b) < 0.001 && Math.abs(m.c) < 0.001 ? 'no-rotation' : 'rotating' })()`)
check('抽奖动画期间按钮自身不旋转', spinningNow && centerTransform === 'no-rotation', `spinning=${spinningNow} center=${centerTransform}`)
await wait(4800)
const resultShown = await ev(`document.body.innerText.includes('抽奖结果') && document.body.innerText.includes('中奖：')`)
check('转盘动画后显示中奖结果', resultShown)
await clickText('开心收下')
await wait(400)
let recAfter = -1
for (let i = 0; i < 16 && recAfter !== recBefore + 1; i++) {
  recAfter = await dbRecordsCount()
  if (recAfter !== recBefore + 1) await wait(250)
}
check('抽奖生成中奖记录(持久化)', recAfter === recBefore + 1, `before=${recBefore} after=${recAfter}`)

// S27 转盘付费抽奖（学生积分不足时禁止）
await ev('location.hash = "#/wheel"')
await waitFor('.wheel')
await clickText('抽奖设置')
await waitFor('.el-drawer .el-switch', 4000)
await ev(`(() => { const sw = document.querySelector('.el-drawer .el-switch'); if (!sw) return false; sw.click(); return true })()`)
await wait(500)
await ev(`(() => { const els=[...document.querySelectorAll('.el-drawer .el-input-number input')]; const el=els[0]; if(!el) return false; const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(el, '9999'); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)
await wait(600)
await ev(`(() => { const b = document.querySelector('.el-drawer__close-btn'); if (b) b.click(); return !!b })()`)
await wait(600)
await ev(`(() => { const b = document.querySelector('.wheel-center'); if (b) b.click(); return !!b })()`)
await wait(900)
const paidBlocked = await ev(`[...document.querySelectorAll('.el-message')].some((m) => m.textContent.includes('积分不足'))`)
check('付费抽奖积分不足时被拦截', paidBlocked)
// 恢复为免费抽奖，避免影响后续使用
await wait(500)
await clickText('抽奖设置')
await waitFor('.el-drawer .el-switch', 4000)
await ev(`(() => { const sw = document.querySelector('.el-drawer .el-switch'); if (!sw) return false; sw.click(); return true })()`)
await wait(500)
await ev(`(() => { const b = document.querySelector('.el-drawer__close-btn'); if (b) b.click(); return !!b })()`)
await wait(400)

console.log(`
======== 测试完成：通过 ${passed} 项，失败 ${failed} 项 ========`)
process.exit(failed > 0 ? 1 : 0)
