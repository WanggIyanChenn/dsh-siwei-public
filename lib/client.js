// 思维工艺 · 浏览器半边
//   - 侧栏加一个「思维工艺」入口，主区域是插件页面（/dsh-siwei/，iframe）
//   - 页面里点「跑今天的生产线 / 继续未完成的一条」：postMessage 一段草稿，
//     这里开一个新对话并把草稿填进输入框（不直接发送）。
window.__ModuleLoader__.load({
  id: 'dsh-siwei',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const PANEL = 'dsh-siwei'
    const SRC = '/dsh-siwei/'
    const LABEL = { zh: '思维工艺', en: 'Siwei' }

    // 侧栏图标：一条流水线，三个节点
    function LineIcon(props) {
      const size = (props && props.size) || 18
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
      },
      h('circle', { cx: 4.5, cy: 12, r: 2 }),
      h('circle', { cx: 12, cy: 12, r: 2 }),
      h('circle', { cx: 19.5, cy: 12, r: 2 }),
      h('path', { d: 'M6.5 12h3M14 12h3' }))
    }

    function apply(ctx) {
      let lang = /^en\b/i.test(navigator.language) ? 'en' : 'zh'
      ctx.inject(['locale'], (c) => {
        const push = (snap) => { lang = snap.active === 'en' ? 'en' : 'zh' }
        push(c.locale.getSnapshot())
        c.on('locale/change', push)
      })

      function Panel() {
        const ref = React.useRef(null)
        React.useEffect(() => {
          const frame = ref.current
          if (!frame) return
          function onMessage(e) {
            if (!frame || e.source !== frame.contentWindow || e.origin !== location.origin) return
            const data = e.data
            if (!data || data.type !== 'dsh-siwei:start' || typeof data.prompt !== 'string') return
            try {
              ctx.uiWorkspace.startSession(undefined, { prompt: data.prompt, whenDraftExists: 'replace' })
            } catch (err) {
              frame.contentWindow.postMessage(
                { type: 'dsh-siwei:start-failed', message: String((err && err.message) || err) },
                location.origin,
              )
            }
          }
          addEventListener('message', onMessage)
          return () => removeEventListener('message', onMessage)
        }, [])
        return h('iframe', {
          ref,
          src: `${SRC}?lang=${lang}`,
          title: LABEL[lang],
          style: { width: '100%', height: '100%', border: 0, display: 'block' },
        })
      }

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 7, label: () => LABEL[lang] }, LineIcon))
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL }, Panel))
    }

    return { isPlugin: true, inject: ['slots', 'uiWorkspace'], apply }
  },
})
