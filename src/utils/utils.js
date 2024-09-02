export async function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('The uploaded file is empty. Please upload a valid JSON file.'));
    } else if (!file.type.includes('json')) {
      reject(new Error('Invalid file type. Please upload a valid JSON file.'));
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    }
  });
}

export function addDaysToDate(date, noOfDays) {
  return new Date(date.getTime() + noOfDays * (1000 * 3600 * 24));
}

export function calculateDaysBetweenDates(startDate, endDate, roundDown = true) {
  const startMillis = startDate instanceof Date ? startDate.getTime() : startDate * 1000;
  const endMillis = endDate instanceof Date ? endDate.getTime() : endDate * 1000;
  const diffDays = (endMillis - startMillis) / (1000 * 3600 * 24);
  return { roundedDays: roundDown ? Math.floor(diffDays) : diffDays, exactTimeDiff: parseFloat(diffDays.toFixed(2)) };
}

export function areDatesEqual(date1, date2) {
  const newDate1 = new Date('' + date1);
  const newDate2 = new Date('' + date2);
  return (
    newDate1.getFullYear() === newDate2.getFullYear() &&
    newDate1.getMonth() === newDate2.getMonth() &&
    newDate1.getDate() === newDate2.getDate()
  );
}

export function formatDateToLocalString(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateToNumeric(date) {
  date = new Date(date);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
