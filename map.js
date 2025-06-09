document.addEventListener("DOMContentLoaded", function () {
    // Mapbox access token
    mapboxgl.accessToken =
        "pk.eyJ1IjoiZGNyYW5kZWxsIiwiYSI6ImNsdWs2bmF2ZTBuOWYycG51dzZuMTloNHkifQ.k9Jy_jqxEDlu0Um7_3YusA";

    // Initialize map
    const map = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-74.3118, 41.3919],
        zoom: 10,
        scrollZoom: true,
    });

    // Add controls
    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    map.addControl(
        new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl: mapboxgl,
        }),
        "top-left"
    );

    const geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserLocation: true,
    });
    map.addControl(geolocateControl);

    // Helper: Parse schedule string into an object mapping days to start/end times
    function parseSchedule(hoursStr) {
        const schedule = {};
        if (!hoursStr) return schedule;
        hoursStr.split("\n").forEach(line => {
            const matches = line.match(/^\s*([A-Za-z]+):\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))-(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*$/i);
            if (matches) {
                const day = matches[1];
                schedule[day] = { start: matches[2], end: matches[3] };
            }
        });
        return schedule;
    }

    // Helper: Parse time string like '7:30AM' into hour, minute, period
    function parseTime(timeStr) {
        const m = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
        if (!m) return null;
        return { hour: parseInt(m[1], 10), minute: m[2] ? parseInt(m[2], 10) : 0, period: m[3].toUpperCase() };
    }

    // Convert parsed time to 24-hour format
    function to24(timeObj) {
        let { hour, minute, period } = timeObj;
        if (period === 'PM' && hour < 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        return { hour, minute };
    }

    // Determine if feature is open right now based on its hours string
    function isFeatureOpen(hoursStr) {
        const schedule = parseSchedule(hoursStr);
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const todays = schedule[today];
        if (!todays) return true;
        const now = new Date();
        const startObj = parseTime(todays.start);
        const endObj = parseTime(todays.end);
        if (!startObj || !endObj) return true;
        const { hour: sh, minute: sm } = to24(startObj);
        const { hour: eh, minute: em } = to24(endObj);
        const start = new Date(now);
        start.setHours(sh, sm, 0, 0);
        const end = new Date(now);
        end.setHours(eh, em, 0, 0);
        return now >= start && now <= end;
    }

    // Marker arrays
    const naloxMarkers = [];
    const opppMarkers = [];

    // Popup content logic
    function createPopupHTML(feature) {
        const isOPPP = feature.properties.location_type === "OPPP";

        let html = `
        <div class="popup-card">
            <div class="popup-header">
                <div class="popup-title-group">
                    <h3 class="popup-title">${feature.properties.name}</h3>
                    <span class="popup-type">${isOPPP ? 'OOPP' : 'Naloxbox'}</span>
                </div>
            </div>
            <div class="popup-section">
                <div class="popup-label">Address</div>
                <div class="popup-address-container">
                    <div class="popup-value">${feature.properties.address}</div>
                </div>
            </div>
            <details class="popup-dropdown">
                <summary class="popup-summary">See Hours</summary>
                <div class="popup-hours-container">
                    <div class="popup-value">${feature.properties.hours}</div>
                </div>
            </details>
            <button class="directions-button modern-popup-btn" onclick="getDirections([${feature.geometry.coordinates}], '${feature.properties.address}')">Get Directions</button>
        `;

        if (!isOPPP) {
            html += `
            <div class="popup-section">
                <div class="popup-label">Narcan Location</div>
                <div class="popup-narcan-container">
                    <div class="popup-value">${feature.properties.narcanlocation}</div>
                </div>
            </div>
            <button class="out-of-stock-button modern-popup-btn" onclick="reportOutOfStock('${feature.properties.name}')">Notify to Restock</button>
            `;
        }

        html += `</div>`;
        return html;
    }

    // Marker creation with open/closed state
    function createLordiconMarker(isOPPP, isOpen = true) {
        const el = document.createElement("div");
        el.className = "marker";
        if (!isOpen) {
            el.style.filter = "grayscale(100%) opacity(0.5)";
        }
        el.innerHTML = isOPPP
            ? `<lord-icon src="https://cdn.lordicon.com/daeumrty.json" trigger="hover" state="hover-wave" colors="primary:#f9c9c0,secondary:#ebe6ef,tertiary:#000000,quaternary:#b26836" style="width:35px;height:35px"></lord-icon>`
            : `<lord-icon src="https://cdn.lordicon.com/bpmglzll.json" trigger="hover" colors="primary:#e83a30" style="width:25px;height:25px"></lord-icon>`;
        return el;
    }

    // Load Extended GeoJSON (Naloxboxes and possibly OOPP mixed)
    fetch("Extended_GeoJSON_Locations.geojson")
        .then((res) => res.json())
        .then((data) => {
            data.features.forEach((feature) => {
                const isOPPP = feature.properties.location_type === "OPPP";
                const popup = new mapboxgl.Popup({ offset: 25, closeButton: false, maxWidth: "600px" })
                    .setHTML(createPopupHTML(feature));
                popup.on('open', () => {
                    const content = popup.getElement().querySelector('.mapboxgl-popup-content');
                    if (content) content.scrollTop = 0;
                });
                const isOpen = isFeatureOpen(feature.properties.hours);
                const marker = new mapboxgl.Marker(createLordiconMarker(isOPPP, isOpen))
                    .setLngLat(feature.geometry.coordinates)
                    .setPopup(popup)
                    .addTo(map);
                
                if (isOPPP) opppMarkers.push(marker);
                else naloxMarkers.push(marker);
            });
            updateMarkers();
        });

    // Explicit load OOPP GeoJSON
    fetch("OOPP_Programs.geojson")
        .then((res) => res.json())
        .then((data) => {
            data.features.forEach((feature) => {
                feature.properties.location_type = "OPPP";
                const popup = new mapboxgl.Popup({ offset: 25, closeButton: false, maxWidth: "600px" })
                    .setHTML(createPopupHTML(feature));
                popup.on('open', () => {
                    const content = popup.getElement().querySelector('.mapboxgl-popup-content');
                    if (content) content.scrollTop = 0;
                });
                const isOpen = isFeatureOpen(feature.properties.hours);
                const marker = new mapboxgl.Marker(createLordiconMarker(true, isOpen))
                    .setLngLat(feature.geometry.coordinates)
                    .setPopup(popup)
                    .addTo(map);

                opppMarkers.push(marker);
            });
            updateMarkers();
        });

    // Marker visibility toggle function
    function updateMarkers() {
        const showNalox = document.getElementById("naloxbox-checkbox").checked;
        const showOPPP = document.getElementById("oppp-checkbox").checked;

        naloxMarkers.forEach(marker => {
            marker.getElement().style.display = showNalox ? "block" : "none";
        });
        opppMarkers.forEach(marker => {
            marker.getElement().style.display = showOPPP ? "block" : "none";
        });
    }

    document.getElementById("naloxbox-checkbox").onchange = updateMarkers;
    document.getElementById("oppp-checkbox").onchange = updateMarkers;

    // Orange County Boundary
    map.on("load", () => {
        map.addSource("orange-county-border", {
            type: "geojson",
            data: "Orange_County_Border.geojson",
        });

        map.addLayer({
            id: "orange-county-border-layer",
            type: "line",
            source: "orange-county-border",
            paint: {
                "line-color": "#808080",
                "line-width": 2,
            },
        });

        map.addLayer({
            id: "orange-county-border-fill",
            type: "fill",
            source: "orange-county-border",
            paint: {
                "fill-color": "#FF0000",
                "fill-opacity": 0.05,
            },
        });
    });

    // Global functions for directions and restock
    window.getDirections = function (destination, address) {
        geolocateControl.once("geolocate", (e) => {
            const startPoint = { lat: e.coords.latitude, lng: e.coords.longitude };
            const url = `https://www.google.com/maps/dir/?api=1&origin=${startPoint.lat},${startPoint.lng}&destination=${encodeURIComponent(address)}&travelmode=driving`;
            window.open(url, "_blank");
        });

        if (!geolocateControl.trigger()) {
            const fallback = { lat: 41.4026, lng: -74.3231 };
            const url = `https://www.google.com/maps/dir/?api=1&origin=${fallback.lat},${fallback.lng}&destination=${encodeURIComponent(address)}&travelmode=driving`;
            window.open(url, "_blank");
        }
    };

    window.reportOutOfStock = function (locationName) {
        alert(`Reported: ${locationName} is out of stock.`);
    };

    // Information modal functionality
    const toggleNotesButton = document.getElementById('toggle-notes-button');
    const notesBox = document.getElementById('notes-box');
    const closeNotesButton = document.getElementById('close-notes-button');

    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        return overlay;
    }

    function showModal(modal) {
        const overlay = createOverlay();
        document.body.appendChild(overlay);
        modal.style.display = 'block';
        
        // Add animation
        modal.style.opacity = '0';
        modal.style.transform = 'translate(-50%, -48%)';
        setTimeout(() => {
            modal.style.opacity = '1';
            modal.style.transform = 'translate(-50%, -50%)';
        }, 10);
    }

    function hideModal(modal) {
        const overlay = document.querySelector('.modal-overlay');
        if (overlay) {
            overlay.remove();
        }
        modal.style.display = 'none';
    }

    toggleNotesButton.addEventListener('click', () => {
        showModal(notesBox);
    });

    closeNotesButton.addEventListener('click', () => {
        hideModal(notesBox);
    });

    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            hideModal(notesBox);
        }
    });

    // OOPP modal functionality
    const toggleOoppButton = document.getElementById('toggle-oopp-button');
    const ooppBox = document.getElementById('oopp-box');
    const closeOoppButton = document.getElementById('close-oopp-button');
    toggleOoppButton.addEventListener('click', () => showModal(ooppBox));
    closeOoppButton.addEventListener('click', () => hideModal(ooppBox));
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            hideModal(ooppBox);
        }
    });

    // Naloxone modal functionality
    const toggleAdditionalButton = document.getElementById('toggle-additional-notes-button');
    const additionalBox = document.getElementById('additional-notes-box');
    const closeAdditionalButton = document.getElementById('close-additional-notes-button');
    toggleAdditionalButton.addEventListener('click', () => showModal(additionalBox));
    closeAdditionalButton.addEventListener('click', () => hideModal(additionalBox));
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            hideModal(additionalBox);
        }
    });
});
