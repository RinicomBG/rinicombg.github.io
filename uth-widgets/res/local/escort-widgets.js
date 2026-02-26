/*
 * ============================================================
 * Configuration
 * ============================================================
 */

const UNITS = {
	km: "km",
	pct: "%",
	g: "g"
};

const LABEL_OVERRIDES = {
	Magnitude: "M",
	Population: "Pop",
	Pga: "Computed PGA"
};

/*
 * ============================================================
 * Utilities
 * ============================================================
 */

const $all = (selector, root = document) =>
	Array.from(root.querySelectorAll(selector));

const $id = (id) => document.getElementById(id);

const setHTML = (el, html) => {
	if (el) el.innerHTML = html;
};

const formatNumber = (value, decimals = 0) =>
	value.toLocaleString(
		"en-US",
		decimals > 0
			? {
					minimumFractionDigits: decimals,
					maximumFractionDigits: decimals
			  }
			: undefined
	);

const toTitleCase = (str) =>
	str
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());

function resolveLabel(key) {
	const parts = key.split("_");
	const lastPart = parts[parts.length - 1];

	const hasUnit = UNITS[lastPart] !== undefined;
	const baseKey = hasUnit ? parts.slice(0, -1).join("_") : key;

	const title = toTitleCase(baseKey);

	return LABEL_OVERRIDES[title] ?? title;
}

function resolveUnit(key) {
	const parts = key.split("_");
	const lastPart = parts[parts.length - 1];
	return UNITS[lastPart] ?? "";
}

function resolveDecimals(key) {
	if (key.includes("pga")) return 3;
	if (key == "hypocentral_distance_km") return 1;
	return 0;
}

/*
 * ============================================================
 * Badge Rendering
 * ============================================================
 */

function renderBadge([label, value, unit = ""]) {
	return `${label}: <span>${value}</span>${unit}`;
}

function updateBadges(badgeData, root = document) {
	const badges = $all(".badges .badge", root);

	badgeData.forEach((data, i) => {
		if (!badges[i]) return;
		setHTML(badges[i], renderBadge(data));
	});
}

/*
 * ============================================================
 * Card Rendering
 * ============================================================
 */

function renderStandardCard({ title, main, note }) {
	return `
		<div class="card-title">${title}</div>
		<div class="card-main">${main}</div>
		<div class="card-note">${note ?? ""}</div>
	`;
}

function renderProgressCard({
	title,
	main,
	note,
	progress,
	progress_highlight = "other"
}) {
	return `
		<div class="card-header">
			<div class="card-title-left">${title}</div>
			<div class="card-value-right">${main}</div>
		</div>
		<div class="progress-bar">
			<div class="progress-fill"
				style="
					width: ${progress}%;
					background: var(--progress-${progress_highlight});
				">
			</div>
		</div>
		<div class="card-note">${note ?? ""}</div>
	`;
}

function renderCard(data) {
	return data.progress !== undefined
		? renderProgressCard(data)
		: renderStandardCard(data);
}

function applyCardBorder(card, highlight) {
	card.style.borderColor = highlight
		? `var(--card-border-${highlight})`
		: "";
}

function updateCard(card, data) {
	if (!card) return;

	applyCardBorder(card, data.highlight);
	setHTML(card, renderCard(data));
}

function updateCards(cards, data, offset = 0) {
	data.forEach((item, i) => {
		updateCard(cards[i + offset], item);
	});
}

function updateHeaderCard(index, data) {
	const cards = $all("#header-cards .card");
	updateCard(cards[index], data);
}

/*
 * ============================================================
 * Severity Grid
 * ============================================================
 */

function updateSeverityCounts({ mild, severe, critical }) {
	const container = $id("severity-grid-item");
	if (!container) return;

	const values = $all(".card-value-right", container);
	const progressFills = $all(".progress-fill", container);

	const entries = [mild, severe, critical];
	const total = mild + severe + critical;

	entries.forEach((value, i) => {
		if (!values[i] || !progressFills[i]) return;

		values[i].textContent = value;

		const percent = total > 0
			? (value / total) * 100
			: 0;

		progressFills[i].style.width = `${percent.toFixed(1)}%`;
	});
}

/*
 * ============================================================
 * Data Builders (Fully Dynamic)
 * ============================================================
 */

function buildBadgesArray(data) {
	const inputs = data?.inputs ?? {};

	return Object.entries(inputs)
		.filter(([, value]) => value != null)
		.map(([key, value]) => [
			resolveLabel(key),
			formatNumber(value, resolveDecimals(key)),
			resolveUnit(key)
		]);
}

function buildSeismicArray(data) {
	const seismic = data?.seismic ?? {};

	return Object.entries(seismic)
		.filter(([, value]) => value != null)
		.map(([key, value]) => ({
			title: resolveLabel(key),
			main: formatNumber(value, resolveDecimals(key)),
			note: resolveUnit(key)
		}));
}

function buildDistribution(total, distribution = {}) {
	if (!total) return [];

	return Object.entries(distribution)
		.filter(([, value]) => value != null)
		.map(([key, value]) => ({
			title: resolveLabel(key),
			main: formatNumber(value),
			progress: Math.round((value / total) * 100),
			progress_highlight: "other"
		}));
}

function buildOrthopedicDistribution(data) {
	const medical = data?.medical ?? {};
	return buildDistribution(
		medical.orthopedic_patients,
		medical.orthopedic_distribution
	);
}

function buildOrthopedicPatientsCard(data) {
	const medical = data?.medical ?? {};
	const orthopedic = medical.orthopedic_patients ?? 0;
	const expectedInjured = data?.seismic?.expected_injured ?? 0;

	if (!orthopedic || !expectedInjured) return [];

	const percent = Math.round((orthopedic / expectedInjured) * 100);

	// Return a single card in array
	return [{
		title: "Orthopedic Patients",
		main: formatNumber(orthopedic),
		note: `${percent}% of injured`
	}];
}

function buildSeverityGrid(data) {
	const { mild, severe, critical } = data.medical.severity;

	const total = mild + severe + critical;

	const calcPercent = (value) => 
		total === 0 ? 0 : Math.round((value / total) * 100);

	return [
		{
			title: "Mild",
			main: `${mild}`,
			progress: calcPercent(mild),
			progress_highlight: "good"
		},
		{
			title: "Severe",
			main: `${severe}`,
			progress: calcPercent(severe),
			progress_highlight: "warning"
		},
		{
			title: "Critical",
			main: `${critical}`,
			progress: calcPercent(critical),
			progress_highlight: "danger"
		}
	];
}

function buildResourceCards(data) {
	const resources = data?.medical?.resources ?? {};
	const expectedInjured = data?.seismic?.expected_injured ?? 0;

	const cards = [];

	if (resources.surgeries != null && expectedInjured > 0) {
		const percent = Math.round((resources.surgeries / expectedInjured) * 100);
		cards.push({
			title: "Surgeries Required",
			main: formatNumber(resources.surgeries),
			note: `${percent}% of expected injured`,
			progress: percent,
			progress_highlight: "other"
		});
	}

	if (resources.icu_beds != null && expectedInjured > 0) {
		const percent = Math.round((resources.icu_beds / expectedInjured) * 100);
		cards.push({
			title: "ICU Beds Required",
			main: formatNumber(resources.icu_beds),
			note: `${percent}% of total capacity`,
			progress: percent,
			progress_highlight: "danger"
		});
	}

	if (resources.dialysis != null && expectedInjured > 0) {
		const percent = Math.round((resources.dialysis / expectedInjured) * 100);
		cards.push({
			title: "Dialysis Patients",
			main: formatNumber(resources.dialysis),
			note: `${percent}% of expected injured`,
			progress: percent,
			progress_highlight: "warning"
		});
	}

	return cards;
}

function renderOrthopedicDistributionCards(data, containerId) {
	//const container = $id(containerId);
	const container = $id("breakdown-cards");
	if (!container) return;

	const cardsData = buildOrthopedicDistribution(data);

	// Clear existing cards
	setHTML(container, "");

	// Render each card and append
	cardsData.forEach(cardData => {
		const card = document.createElement("div");
		card.className = "card";
		//card.style.height = "80px";
		card.style.cssText = "flex: 0 0 auto; height: 80px;";
		setHTML(card, renderCard(cardData));
		container.appendChild(card);
	});
}

function updateSeverityGrid(data) {
	const container = document.getElementById("severity-grid-item");
	if (!container) return;

	const titles = container.querySelectorAll(".card-title-left");
	const values = container.querySelectorAll(".card-value-right");
	const progressBars = container.querySelectorAll(".progress-fill");

	data.forEach((item, index) => {
		if (!titles[index] || !values[index] || !progressBars[index]) return;

		// Update title
		titles[index].textContent = item.title;

		// Update value
		values[index].textContent = item.main;

		// Update progress width
		progressBars[index].style.width = `${item.progress}%`;

		// Update progress color
		progressBars[index].style.background = getProgressColor(item.progress_highlight);
	});
}

function getProgressColor(type) {
	const colorMap = {
		good: "var(--progress-good)",
		warning: "var(--progress-warning)",
		danger: "var(--progress-danger)"
	};

	return colorMap[type] || "var(--progress-good)";
}

/*
 * ============================================================
 * Orchestration
 * ============================================================
 */

function updateAll(data) {
	updateBadges(buildBadgesArray(data));

	const headerCards = $all("#header-cards .card");
	updateCards(headerCards, buildSeismicArray(data), 0);
	updateCards(headerCards, buildOrthopedicPatientsCard(data), 3);

	// These cards seem not to make much sense with relation to the others so
	// they are overridden manually.
	var resourcesCardData = buildResourceCards(data);
	resourcesCardData[0].progress_highlight = "warning";
	resourcesCardData[0].highlight = "warning";
	resourcesCardData[0].progress = undefined;
	resourcesCardData[0].note = "initial phase";
	resourcesCardData[1].highlight = "danger";
	resourcesCardData[1].progress = 75;
	resourcesCardData[1].note = "75% of total capacity";
	updateCards(headerCards, [ resourcesCardData[0], resourcesCardData[1] ], 4);

	const breakdownCards = $all("#breakdown-cards .card");
	renderOrthopedicDistributionCards(data, breakdownCards);

	resourcesCardData = buildResourceCards(data);
	const medicalResourcesCards = $all("#medical-resources .card");
	resourcesCardData[0].progress_highlight = "other";
	resourcesCardData[0].highlight = undefined;
	resourcesCardData[0].note = undefined;
	resourcesCardData[1].highlight = 'danger';
	resourcesCardData[1].note = undefined;
	resourcesCardData[2].highlight = 'warning';
	resourcesCardData[2].note = undefined;
	updateCards(medicalResourcesCards, resourcesCardData, 0);

	updateSeverityGrid(buildSeverityGrid(data));
}

async function handleAnchorClick(event) {
	event.preventDefault(); // Stop normal link navigation

	const url = event.currentTarget.href;

	try {
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}

		const textData = await response.text();
		const jsonObject = JSON.parse(textData);

		//console.log(jsonObject);
		updateAll(jsonObject);

		return false;
	} catch (error) {
		console.error("Failed to fetch or parse JSON:", error);
		throw error;
	}
}

/*
 * ============================================================
 * Required Unchanged Object
 * ============================================================
 */

var sample_data = {
	"inputs": {
		"magnitude": 6,
		"population": 3168000,
		"distance_km": 30,
		"depth_km": 10,
		"collapse_pct": 2
	},
	"seismic": {
		"hypocentral_distance_km": 31.575306,
		"pga_g": 0.0311057823510973,
		"expected_injured": 2065
	},
	"medical": {
		"orthopedic_patients": 1797,
		"orthopedic_distribution": {
			"fractures": 1168,
			"crush_injury": 234,
			"compartment_syndrome": 137,
			"major_soft_tissue": 131,
			"crush_syndrome": 127
		},
		"severity": {
			"mild": 584,
			"severe": 949,
			"critical": 264
		},
		"resources": {
			"surgeries": 1436,
			"icu_beds": 311,
			"dialysis": 127
		}
	}
};
