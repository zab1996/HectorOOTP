(function () {
  document.querySelectorAll(".ac-input").forEach((input) => {
    const url = input.dataset.ac;
    if (!url) return;
    let box = null;
    let timer = null;

    function close() {
      if (box) {
        box.remove();
        box = null;
      }
    }

    function show(items) {
      close();
      if (!items.length) return;
      box = document.createElement("div");
      box.className = "ac-dropdown";
      items.forEach((item) => {
        const div = document.createElement("div");
        div.textContent = item.display;
        div.addEventListener("mousedown", (e) => {
          e.preventDefault();
          input.value = item.name;
          close();
        });
        box.appendChild(div);
      });
      const parent = input.closest(".autocomplete-form") || input.parentElement;
      parent.style.position = "relative";
      parent.appendChild(box);
    }

    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 1) {
        close();
        return;
      }
      timer = setTimeout(async () => {
        try {
          const res = await fetch(url + "?q=" + encodeURIComponent(q));
          const data = await res.json();
          show(data);
        } catch (_) {
          close();
        }
      }, 150);
    });

    input.addEventListener("blur", () => setTimeout(close, 150));
  });
})();
