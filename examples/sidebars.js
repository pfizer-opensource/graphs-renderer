
import { eventBus } from "../dist/graphs-renderer.js";

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
let isLeftSidebarOpen = false;
let isRightSidebarOpen = false;

submitButton?.addEventListener("click", async () => {
  try {
    validateForm();
    const observation = {
      data: {
        date_from: dateInput.value,
        observation_id: observationIdInput.value,
        team_id: serviceIdInput.value,
        chart_type: chartTypeInput.value,
        work_item: workItemInput.value,
        body: observationTextarea.value,
      },
    };
    eventBus.emitEvents("submit-observation-form", observation);
  } catch (e) {
    alert("Error submitting the observation: " + e.message);
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

export function initializeForm(data) {
  clearObservationForm();
  workItemInput.value = data.ticketId || "";
  workItemInput.readOnly = true;
  dateInput.value = formatDateToNumeric(data.date);
  dateInput.readOnly = true;
  chartTypeInput.value = data.chartType;
  serviceIdInput.value = data.serviceId;
  observationTextarea.value = data.observationBody || "";
  observationIdInput.value = data.observationId || "";
}

function formatDateToNumeric(date) {
  date = new Date(date);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
