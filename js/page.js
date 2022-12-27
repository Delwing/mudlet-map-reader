const defaultTheme = "Sandstone";

let templateSelector = document.querySelector("#template-selector");
let baseStylesheet = document.querySelector("#base-stylsheet");

function setTheme(theme) {
    baseStylesheet.setAttribute("href", `css/bootstrap-${theme.toLowerCase()}.min.css`);
    localStorage.setItem("theme", theme);
    templateSelector.value = theme;
}

setTheme(localStorage.getItem("theme") ?? defaultTheme);

templateSelector.addEventListener("change", event => {
    setTheme(templateSelector.value);
});
