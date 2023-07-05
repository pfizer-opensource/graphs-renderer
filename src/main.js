/* global serviceData  */
/* global serviceGroupName */
import { renderGraphs, renderCFDs } from "./graphs-renderer.js";
import { processServiceData } from "./data-processor.js";

let removedTicketTypes = [];
let removedRepos = [];

if (typeof serviceGroupName !== "undefined" && serviceGroupName) {
  renderCFDs(serviceData, serviceGroupName);
} else {
  let data = processServiceData(serviceData);
  if (!serviceData || serviceData.length === 0) {
    console.log("There is no data for this service!");
  } else {
    renderGraphs(data);
  }

  const ticketTypeLiCheckboxElements = document.querySelectorAll(".ticket-type-checkbox");
  const repoLiCheckboxElements = document.querySelectorAll(".repo-checkbox");
  const allTicketTypesCheckbox = document.getElementById("all-ticket-types");
  const allReposCheckbox = document.getElementById("all-repositories");

  allTicketTypesCheckbox?.addEventListener("change", () => {
    if (!allTicketTypesCheckbox.checked) {
      removedTicketTypes = [];
      ticketTypeLiCheckboxElements.forEach((liCheckbox) => {
        const ticketType = liCheckbox.id;
        liCheckbox.checked = false;
        removedTicketTypes.push(ticketType);
      });
    } else {
      ticketTypeLiCheckboxElements.forEach((liCheckbox) => {
        liCheckbox.checked = true;
      });
      removedTicketTypes = [];
    }
    data = processServiceData(serviceData, removedRepos, removedTicketTypes);
    renderGraphs(data, removedRepos, removedTicketTypes);
  });
  allReposCheckbox?.addEventListener("change", () => {
    if (!allReposCheckbox.checked) {
      removedRepos = [];
      repoLiCheckboxElements.forEach((liCheckbox) => {
        const repo = liCheckbox.id;
        liCheckbox.checked = false;
        removedRepos.push(repo);
      });
    } else {
      repoLiCheckboxElements.forEach((liCheckbox) => {
        liCheckbox.checked = true;
      });
      removedRepos = [];
    }
    data = processServiceData(serviceData, removedRepos, removedTicketTypes);
    renderGraphs(data, removedRepos, removedTicketTypes);
  });
  ticketTypeLiCheckboxElements?.forEach((liCheckbox) => {
    liCheckbox.addEventListener("change", () => {
      const ticketType = liCheckbox.id;
      console.log(liCheckbox.parentNode);
      if (!liCheckbox.checked && !removedRepos.includes(ticketType)) {
        removedTicketTypes.push(ticketType);
      } else {
        removedTicketTypes.splice(removedTicketTypes.indexOf(ticketType), 1);
      }
      data = processServiceData(serviceData, removedRepos, removedTicketTypes);
      renderGraphs(data, removedRepos, removedTicketTypes);
    });
  });
  repoLiCheckboxElements?.forEach((liCheckbox) => {
    liCheckbox.addEventListener("change", () => {
      const repoName = liCheckbox.id;
      if (!liCheckbox.checked && !removedRepos.includes(repoName)) {
        removedRepos.push(repoName);
      } else {
        removedRepos.splice(removedRepos.indexOf(repoName), 1);
      }
      data = processServiceData(serviceData, removedRepos, removedTicketTypes);
      renderGraphs(data, removedRepos, removedTicketTypes);
    });
  });
}
