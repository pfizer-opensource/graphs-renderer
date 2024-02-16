
import { eventBus } from "../dist/graphs-renderer.js";
import {formatDateToNumeric} from "../src/utils/utils.js";

const layout = document.getElementById("layout");
const leftSidebar = document.getElementById("left-sidebar");
const leftSidebarContent = document.getElementById("left-sidebar-content");
const leftSidebarArrowImg = document.getElementById("left-sidebar-arrow-img");
const leftSidebarButton = document.getElementById("left-sidebar-button");
export const rightSidebarContent = document.getElementById("right-sidebar-content");
const rightSidebarArrowImg = document.getElementById("right-sidebar-arrow-img");
const rightSidebarButton = document.getElementById("right-sidebar-button");
export const rightSidebar = document.getElementById("right-sidebar");

const dateInput = document.getElementById("date-input");
const workItemInput = document.getElementById("work-item-input");
const chartTypeInput = document.getElementById("chart-type-input");
const observationTextarea = document.getElementById("observation-input");
const observationIdInput = document.getElementById("observation-id-input");
const serviceIdInput = document.getElementById("service-id-input");
const submitButton = document.getElementById("form-button");

const scatterplotDiv = document.getElementById("scatterplot-form-fields-div");
const cfdDiv = document.getElementById("cfd-form-fields-div");
const cycleTimesByStateSelect = document.getElementById("cycle-times-select");
const avgLeadTimeInput = document.getElementById("average-lead-time-input");
const leadTimeInput = document.getElementById("lead-time-input");
const throughputInput = document.getElementById("throughput-input");
const wipInput = document.getElementById("wip-input");
export const warningField = document.getElementById("warning-p");
let cycleTimesByState = {}


let isLeftSidebarOpen = false;
let isRightSidebarOpen = false;

submitButton?.addEventListener("click", async () => {
  try {
    validateForm();
    const observation = {
      date_from: dateInput.value,
      observation_id: observationIdInput.value,
      team_id: serviceIdInput.value,
      chart_type: chartTypeInput.value,
      work_item: workItemInput.value,
      body: observationTextarea.value,
    };
    if (observation.chart_type === "CFD") {
      observation.avg_cycle_time = parseInt(cycleTimesByStateSelect.value.split(" ")[0], 10);
      observation.cycle_times_by_state = cycleTimesByState
      avgLeadTimeInput.value !== "-" && (observation.avg_lead_time = parseInt(avgLeadTimeInput.value.split(" ")[0], 10));
      throughputInput.value !== "-" && (observation.throughput = parseFloat(throughputInput.value.split(" ")[0]));
      wipInput.value !== "-" && (observation.wip = parseInt(wipInput.value.split(" ")[0], 10));
    }
    if (observation.chart_type === "SCATTERPLOT") {
      leadTimeInput.value !== "-" && (observation.lead_time = parseInt(leadTimeInput.value.split(" ")[0], 10));
    }
    eventBus.emitEvents("submit-observation-form", observation);
  } catch (e) {
    warningField.textContent = "Error submitting the observation: " + e.message;
  }
});

updateFormPosition();
window.onload = () => {
  //Adjust the page layout margins to integrate with the sidebar
  adjustSidebarsHeights();

  leftSidebarButton.addEventListener("click", function () {
    if (isLeftSidebarOpen) {
      closeSidebar(leftSidebar, leftSidebarContent, leftSidebarArrowImg);
      isLeftSidebarOpen = false;
    } else {
      isLeftSidebarOpen = true;
      openSidebar(leftSidebar, leftSidebarContent, leftSidebarArrowImg);
    }
  });

  rightSidebarButton.addEventListener("click", function () {
    if (isRightSidebarOpen) {
      closeSidebar(rightSidebar, rightSidebarContent, rightSidebarArrowImg);
      isRightSidebarOpen = false;
    } else {
      openSidebar(rightSidebar, rightSidebarContent, rightSidebarArrowImg);
      isRightSidebarOpen = true;
    }
  });
};
window.onresize = adjustSidebarsHeights;
window.onscroll = updateFormPosition;

function adjustSidebarsHeights() {
  leftSidebar.style.height = layout.offsetHeight + "px";
  rightSidebar.style.height = layout.offsetHeight + "px";
}

function openSidebar(sidebar, sidebarContent, arrowImg) {
  sidebar.classList.remove("w-8");
  sidebar.classList.add("w-96");
  arrowImg.style.transform = "rotate(180deg)";
  sidebarContent.classList.remove("hidden");
}

function closeSidebar(sidebar, sidebarContent, arrowImg) {
  sidebar.classList.remove("w-96");
  sidebar.classList.add("w-8");
  arrowImg.style.transform = "rotate(0deg)";
  sidebarContent.classList.add("hidden");
}

export function toggleRightSidebar(open) {
  if (open) {
    openSidebar(rightSidebar, rightSidebarContent, rightSidebarArrowImg);
  } else {
    closeSidebar(rightSidebar, rightSidebarContent, rightSidebarArrowImg);
  }
}

function updateFormPosition() {
  if (rightSidebar) {
    // Get the sidebar's top position
    const sidebarTop = rightSidebar.getBoundingClientRect().top;
    // Calculate the form's top position, making sure it doesn't go above the sidebar
    const formTop = Math.max(sidebarTop + 24, 0);
    rightSidebarContent.style.top = formTop + "px";
  }
}

function clearObservationForm() {
  dateInput.value = "";
  workItemInput.value = "";
  observationTextarea.value = "";
  chartTypeInput.value = "";
}

function initializeScatterplotForm(data) {
  cfdDiv.classList.add("hidden");
  scatterplotDiv.classList.remove("hidden");
  workItemInput.value = data.ticketId || "";
  leadTimeInput.value = data.metrics.leadTime ? data.metrics.leadTime + " days" : "-";
}

function initializeCfdForm(data) {
  cfdDiv.classList.remove("hidden");
  scatterplotDiv.classList.add("hidden");
  let selectedState;
  cycleTimesByState = data.metrics.cycleTimesByState
  cycleTimesByStateSelect.innerHTML = ''
  for (const state in data.metrics.cycleTimesByState) {
    const option = document.createElement('option');
    option.textContent = `${data.metrics.cycleTimesByState[state]} days - ${state}`;
    option.value = state;
    cycleTimesByStateSelect.appendChild(option);
    if (data.metrics.cycleTimesByState[state] === data.metrics.biggestCycleTime) {
      option.selected = true
      selectedState = state
    }
  }
  cycleTimesByStateSelect.addEventListener('change', (event) => {
    cycleTimesByStateSelect.value = selectedState;
  });
  avgLeadTimeInput.value = data.metrics.averageLeadTime ? data.metrics.averageLeadTime + " days" : "-";
  throughputInput.value = data.metrics.throughput ? data.metrics.throughput + " items" : "-";
  wipInput.value = data.metrics.wip ? data.metrics.wip + " items" : "-";
}

export function initializeForm(data) {

  clearObservationForm();
  if (data.chartType === "CFD") {
    initializeCfdForm(data);
  }
  if (data.chartType === "SCATTERPLOT") {
    initializeScatterplotForm(data);
  }
  dateInput.value = formatDateToNumeric(data.date);
  chartTypeInput.value = data.chartType;
  serviceIdInput.value = data.serviceId;
  observationTextarea.value = data.observationBody || "";
  observationIdInput.value = data.observationId || "";
}


function validateForm() {
  const errors = [];
  if (!observationTextarea.value) {
    errors.push("Observation body is empty");
  }
  if (!dateInput.value) {
    errors.push("Date is empty");
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

