document$.subscribe(({ body }) => {
  const render = () => {
    if (typeof mermaid === "undefined") {
      setTimeout(render, 50)
      return
    }

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: document.body.getAttribute("data-md-color-scheme") === "slate" ? "dark" : "default",
      flowchart: {
        htmlLabels: true,
        curve: "basis",
      },
    })

    const nodes = Array.from(body.querySelectorAll(".mermaid"))
    for (const node of nodes) {
      node.removeAttribute("data-processed")
    }
    mermaid.run({ nodes })
  }

  render()
})
