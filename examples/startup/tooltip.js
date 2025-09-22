let tooltip = null;

function activate_tooltips(_el) {
    if (!tooltip) {
        let root = document.querySelector('.app-container');
        let frag = document.createDocumentFragment();
        let temp = document.createElement('div');
        temp.innerHTML = '<div class="j-tooltip-anchor"><div class="j-tooltip">{{image["title"]}}</div></div>';
        while (temp.firstChild) {
            frag.appendChild(temp.firstChild);
        }
        root.insertBefore(frag, root.firstChild);
        tooltip = document.querySelector(".j-tooltip");
    }
    document.querySelectorAll(".j-tooltip-hoverable").forEach((tooltip_hoverable) => {
        tooltip_hoverable.addEventListener("mousemove", (event) => { 
            tooltip.style.left = event.clientX + 10 + "px";
            tooltip.style.top = event.clientY + 10 + "px";
        });
        tooltip_hoverable.addEventListener("mouseenter", (_event) => { 
            tooltip.innerText = tooltip_hoverable.dataset.caption;
            tooltip.classList.add('j-tooltip-visible');
        });
        tooltip_hoverable.addEventListener("mouseleave", (_event) => { 
            tooltip.innerText = "";
            tooltip.classList.remove('j-tooltip-visible');
        });
    });
}

app.workspace.containerEl.addEventListener("bridge-post-process", (event) => {
    activate_tooltips(event.target);
});

