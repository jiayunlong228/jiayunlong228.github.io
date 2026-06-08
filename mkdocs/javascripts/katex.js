document$.subscribe(({ body }) => {
  const render = () => {
    if (typeof renderMathInElement === "undefined") {
      setTimeout(render, 50)
      return
    }

    renderMathInElement(body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true },
      ],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      throwOnError: false,
    })
  }

  render()
})
