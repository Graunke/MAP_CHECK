"use strict";
// --- THEME BY TIME LOGIC ---
const timeIcons = {
    morning: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 17h18M12 3v4m-5.657 2.343l2.829 2.828m11.314-5.171l-2.829 2.828M6 17a6 6 0 1112 0"></path></svg>`,
    afternoon: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`,
    sunset: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 17h18M7 17a5 5 0 0110 0M12 12V3m-5.657 6.343l-2.829-2.829m14.142 0l-2.828 2.829"></path></svg>`,
    night: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`
};
function updateTheme() {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    let theme = "night"; // Default 21:00 to 05:59
    if (hour >= 6 && hour < 12) {
        theme = "morning";
    }
    else if (hour >= 12 && hour < 17) {
        theme = "afternoon";
    }
    else if (hour >= 17 && hour < 21) {
        theme = "sunset";
    }
    document.documentElement.setAttribute("data-theme", theme);
    // Update time and icon UI
    const timeText = document.getElementById("time-text");
    const timeIcon = document.getElementById("time-icon");
    if (timeText && timeIcon) {
        timeText.textContent = `${hour.toString().padStart(2, "0")}:${minutes}`;
        // Only update DOM if the theme changes to avoid unnecessary repaints
        if (timeIcon.getAttribute("data-active-theme") !== theme) {
            timeIcon.innerHTML = timeIcons[theme];
            timeIcon.setAttribute("data-active-theme", theme);
        }
    }
}
// Apply theme immediately and check every minute
updateTheme();
setInterval(updateTheme, 60000);
// --- STATE & DATA ---
let worldData = [];
let countriesList = [];
// Load visited countries from LocalStorage
let visited = new Set(JSON.parse(localStorage.getItem("globetrotter_visited") || "[]"));
let toastCount = 0;
// --- SIDEBAR TOGGLE LOGIC ---
const sidebar = document.getElementById("sidebar");
const openSidebarBtn = document.getElementById("open-sidebar-btn");
const closeSidebarBtn = document.getElementById("close-sidebar-btn");
closeSidebarBtn.addEventListener("click", () => {
    sidebar.classList.add("-translate-x-[150%]"); // Move sidebar off-screen
    setTimeout(() => {
        openSidebarBtn.classList.remove("hidden");
        openSidebarBtn.classList.add("flex");
    }, 300); // Wait for transition
});
openSidebarBtn.addEventListener("click", () => {
    openSidebarBtn.classList.add("hidden");
    openSidebarBtn.classList.remove("flex");
    sidebar.classList.remove("-translate-x-[150%]"); // Slide sidebar back in
});
// --- MAP CONFIGURATION ---
const width = 960;
const height = 600;
const svg = d3.select("#map-container").append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
const g = svg.append("g");
// Natural Earth projection looks great for world maps
const projection = d3.geoNaturalEarth1()
    .scale(170)
    .translate([width / 2, height / 2]);
const path = d3.geoPath().projection(projection);
// Map Zooming and Panning Behavior
const zoom = d3.zoom()
    .scaleExtent([1, 10])
    .translateExtent([[0, 0], [width, height]])
    .on("zoom", (event) => g.attr("transform", event.transform));
svg.call(zoom);
// --- INITIALIZATION ---
Promise.all([
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
]).then(([topoData]) => {
    // Process GeoJSON features, ignoring Antarctica
    worldData = topojson.feature(topoData, topoData.objects.countries).features
        .filter((d) => d.properties.name !== "Antarctica");
    // Extract lightweight list for search/sidebar
    countriesList = worldData
        .map((d) => ({ id: d.id, name: d.properties.name }))
        .filter((c) => c.name);
    // Sort alphabetically
    countriesList.sort((a, b) => a.name.localeCompare(b.name));
    renderMap();
    updateSidebar();
    // Fade out loader
    const loader = document.getElementById("loader");
    if (loader) {
        loader.classList.add("opacity-0");
        setTimeout(() => loader.remove(), 500);
    }
});
// --- RENDERING ---
function renderMap() {
    // Draw Ocean Sphere background
    g.append("path")
        .datum({ type: "Sphere" })
        .attr("class", "sphere")
        .attr("d", path);
    // Draw Graticule (Lat/Lon grid lines)
    g.append("path")
        .datum(d3.geoGraticule())
        .attr("class", "graticule")
        .attr("d", path);
    // Draw Countries
    g.selectAll(".country")
        .data(worldData)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("id", (d) => `country-${d.id}`)
        .attr("d", path)
        .classed("visited", (d) => visited.has(d.id))
        .on("mouseover", showTooltip)
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip)
        .on("click", (event, d) => {
        // Prevent click if we are dragging
        if (event.defaultPrevented)
            return;
        toggleVisited(d.id);
    });
}
// --- INTERACTIONS ---
function toggleVisited(id) {
    const countryInfo = countriesList.find((c) => c.id === id);
    const name = countryInfo ? countryInfo.name : "Unknown";
    if (visited.has(id)) {
        visited.delete(id);
        showToast(`Removed ${name}`, "error");
    }
    else {
        visited.add(id);
        showToast(`Explored ${name}!`, "success");
    }
    // Save to LocalStorage
    localStorage.setItem("globetrotter_visited", JSON.stringify(Array.from(visited)));
    // Update visual state on map
    d3.select(`[id="country-${id}"]`).classed("visited", visited.has(id));
    updateSidebar();
}
function zoomToCountry(d) {
    const bounds = path.bounds(d);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2;
    const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
    const translate = [width / 2 - scale * x, height / 2 - scale * y];
    svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
}
// Reset Zoom Button
document.getElementById("reset-zoom").addEventListener("click", () => {
    svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
});
// --- TOOLTIP LOGIC ---
const tooltip = document.getElementById("tooltip");
function showTooltip(event, d) {
    tooltip.classList.remove("opacity-0", "pointer-events-none");
    tooltip.textContent = d.properties.name || "Unknown";
}
function moveTooltip(event) {
    tooltip.style.left = event.clientX + "px";
    tooltip.style.top = (event.clientY - 15) + "px"; // offset slightly above cursor
}
function hideTooltip() {
    tooltip.classList.add("opacity-0", "pointer-events-none");
}
// --- UI UPDATES (SIDEBAR) ---
function updateSidebar() {
    const listContainer = document.getElementById("visited-list");
    const countDisplay = document.getElementById("visited-count");
    const progressBar = document.getElementById("progress-bar");
    const visitedArr = Array.from(visited)
        .map((id) => countriesList.find((c) => c.id === id))
        .filter((c) => Boolean(c));
    visitedArr.sort((a, b) => a.name.localeCompare(b.name));
    const total = countriesList.length;
    const current = visitedArr.length;
    // Update Stats
    countDisplay.textContent = `${current} / ${total}`;
    const percentage = total > 0 ? (current / total) * 100 : 0;
    progressBar.style.width = `${percentage}%`;
    // Update List
    if (current === 0) {
        listContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-40 text-[var(--text-muted)] text-center">
                <svg class="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <p class="text-sm">No countries visited yet.<br>Click the map to start exploring!</p>
            </div>`;
        return;
    }
    listContainer.innerHTML = visitedArr.map((c) => `
        <div class="group flex justify-between items-center bg-[var(--bg-panel-hover)] p-3 rounded-xl border border-[var(--border-color)] transition-all cursor-pointer" onclick="zoomToSpecific('${c.id}')" style="transition: border-color 0.3s;" onmouseover="this.style.borderColor='var(--accent-primary)'" onmouseout="this.style.borderColor='var(--border-color)'">
            <span class="text-[var(--text-main)] font-medium">${c.name}</span>
            <button onclick="event.stopPropagation(); toggleVisited('${c.id}')" class="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1" title="Remove">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>
    `).join("");
}
function zoomToSpecific(id) {
    const countryData = worldData.find((d) => d.id === id);
    if (countryData)
        zoomToCountry(countryData);
}
// --- SEARCH LOGIC ---
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
        searchResults.classList.add("hidden");
        return;
    }
    const filtered = countriesList.filter((c) => c.name.toLowerCase().includes(query));
    if (filtered.length === 0) {
        searchResults.innerHTML = `<div class="p-4 text-[var(--text-muted)] text-center text-sm">No countries found</div>`;
    }
    else {
        searchResults.innerHTML = filtered.map((c) => {
            const isVis = visited.has(c.id);
            return `
            <div class="p-3 hover:bg-[var(--bg-panel-hover)] cursor-pointer flex justify-between items-center transition-colors group" onclick="selectFromSearch('${c.id}')">
                <span class="${isVis ? "text-[var(--accent-primary)] font-medium" : "text-[var(--text-main)]"}">${c.name}</span>
                ${isVis
                ? `<svg class="w-4 h-4 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`
                : `<span class="text-xs text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">Select</span>`}
            </div>
        `;
        }).join("");
    }
    searchResults.classList.remove("hidden");
});
function selectFromSearch(id) {
    searchInput.value = "";
    searchResults.classList.add("hidden");
    const countryData = worldData.find((d) => d.id === id);
    if (countryData) {
        zoomToCountry(countryData);
        if (!visited.has(id)) {
            toggleVisited(id);
        }
    }
}
// Close search dropdown when clicking outside
document.addEventListener("click", (e) => {
    const target = e.target;
    if (!searchInput.contains(target) && !searchResults.contains(target)) {
        searchResults.classList.add("hidden");
    }
});
function showToast(message, type = "success") {
    const toast = document.createElement("div");
    const yOffset = toastCount * 65;
    toast.className = `fixed right-4 px-5 py-3 rounded-xl shadow-2xl font-medium transform transition-all duration-300 translate-y-10 opacity-0 z-50 flex items-center gap-3 border border-[var(--border-color)]`;
    toast.style.bottom = `${24 + yOffset}px`;
    toast.style.backgroundColor = "var(--bg-panel)";
    toast.style.color = "var(--text-main)";
    const iconColor = type === "success" ? "var(--accent-primary)" : "#f43f5e"; // red-500 equivalent
    const icon = type === "success"
        ? `<svg class="w-5 h-5 shrink-0" style="color: ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
        : `<svg class="w-5 h-5 shrink-0" style="color: ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
    toast.innerHTML = `${icon} <span class="text-sm">${message}</span>`;
    document.body.appendChild(toast);
    toastCount++;
    // Enter animation
    requestAnimationFrame(() => {
        setTimeout(() => {
            toast.classList.remove("translate-y-10", "opacity-0");
        }, 10);
    });
    // Exit animation & cleanup
    setTimeout(() => {
        toast.classList.add("translate-y-10", "opacity-0");
        setTimeout(() => {
            toast.remove();
            toastCount--;
        }, 300);
    }, 3000);
}
// Expose functions used via inline HTML `onclick` handlers to the global scope,
// since TypeScript modules do not attach top-level functions to `window` by default.
window.zoomToSpecific = zoomToSpecific;
window.toggleVisited = toggleVisited;
window.selectFromSearch = selectFromSearch;